export const UPI_CONFIG = {
  upiId: process.env.NEXT_PUBLIC_UPI_ID || 'muhammedanfaz123-1@oksbi',
  orgName: process.env.NEXT_PUBLIC_ORG_NAME || 'Aman Lab Printing Service',
  currency: 'INR',
  defaultNote: 'Print Cash',
};

/**
 * Builds standard universal P2P UPI QR URL for individual accounts.
 * Format: upi://pay?pa=muhammedanfaz123-1@oksbi&pn=Aman%20Lab%20Printing%20Service&am=<amount>&cu=INR&tn=Print%20Cash
 * 
 * @param amount - Payment amount in INR (optional)
 * @param note - Transaction note/description (defaults to "Print Cash")
 * @param includeAmount - Flag to include or omit the `am` parameter
 */
export function buildUpiQrUrl(
  amount?: number,
  note: string = 'Print Cash',
  includeAmount: boolean = true
): string {
  const pa = UPI_CONFIG.upiId.trim();
  const pn = encodeURIComponent(UPI_CONFIG.orgName.trim());
  const cu = UPI_CONFIG.currency;
  const tn = encodeURIComponent(note.trim());

  let qrUrl = `upi://pay?pa=${pa}&pn=${pn}`;

  if (includeAmount && amount !== undefined && amount > 0) {
    const am = amount.toFixed(2);
    qrUrl += `&am=${am}`;
  }

  qrUrl += `&cu=${cu}&tn=${tn}`;

  if (typeof window !== 'undefined') {
    console.log('[Universal P2P Scannable QR Code URL]:', qrUrl);
  }

  return qrUrl;
}

/**
 * Builds standard UPI Intent URI for mobile deep links.
 * Uses the exact same builder function as QR code to guarantee synchronization.
 */
export function buildUpiIntentUrl(amount: number, note: string = 'Print Cash'): string {
  return buildUpiQrUrl(amount, note, true);
}
