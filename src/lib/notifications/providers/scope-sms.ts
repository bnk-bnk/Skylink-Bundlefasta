import axios from 'axios';

interface ScopeSmsConfig {
  apiKey: string;
  senderId: string;
}

/**
 * Dispatches SMS payload directly to BlazeTech Scope SMS API.
 */
export async function sendScopeSms(
  phone: string,
  message: string,
  config: ScopeSmsConfig
) {
  const url = 'https://sms.blazetechscope.com/v1/sendsms';

  const payload = {
    api_key: config.apiKey,
    apiKey: config.apiKey,
    sender_id: config.senderId,
    senderid: config.senderId,
    mobile: phone,
    phone: phone,
    message: message
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'x-api-key': config.apiKey
      },
      timeout: 30000 // 30 seconds timeout
    });

    const responsePayload = response.data;
    let success = false;
    let messageId: string | null = null;
    let errorMessage: string | null = null;

    if (responsePayload) {
      const responseCode = responsePayload['response-code'] || responsePayload.responseCode;
      const responseDescription = responsePayload['response-description'] || responsePayload.responseDescription;

      // Standard success codes
      if (responseCode === 200 || String(responseCode) === '200' || responseDescription === 'Success') {
        success = true;
        messageId = String(responsePayload.messageid || responsePayload.messageId || '');
      } else {
        errorMessage = responseDescription || 'Provider rejected request';
      }
    } else {
      errorMessage = 'Empty response from provider';
    }

    return {
      success,
      messageId,
      providerResponse: responsePayload,
      errorMessage
    };
  } catch (error: any) {
    console.error('[SMS Provider Error] Failed to send SMS:', error.response?.data || error.message);
    return {
      success: false,
      messageId: null,
      providerResponse: error.response?.data || null,
      errorMessage: error.message || 'Unknown network error'
    };
  }
}
