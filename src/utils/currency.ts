/**
 * Currency utility for Indian Rupees (₹)
 */
export function formatINR(amount: number, includeDecimals = true): string {
  if (isNaN(amount)) return '₹0';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatted = absAmount.toLocaleString('en-IN', {
    minimumFractionDigits: includeDecimals ? (absAmount % 1 !== 0 ? 2 : 0) : 0,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}₹${formatted}`;
}
