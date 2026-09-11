/**
 * Lab Accounting System - Printing Service Pricing Configuration
 * Centralized rate card per page based on print color and side mode.
 * Trivial to adjust rates in this single location.
 */
export interface PrintingRatesConfig {
  bw_single: number;
  bw_double: number;
  color_single: number;
  color_double: number;
}

export const DEFAULT_PRINTING_RATES: PrintingRatesConfig = {
  bw_single: 3.0,     // Black & White, Single Sided (₹3.00)
  bw_double: 4.0,     // Black & White, Double Sided (₹4.00)
  color_single: 10.0, // Color, Single Sided (₹10.00)
  color_double: 20.0, // Color, Double Sided (₹20.00)
};

export function getPrintingRates(): PrintingRatesConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('lab_printing_rates');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          bw_single: Number(parsed.bw_single) ?? DEFAULT_PRINTING_RATES.bw_single,
          bw_double: Number(parsed.bw_double) ?? DEFAULT_PRINTING_RATES.bw_double,
          color_single: Number(parsed.color_single) ?? DEFAULT_PRINTING_RATES.color_single,
          color_double: Number(parsed.color_double) ?? DEFAULT_PRINTING_RATES.color_double,
        };
      }
    } catch (e) {
      console.warn('Failed to parse saved printing rates:', e);
    }
  }
  return { ...DEFAULT_PRINTING_RATES };
}

export function setPrintingRates(newRates: PrintingRatesConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lab_printing_rates', JSON.stringify(newRates));
    window.dispatchEvent(new Event('lab_printing_rates_updated'));
  }
}

export const PRINTING_RATES: PrintingRatesConfig = new Proxy(DEFAULT_PRINTING_RATES, {
  get(target, prop: keyof PrintingRatesConfig) {
    const current = getPrintingRates();
    return current[prop] ?? target[prop];
  },
});

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
  const rates = getPrintingRates();
  const rateKey = `${printType}_${side}` as keyof PrintingRatesConfig;
  const ratePerPage = rates[rateKey] ?? 1.0;
  const pages = Math.max(0, numPages);
  const subtotal = pages * ratePerPage;
  const totalAmount = Math.max(0, subtotal - Math.max(0, discount));

  return {
    ratePerPage,
    subtotal,
    totalAmount,
  };
}
