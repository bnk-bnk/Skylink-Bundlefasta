/**
 * Safaricom Daraja API Error & Result Codes Dictionary
 * Direct reference mappings from Daraja Portal Documentation.
 */

// B2C Result Codes returned in the callback payload (Result.ResultCode)
export const B2C_RESULT_CODES: Record<string | number, string> = {
  0: 'The service request is processed successfully.',
  1: 'The balance is insufficient for the transaction.',
  2: 'Declined due to limit rule (Transaction amount smaller than allowed minimum).',
  3: 'Declined due to limit rule: greater than the maximum transaction amount.',
  4: 'Declined due to limit rule: would exceed daily transfer limit (Currently Ksh 500,000 for customer).',
  8: 'Declined due to limit rule: would exceed the maximum balance (Currently Ksh 500,000).',
  11: 'The DebitParty is in an invalid state (B2C shortcode account is inactive).',
  21: 'The initiator is not allowed to initiate this request (Lacks ORG B2C API initiator role).',
  2001: 'The initiator information is invalid (Invalid credentials or password encryption).',
  2006: 'Declined due to account rule: The account status does not allow this transaction.',
  2028: 'The request is not permitted according to product assignment (Short code lacks B2C permission).',
  2040: "Credit Party customer type can't be supported by the service (Customer is unregistered).",
  8006: 'The security credential is locked (API user password locked).',
  SFC_IC0003: 'The operator does not exist (Invalid phone number or not registered on M-PESA).',
};

// Reversal Result Codes returned in the callback payload (Result.ResultCode)
export const REVERSAL_RESULT_CODES: Record<string | number, string> = {
  0: 'The service request is processed successfully.',
  R000001: 'The transaction has already been reversed.',
  R000002: 'The OriginalTransactionID is invalid or does not exist on M-PESA.',
  1: 'The balance is insufficient (Short code has insufficient funds).',
  11: 'The DebitParty is in an invalid state (Short code account is inactive).',
  21: 'The initiator is not allowed to initiate (Lacks Org Reversals Initiator role).',
  2001: 'The initiator information is invalid (Invalid credentials).',
  2006: 'Declined due to account rule (Organization account is inactive).',
  2028: 'Not permitted according to product assignment (Short code has no reversal permissions).',
  8006: 'The security credential is locked (API user password locked).',
};

// General Daraja Error Codes returned on synchronous API request failures
export const DARAJA_API_ERROR_CODES: Record<string, string> = {
  '400.002.02': 'Bad Request - Invalid payload or parameters.',
  '401.002.01': 'Error Occurred - Invalid Access Token (Expired or wrong credentials).',
  '404.002.01': 'Resource not found - Incorrect API endpoint URL.',
  '405.001': 'Method Not Allowed - Ensure request is sent as a POST request.',
  '500.002.1001': 'Duplicate OriginatorConversationID - Transaction request ID must be unique.',
  '500.003.02': 'Error Occurred: Spike Arrest Violation - Exceeded allowed Transactions Per Second (TPS).',
  '500.003.03': 'Error Occurred: Quota Violation - Exceeded the allowed API request limits.',
  '500.003.1001': 'Internal Server Error - Safaricom M-Pesa system maintenance or error.',
};

// Account Balance Callback Result Codes
export const BALANCE_RESULT_CODES: Record<string | number, string> = {
  0: 'The service request is processed successfully.',
  15: 'Duplicate Detected - OriginatorConversationID has been seen before.',
  17: 'Internal Failure - Catch-all for unresolved failures on Safaricom side.',
  18: 'Initiator Credential Check Failure - Failed password check or decryption issue.',
  20: 'Unresolved Initiator - Initiator username cannot be found.',
  21: 'Initiator to Primary Party Permission Failure - Initiator lacks rights to query the shortcode.',
  22: 'Initiator to Receiver Party Permission Failure - Initiator username received but not active.',
  24: 'Missing mandatory fields - Required input parameters are missing.',
  25: 'InvalidRequestParameters - Parameter conversion or validation failed.',
  26: 'Traffic blocking condition in place - System too busy.',
  29: 'InvalidCommand - The command specified is not defined.',
};

/**
 * Gets a friendly explanation for a B2C Result Code
 */
export function getB2cErrorMessage(code: string | number | undefined | null): string {
  if (code === undefined || code === null) return 'Unknown error occurred.';
  return B2C_RESULT_CODES[code] || `Error Code ${code}: Unknown response from M-Pesa.`;
}

/**
 * Gets a friendly explanation for a Reversal Result Code
 */
export function getReversalErrorMessage(code: string | number | undefined | null): string {
  if (code === undefined || code === null) return 'Unknown error occurred.';
  return REVERSAL_RESULT_CODES[code] || `Error Code ${code}: Unknown response from M-Pesa.`;
}

/**
 * Gets a friendly explanation for a general Daraja API Error Code
 */
export function getGeneralApiErrorMessage(code: string | undefined | null): string {
  if (!code) return 'API request failed.';
  return DARAJA_API_ERROR_CODES[code] || `Error Code ${code}: API request rejected.`;
}
