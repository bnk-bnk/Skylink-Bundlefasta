import crypto from 'crypto';

interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passKey: string;
  initiatorName: string;
  initiatorPassword?: string;
  callbackUrlBase: string; // Base URL of the deployed app, e.g. https://my-app.vercel.app
  isSandbox: boolean;
}

const getEnvConfig = (): DarajaConfig | null => {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY;
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
  const shortCode = process.env.DARAJA_SHORTCODE;
  const passKey = process.env.DARAJA_PASSKEY;
  const initiatorName = process.env.DARAJA_INITIATOR_NAME;
  const callbackUrlBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  if (!consumerKey || !consumerSecret || !shortCode || !passKey || !initiatorName) {
    return null;
  }

  return {
    consumerKey,
    consumerSecret,
    shortCode,
    passKey,
    initiatorName,
    initiatorPassword: process.env.DARAJA_INITIATOR_PASSWORD || 'P@ssword123',
    callbackUrlBase,
    isSandbox: process.env.DARAJA_ENVIRONMENT !== 'production',
  };
};

// Generates M-Pesa Password parameter for STK
function getMpesaPassword(shortCode: string, passKey: string, timestamp: string): string {
  return Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');
}

// Generates Timestamp parameter: YYYYMMDDHHmmss
function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export class DarajaService {
  private static async getOAuthToken(config: DarajaConfig): Promise<string> {
    const baseUrl = config.isSandbox 
      ? 'https://sandbox.safaricom.co.ke' 
      : 'https://api.safaricom.co.ke';
    
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

    const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      next: { revalidate: 3500 }, // Cache token for ~1 hour
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to generate Daraja token: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    return data.access_token;
  }

  // --- 1. Initiate STK Push ---
  static async initiateStkPush(params: {
    phoneNumber: string;
    amount: number;
    accountReference: string;
    description: string;
  }) {
    const config = getEnvConfig();
    const timestamp = getTimestamp();

    const cleanPhone = params.phoneNumber.replace('+', '').trim();
    const formattedPhone = cleanPhone.startsWith('0') 
      ? `254${cleanPhone.slice(1)}` 
      : cleanPhone;

    if (!config) {
      // Mock flow for testing
      const merchantRequestId = `MR_${crypto.randomBytes(8).toString('hex')}`;
      const checkoutRequestId = `ws_CO_${crypto.randomBytes(8).toString('hex')}`;
      
      // Simulate background callback from Safaricom after 3 seconds
      this.triggerMockCallback('stk', {
        Body: {
          stkCallback: {
            MerchantRequestID: merchantRequestId,
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: params.amount },
                { Name: 'MpesaReceiptNumber', Value: `NL${crypto.randomBytes(4).toString('hex').toUpperCase()}8D9` },
                { Name: 'TransactionDate', Value: Number(timestamp) },
                { Name: 'PhoneNumber', Value: Number(formattedPhone) }
              ]
            }
          }
        }
      });

      return {
        isMock: true,
        MerchantRequestID: merchantRequestId,
        CheckoutRequestID: checkoutRequestId,
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';
    const password = getMpesaPassword(config.shortCode, config.passKey, timestamp);

    const payload = {
      BusinessShortCode: config.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: params.amount,
      PartyA: formattedPhone,
      PartyB: config.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${config.callbackUrlBase}/api/daraja/callback/stk`,
      AccountReference: params.accountReference,
      TransactionDesc: params.description
    };

    const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja STK Push failed: ${errText}`);
    }

    return await res.json();
  }

  // --- 2. Query STK Status ---
  static async queryStkStatus(checkoutRequestId: string) {
    const config = getEnvConfig();
    const timestamp = getTimestamp();

    if (!config) {
      return {
        isMock: true,
        ResponseCode: '0',
        ResponseDescription: 'The service request has been processed successfully.',
        MerchantRequestID: 'MR_mock_query',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: '0',
        ResultDesc: 'The service request is processed successfully.'
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';
    const password = getMpesaPassword(config.shortCode, config.passKey, timestamp);

    const payload = {
      BusinessShortCode: config.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };

    const res = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja STK Query failed: ${errText}`);
    }

    return await res.json();
  }

  // --- 3. B2C Payout ---
  static async initiateB2c(params: {
    phoneNumber: string;
    amount: number;
    remarks: string;
  }) {
    const config = getEnvConfig();
    const cleanPhone = params.phoneNumber.replace('+', '').trim();
    const formattedPhone = cleanPhone.startsWith('0') 
      ? `254${cleanPhone.slice(1)}` 
      : cleanPhone;

    if (!config) {
      const conversationId = `B2C_CON_${crypto.randomBytes(8).toString('hex')}`;
      const originatorConversationId = `B2C_ORI_${crypto.randomBytes(8).toString('hex')}`;

      // Simulate B2C Callback
      this.triggerMockCallback('b2c', {
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          OriginatorConversationID: originatorConversationId,
          ConversationID: conversationId,
          TransactionID: `OBC${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          ResultParameters: {
            ResultParameter: [
              { Name: 'TransactionAmount', Value: params.amount },
              { Name: 'ReceiverPartyPublicName', Value: formattedPhone },
              { Name: 'TransactionReceipt', Value: `NL${crypto.randomBytes(4).toString('hex').toUpperCase()}8D9` }
            ]
          }
        }
      });

      return {
        isMock: true,
        ConversationID: conversationId,
        OriginatorConversationID: originatorConversationId,
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.'
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

    const payload = {
      InitiatorName: config.initiatorName,
      SecurityCredential: config.initiatorPassword, // In prod, this must be encrypted using Daraja initiator public key certificate
      CommandID: 'PromotionPayment', // or SalaryPayment / BusinessPayment
      Amount: params.amount,
      PartyA: config.shortCode,
      PartyB: formattedPhone,
      Remarks: params.remarks,
      QueueTimeOutURL: `${config.callbackUrlBase}/api/daraja/callback/b2c-timeout`,
      ResultURL: `${config.callbackUrlBase}/api/daraja/callback/b2c`,
      Occasion: 'SkylinkPayout'
    };

    const res = await fetch(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja B2C Payout failed: ${errText}`);
    }

    return await res.json();
  }

  // --- 4. Reversal Request ---
  static async requestReversal(params: {
    receiptNumber: string;
    amount: number;
    reason: string;
  }) {
    const config = getEnvConfig();

    if (!config) {
      const conversationId = `REV_CON_${crypto.randomBytes(8).toString('hex')}`;
      
      // Simulate Reversal Callback
      this.triggerMockCallback('reversal', {
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'Reversal Processed Successfully',
          OriginatorConversationID: `REV_ORI_${crypto.randomBytes(8).toString('hex')}`,
          ConversationID: conversationId,
          TransactionID: `REV${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          ResultParameters: {
            ResultParameter: [
              { Name: 'Amount', Value: params.amount },
              { Name: 'Receipt', Value: params.receiptNumber }
            ]
          }
        }
      });

      return {
        isMock: true,
        ConversationID: conversationId,
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.'
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

    const payload = {
      Initiator: config.initiatorName,
      SecurityCredential: config.initiatorPassword,
      CommandID: 'TransactionReversal',
      TransactionID: params.receiptNumber,
      Amount: params.amount,
      ReceiverParty: config.shortCode,
      RecieverIdentifierType: '4', // 4 is for Shortcode
      QueueTimeOutURL: `${config.callbackUrlBase}/api/daraja/callback/reversal-timeout`,
      ResultURL: `${config.callbackUrlBase}/api/daraja/callback/reversal`,
      Remarks: params.reason,
      Occasion: 'SkylinkReversal'
    };

    const res = await fetch(`${baseUrl}/mpesa/reversal/v1/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja Reversal failed: ${errText}`);
    }

    return await res.json();
  }

  // --- 5. Query Account Balance ---
  static async queryAccountBalance() {
    const config = getEnvConfig();

    if (!config) {
      // In Mock Mode, generate a random realistic balance
      const newMockBalance = 150000 + Math.random() * 20000;
      return {
        isMock: true,
        balance: Number(newMockBalance.toFixed(2)),
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

    const payload = {
      Initiator: config.initiatorName,
      SecurityCredential: config.initiatorPassword,
      CommandID: 'AccountBalance',
      PartyA: config.shortCode,
      IdentifierType: '4',
      QueueTimeOutURL: `${config.callbackUrlBase}/api/daraja/callback/balance-timeout`,
      ResultURL: `${config.callbackUrlBase}/api/daraja/callback/balance`,
      Remarks: 'Skylink Balance Check'
    };

    const res = await fetch(`${baseUrl}/mpesa/accountbalance/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja Balance Query failed: ${errText}`);
    }

    return await res.json();
  }

  // Helper function to mock asynchronous callbacks from Safaricom locally
  private static triggerMockCallback(type: 'stk' | 'b2c' | 'reversal', payload: any) {
    setTimeout(async () => {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const callbackEndpoint = `${appUrl}/api/daraja/callback/${type}`;
        
        await fetch(callbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error(`Mock callback execution for ${type} failed:`, e);
      }
    }, 2000);
  }
}
