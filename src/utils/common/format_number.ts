/**
 * Format a number with thousands separators and optional decimal places
 * @param value The number to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
const formatNumber = (value: number, decimals: number = 0): string => {
	if (!value) return '-';

	// Clamp decimals to valid range (0-20)
	const clampedDecimals = Math.max(0, Math.min(20, decimals));

	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: clampedDecimals,
		maximumFractionDigits: clampedDecimals,
	}).format(value);
};

/**
 * Format large numbers in compact form for charts and labels (e.g. 10000 → "10k", 1000000 → "1M").
 * Use for axes/tooltips to avoid truncation when values are large.
 * @param value The number to format
 * @returns Compact string like "10k", "1.5M", "2B"
 */
export const formatCompactNumber = (value: number): string => {
	if (value >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
	if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
	if (value >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
	return value.toLocaleString();
};

export default formatNumber;
