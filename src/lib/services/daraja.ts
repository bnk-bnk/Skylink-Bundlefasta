import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passKey: string;
  initiatorName: string;
  initiatorPassword?: string;
  certificate?: string;
  callbackUrlBase: string;
  isSandbox: boolean;
  stkCallbackUrl: string;
  b2cResultUrl: string;
  b2cTimeoutUrl: string;
  reversalResultUrl: string;
  reversalTimeoutUrl: string;
  balanceResultUrl: string;
  balanceTimeoutUrl: string;
  b2bResultUrl: string;
  b2bTimeoutUrl: string;
}

// Function to load the RSA public key certificate from environment or local root filesystem
function loadCertificate(isSandbox: boolean): string {
  if (process.env.DARAJA_CERTIFICATE) {
    return process.env.DARAJA_CERTIFICATE.trim();
  }
  
  const certFilename = isSandbox ? 'SandboxCertificate.cer' : 'ProductionCertificate.cer';
  const certPath = path.join(process.cwd(), certFilename);
  
  try {
    if (fs.existsSync(certPath)) {
      return fs.readFileSync(certPath, 'utf8').trim();
    }
  } catch (err) {
    console.error(`[Daraja Security] Failed to read certificate at ${certPath}:`, err);
  }
  
  return '';
}

// Function to encrypt Plain password to obtain the SecurityCredential parameter
function encryptSecurityCredential(password: string, certificatePem?: string): string {
  if (!password) return '';
  if (!certificatePem) {
    // If no certificate provided, fallback to raw password
    return password;
  }

  try {
    let formattedCert = certificatePem.trim();
    if (!formattedCert.includes('-----BEGIN CERTIFICATE-----') && !formattedCert.includes('-----BEGIN PUBLIC KEY-----')) {
      const cleanCert = formattedCert.replace(/\s+/g, '');
      const chunks = cleanCert.match(/.{1,64}/g) || [];
      formattedCert = `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----`;
    }

    const buffer = Buffer.from(password);
    const encrypted = crypto.publicEncrypt(
      {
        key: formattedCert,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      buffer
    );

    return encrypted.toString('base64');
  } catch (error) {
    console.error('[Daraja Security] Failed to encrypt SecurityCredential:', error);
    return password;
  }
}

// Function to normalize mobile number to 12-digit format (2547XXXXXXXX or 2541XXXXXXXX)
function normalizePesaPhone(input: string): string {
  const value = input.trim().replace(/[^\d+]/g, "");

  if (value.startsWith("+254")) {
    return value.slice(1);
  }
  if (value.startsWith("254")) {
    return value;
  }
  if (value.startsWith("0")) {
    return `254${value.slice(1)}`;
  }
  return value;
}

function sanitizeCallbackUrl(url: string): string {
  if (url.includes('localhost') || url.startsWith('http://localhost')) {
    // Look for NEXT_PUBLIC_APP_URL. If it is NOT localhost, use it!
    if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      const publicBase = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
      return url.replace(/http:\/\/localhost:\d+/, publicBase);
    }
    
    // Otherwise, check VERCEL_URL. If set, prepend https://
    if (process.env.VERCEL_URL) {
      const publicBase = `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
      return url.replace(/http:\/\/localhost:\d+/, publicBase);
    }
    
    // Default fallback
    return url.replace(/http:\/\/localhost:\d+/, 'https://skylink-bundlefasta.vercel.app');
  }
  return url;
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

  const isSandbox = (process.env.DARAJA_ENVIRONMENT || process.env.DARAJA_ENV || 'sandbox').trim().toLowerCase() !== 'production';
  const cert = loadCertificate(isSandbox);

  return {
    consumerKey,
    consumerSecret,
    shortCode,
    passKey,
    initiatorName,
    initiatorPassword: process.env.DARAJA_INITIATOR_PASSWORD || 'P@ssword123',
    certificate: cert,
    callbackUrlBase,
    isSandbox,
    stkCallbackUrl: sanitizeCallbackUrl(process.env.DARAJA_CALLBACK_URL || `${callbackUrlBase}/api/daraja/callback/stk`),
    b2cResultUrl: sanitizeCallbackUrl(process.env.DARAJA_B2C_RESULT_URL || `${callbackUrlBase}/api/daraja/callback/b2c`),
    b2cTimeoutUrl: sanitizeCallbackUrl(process.env.DARAJA_B2C_TIMEOUT_URL || `${callbackUrlBase}/api/daraja/callback/b2c-timeout`),
    reversalResultUrl: sanitizeCallbackUrl(process.env.DARAJA_REVERSAL_RESULT_URL || `${callbackUrlBase}/api/daraja/callback/reversal`),
    reversalTimeoutUrl: sanitizeCallbackUrl(process.env.DARAJA_REVERSAL_TIMEOUT_URL || `${callbackUrlBase}/api/daraja/callback/reversal-timeout`),
    balanceResultUrl: sanitizeCallbackUrl(process.env.DARAJA_BALANCE_RESULT_URL || `${callbackUrlBase}/api/daraja/callback/balance`),
    balanceTimeoutUrl: sanitizeCallbackUrl(process.env.DARAJA_BALANCE_TIMEOUT_URL || `${callbackUrlBase}/api/daraja/callback/balance-timeout`),
    b2bResultUrl: sanitizeCallbackUrl(process.env.DARAJA_B2B_RESULT_URL || `${callbackUrlBase}/api/mpesa/b2b/result`),
    b2bTimeoutUrl: sanitizeCallbackUrl(process.env.DARAJA_B2B_TIMEOUT_URL || `${callbackUrlBase}/api/mpesa/b2b/timeout`),
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

let cachedToken: { token: string; expiresAt: number } | null = null;

export class DarajaService {
  private static async getOAuthToken(config: DarajaConfig): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
      return cachedToken.token;
    }

    const baseUrl = config.isSandbox 
      ? 'https://sandbox.safaricom.co.ke' 
      : 'https://api.safaricom.co.ke';
    
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

    const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to generate Daraja token: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    
    if (data.access_token && data.expires_in) {
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + Number(data.expires_in) * 1000,
      };
    }
    
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

    const formattedPhone = normalizePesaPhone(params.phoneNumber);

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
      CallBackURL: config.stkCallbackUrl,
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
    const formattedPhone = normalizePesaPhone(params.phoneNumber);

    if (!config) {
      const conversationId = `B2C_CON_${crypto.randomBytes(8).toString('hex')}`;
      const originatorConversationId = `B2C_ORI_${crypto.randomBytes(8).toString('hex')}`;

      // Simulate B2C Callback using Key/Value format
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
              { Key: 'TransactionAmount', Value: params.amount },
              { Key: 'ReceiverPartyPublicName', Value: formattedPhone },
              { Key: 'TransactionReceipt', Value: `NL${crypto.randomBytes(4).toString('hex').toUpperCase()}8D9` }
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

    const securityCredential = encryptSecurityCredential(config.initiatorPassword || '', config.certificate);

    const originatorConversationId = `B2C_ORI_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    const payload = {
      InitiatorName: config.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: process.env.DARAJA_B2C_COMMAND_ID || 'PromotionPayment',
      Amount: params.amount,
      PartyA: config.shortCode,
      PartyB: formattedPhone,
      Remarks: params.remarks,
      QueueTimeOutURL: config.b2cTimeoutUrl,
      ResultURL: config.b2cResultUrl,
      Occasion: 'SkylinkPayout',
      OriginatorConversationID: originatorConversationId
    };

    const res = await fetch(`${baseUrl}/mpesa/b2c/v3/paymentrequest`, {
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

    const result = await res.json();
    return {
      ...result,
      OriginatorConversationID: result.OriginatorConversationID || originatorConversationId
    };
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
      
      // Simulate Reversal Callback using Key/Value format
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
              { Key: 'Amount', Value: params.amount },
              { Key: 'Receipt', Value: params.receiptNumber }
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

    const securityCredential = encryptSecurityCredential(config.initiatorPassword || '', config.certificate);

    const payload = {
      Initiator: config.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'TransactionReversal',
      TransactionID: params.receiptNumber,
      Amount: params.amount,
      ReceiverParty: config.shortCode,
      RecieverIdentifierType: '11', // 11 is for shortcode under reversals
      QueueTimeOutURL: config.reversalTimeoutUrl,
      ResultURL: config.reversalResultUrl,
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
      const newMockBalance = 150000 + Math.random() * 20000;
      
      // Trigger async mock callback for balance to populate balance snapshots
      this.triggerMockCallback('balance', {
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully',
          OriginatorConversationID: `BAL_ORI_${crypto.randomBytes(8).toString('hex')}`,
          ConversationID: `BAL_CON_${crypto.randomBytes(8).toString('hex')}`,
          TransactionID: `BAL${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          ResultParameters: {
            ResultParameter: [
              {
                Key: 'AccountBalance',
                Value: `Working Account|KES|${newMockBalance.toFixed(2)}|${newMockBalance.toFixed(2)}|0.00|0.00&Float Account|KES|0.00|0.00|0.00|0.00&Utility Account|KES|${(newMockBalance - 2500).toFixed(2)}|${(newMockBalance - 2500).toFixed(2)}|0.00|0.00`
              },
              {
                Key: 'BOCompletedTime',
                Value: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
              }
            ]
          }
        }
      });

      return {
        isMock: true,
        balance: Number((newMockBalance - 2500).toFixed(2)), // Default to Utility Balance
      };
    }

    const token = await this.getOAuthToken(config);
    const baseUrl = config.isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

    const securityCredential = encryptSecurityCredential(config.initiatorPassword || '', config.certificate);

    const payload = {
      Initiator: config.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'AccountBalance',
      PartyA: config.shortCode,
      IdentifierType: '4',
      QueueTimeOutURL: config.balanceTimeoutUrl,
      ResultURL: config.balanceResultUrl,
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

  // --- 6. B2B Settlement Payout ---
  static async initiateB2b(params: {
    destinationType: 'Till' | 'PayBill';
    destinationShortcode: string;
    amount: number;
    accountReference: string;
    remarks: string;
  }) {
    const config = getEnvConfig();

    const commandId = params.destinationType === 'Till' ? 'BusinessBuyGoods' : 'BusinessPayBill';
    const receiverIdentifierType = params.destinationType === 'Till' ? '2' : '4';

    if (!config) {
      const conversationId = `B2B_CON_${crypto.randomBytes(8).toString('hex')}`;
      const originatorConversationId = `B2B_ORI_${crypto.randomBytes(8).toString('hex')}`;

      // Simulate B2B Callback
      this.triggerMockCallback('b2b', {
        Result: {
          ResultType: 0,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          OriginatorConversationID: originatorConversationId,
          ConversationID: conversationId,
          TransactionID: `B2B${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          ResultParameters: {
            ResultParameter: [
              { Key: 'InitiatorAccountCurrentBalance', Value: 950000 },
              { Key: 'TransactionReceipt', Value: `NL${crypto.randomBytes(4).toString('hex').toUpperCase()}8D9` }
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

    const securityCredential = encryptSecurityCredential(config.initiatorPassword || '', config.certificate);

    const payload = {
      Initiator: config.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandId,
      SenderIdentifierType: '4', // Shortcode
      RecieverIdentifierType: receiverIdentifierType,
      Amount: params.amount,
      PartyA: config.shortCode,
      PartyB: params.destinationShortcode,
      AccountReference: params.accountReference,
      Remarks: params.remarks,
      QueueTimeOutURL: config.b2bTimeoutUrl,
      ResultURL: config.b2bResultUrl,
    };

    const res = await fetch(`${baseUrl}/mpesa/b2b/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Daraja B2B Payment failed: ${errText}`);
    }

    return await res.json();
  }

  // Helper function to mock asynchronous callbacks from Safaricom locally
  private static triggerMockCallback(type: 'stk' | 'b2c' | 'reversal' | 'balance' | 'b2b', payload: any) {
    setTimeout(async () => {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const callbackEndpoint = type === 'b2b'
          ? `${appUrl}/api/mpesa/b2b/result`
          : `${appUrl}/api/daraja/callback/${type}`;
        
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
