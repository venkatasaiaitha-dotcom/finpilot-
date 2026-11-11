/**
 * Currency utilities for Indian Rupees (₹) and PayPal USD conversion
 */
export const DEFAULT_INR_PER_USD = 84.5;

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

export function formatUSD(amount: number): string {
  if (isNaN(amount)) return '$0.00';
  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function convertINRtoUSD(amountINR: number, inrPerUsd = DEFAULT_INR_PER_USD): string {
  const rate = inrPerUsd > 0 ? inrPerUsd : DEFAULT_INR_PER_USD;
  const usd = Math.max(0.01, Number(amountINR || 0) / rate);
  return usd.toFixed(2);
}

export function convertUSDtoINR(amountUSD: number, inrPerUsd = DEFAULT_INR_PER_USD): number {
  const rate = inrPerUsd > 0 ? inrPerUsd : DEFAULT_INR_PER_USD;
  return Math.round(Number(amountUSD || 0) * rate * 100) / 100;
}
