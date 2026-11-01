/**
 * Telegram requires an international phone number. Accept the common local
 * Chinese format as a convenience, while preserving already-normalized input.
 */
export function normalizeTelegramPhone(phone) {
  const value = String(phone ?? "")
    .trim()
    .replace(/[()\s-]/g, "");

  if (/^\+\d{7,15}$/.test(value)) return value;
  if (/^0086\d{11}$/.test(value)) return `+${value.slice(2)}`;
  if (/^86\d{11}$/.test(value)) return `+${value}`;
  if (/^1[3-9]\d{9}$/.test(value)) return `+86${value}`;
  return value;
}
