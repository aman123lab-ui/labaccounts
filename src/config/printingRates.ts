/**
 * Lab Accounting System - Printing Service Pricing Configuration
 * Centralized rate card per page based on print color and side mode.
 * Trivial to adjust rates in this single location.
 */
export const PRINTING_RATES = {
  bw_single: 3.0,   // Black & White, Single Sided (3 rupees / ₹3.00 per page)
  bw_double: 4.0,   // Black & White, Double Sided (4 rupees / ₹4.00 per page)
  color_single: 10.0, // Color, Single Sided (10 rupees / ₹10.00 per page)
  color_double: 20.0, // Color, Double Sided (20 rupees / ₹20.00 per page)
} as const;

export type PrintTypeOption = 'bw' | 'color';
export type PrintSideOption = 'single' | 'double';

/**
 * Calculates print job total before/after discount:
 * Rate per page * Number of Pages - Discount
 */
export function calculatePrintAmount(
  printType: PrintTypeOption,
  side: PrintSideOption,
  numPages: number,
  discount: number = 0
): { ratePerPage: number; subtotal: number; totalAmount: number } {
  const rateKey = `${printType}_${side}` as keyof typeof PRINTING_RATES;
  const ratePerPage = PRINTING_RATES[rateKey] || 1.0;
  const pages = Math.max(0, numPages);
  const subtotal = pages * ratePerPage;
  const totalAmount = Math.max(0, subtotal - Math.max(0, discount));

  return {
    ratePerPage,
    subtotal,
    totalAmount,
  };
}
