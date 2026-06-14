// Helper to humanize system identifiers dynamically with an optional override map
export function humanizeIdentifier(value: string | null | undefined): string {
  if (!value) return '';
  const overrides: Record<string, string> = {
    'mini_site': 'Mini Sites',
    'whatsapp_bot': 'WhatsApp Bot',
    'whatsapp_agents': 'WhatsApp Agents',
    'whatsapp_auto_post': 'WhatsApp Auto Post',
    'requested_poster': 'Requested Posters',
    'bundle': 'Bundles',
    'video_ads': 'Video Ads',
    'wallet': 'Wallet',
    'wallet_withdrawal': 'Wallet Withdrawal',
    'pesatrix_activation': 'Pesatrix Activation',
    'pesatrix_wallet_withdrawal': 'Pesatrix Wallet Withdrawal',
    'activation': 'Activation',
    'withdrawal': 'Withdrawal',
    'account_activation': 'Account Activations'
  };

  const cleanVal = value.trim();
  if (overrides[cleanVal]) {
    return overrides[cleanVal];
  }
  if (overrides[cleanVal.toLowerCase()]) {
    return overrides[cleanVal.toLowerCase()];
  }

  return cleanVal
    .split(/[_\-\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper to format system values to human readable labels
export function getReadableLabel(value: string | null | undefined): string {
  if (!value) return '';
  const mapping: Record<string, string> = {
    'bingwaone': 'BingwaOne',
    'bingwazone': 'BingwaZone',
    'pesatrix': 'Pesatrix',
    'unknown': 'Unknown',
    'manual': 'Manual'
  };
  
  const cleanVal = value.trim();
  if (mapping[cleanVal]) return mapping[cleanVal];
  if (mapping[cleanVal.toLowerCase()]) return mapping[cleanVal.toLowerCase()];

  return humanizeIdentifier(cleanVal);
}
