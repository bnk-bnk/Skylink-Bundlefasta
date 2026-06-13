import axios from 'axios';

interface EvolutionWhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

/**
 * Dispatches WhatsApp text message to the Evolution API endpoint.
 */
export async function sendEvolutionWhatsApp(
  phone: string,
  message: string,
  config: EvolutionWhatsAppConfig
) {
  // Normalize base URL (trim trailing slashes)
  const baseUrl = config.apiUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/message/sendText/${config.instance}`;

  const payload = {
    number: phone,
    text: message,
    delay: 1000,
    linkPreview: false
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      timeout: 30000 // 30 seconds timeout
    });

    const responseData = response.data;
    let success = false;
    let messageId: string | null = null;
    let errorMessage: string | null = null;

    // Capture success on standard 200/201 HTTP responses
    if (response.status === 200 || response.status === 201) {
      success = true;
      messageId = responseData?.key?.id || responseData?.message?.key?.id || null;
    } else {
      errorMessage = `Evolution WhatsApp API responded with HTTP status ${response.status}`;
    }

    return {
      success,
      messageId,
      providerResponse: responseData,
      errorMessage
    };
  } catch (error: any) {
    console.error('[WhatsApp Provider Error] Evolution request failed:', error.response?.data || error.message);
    return {
      success: false,
      messageId: null,
      providerResponse: error.response?.data || null,
      errorMessage: error.message || 'Unknown network error'
    };
  }
}
