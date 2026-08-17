/**
 * Currency localization utility for Indian Rupee (INR) formatting.
 * Uses Intl.NumberFormat with 'en-IN' locale for standard Indian numbering format (e.g. ₹1,23,456.00).
 */
export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

/**
 * Alternative compact numerical formatter without symbol for compact table columns or print templates.
 */
export function formatAmount(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

/**
 * Formats a student's ledger balance accounting for positive (debit / owes org)
 * and negative (credit / overpaid / refund due to student).
 */
export function formatStudentBalance(
  balance: number | null | undefined,
  options?: { showDrCr?: boolean; context?: 'portal' | 'admin' | 'report' }
): {
  formatted: string;
  label: string;
  isCredit: boolean;
  isZero: boolean;
  rawAbs: number;
} {
  const bal = Number(balance) || 0;
  const absVal = Math.abs(bal);
  const formattedAbs = formatCurrency(absVal);

  if (bal > 0) {
    return {
      formatted: options?.showDrCr ? `${formattedAbs} Dr` : formattedAbs,
      label: 'Amount Owed by Student',
      isCredit: false,
      isZero: false,
      rawAbs: absVal,
    };
  } else if (bal < 0) {
    return {
      formatted: options?.showDrCr ? `${formattedAbs} Cr` : formattedAbs,
      label:
        options?.context === 'portal'
          ? 'Credit Balance — Amount Owed to You'
          : 'Amount Owed to Student (Refund Due)',
      isCredit: true,
      isZero: false,
      rawAbs: absVal,
    };
  } else {
    return {
      formatted: formatCurrency(0),
      label: 'Settled (₹0.00)',
      isCredit: false,
      isZero: true,
      rawAbs: 0,
    };
  }
}

