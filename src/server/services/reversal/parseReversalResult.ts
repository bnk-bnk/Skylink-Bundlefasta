export interface ParsedReversalResult {
  resultCode: string;
  resultDesc: string;
  reversalReceipt?: string; // Safaricom receipt number of the reversal itself
  rawParams: Record<string, any>;
}

/**
 * Extracts and parses the Reversal callback parameters from Safaricom.
 */
export function parseReversalResult(payload: any): ParsedReversalResult {
  const result = payload?.Result;
  if (!result) {
    throw new Error('Invalid webhook payload structure: Missing Result object.');
  }

  const parsed: ParsedReversalResult = {
    resultCode: result.ResultCode?.toString() || 'unknown',
    resultDesc: result.ResultDesc || '',
    rawParams: {}
  };

  // The TransactionID returned in the root of Result is the new receipt number of the Reversal transaction
  if (result.TransactionID) {
    parsed.reversalReceipt = result.TransactionID;
  }

  const params = result.ResultParameters?.ResultParameter || [];
  
  // Normalise parameters if single object or array
  const paramList = Array.isArray(params) ? params : [params].filter(Boolean);

  for (const p of paramList) {
    const name = p.Name || p.Key;
    const val = p.Value;
    if (!name || val === undefined) continue;

    parsed.rawParams[name] = val;
  }

  return parsed;
}
