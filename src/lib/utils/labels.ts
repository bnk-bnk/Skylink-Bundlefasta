// Helper to format system values to human readable labels
export function getReadableLabel(value: string | null | undefined): string {
  if (!value) return '';
  const mapping: Record<string, string> = {
    'bingwazone': 'BingwaZone',
    'pesatrix': 'Pesatrix',
    'unknown': 'Unknown',
    'manual': 'Manual',
    'mini_site': 'Mini Sites',
    'whatsapp_bot': 'WhatsApp Bot',
    'whatsapp_agents': 'WhatsApp Agents',
    'whatsapp_auto_post': 'WhatsApp Auto Post',
    'requested_poster': 'Requested Posters',
    'bundle': 'Bundles',
    'wallet': 'Wallet',
    'account_activation': 'Account Activations',
    'wallet_withdrawal': 'Wallet Withdrawal',
    'pesatrix_activation': 'Pesatrix Activation',
    'pesatrix_wallet_withdrawal': 'Pesatrix Wallet Withdrawal',
    'activation': 'Activation',
    'withdrawal': 'Withdrawal'
  };
  return mapping[value] || value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
