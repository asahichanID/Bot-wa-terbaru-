/**
 * Masks raw WhatsApp phone numbers or JIDs for privacy
 * Example: '628123456789@s.whatsapp.net' -> '62812****789'
 */
export function maskPhoneNumber(jidOrNumber: string): string {
  if (!jidOrNumber) return 'Anonymous';
  
  // Extract digits from JID or raw number
  const clean = jidOrNumber.replace(/@.*$/, '').replace(/[^0-9]/g, '');
  if (clean.length <= 4) {
    return clean;
  }
  
  if (clean.length <= 8) {
    return clean.slice(0, 2) + '****' + clean.slice(-2);
  }
  
  // Keep first 5 and last 3-4 digits, mask the middle
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-3);
  return `${prefix}****${suffix}`;
}

export function cleanJid(jid: string): string {
  return jid.replace(/:[0-9]+@/, '@');
}
