/**
 * Format a whole FCFA integer with thin space thousands separators.
 * e.g. 113000 -> "113 000" or "113 000 FCFA"
 */
export function formatMoney(amount: number | null | undefined, showUnit = false): string {
  if (amount == null || isNaN(amount)) return "0" + (showUnit ? " FCFA" : "");
  const integerAmount = Math.round(amount);
  const formatted = integerAmount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return showUnit ? `${formatted} FCFA` : formatted;
}

/**
 * Format an ISO date string (YYYY-MM-DD) into display format "31 Aug 2026".
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  // Avoid timezone shifts by splitting the YYYY-MM-DD string directly
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  if (monthIdx < 0 || monthIdx > 11 || isNaN(day) || isNaN(year)) {
    return isoDate;
  }

  return `${day} ${months[monthIdx]} ${year}`;
}

/**
 * Format date for the page header: e.g. "Wednesday 4 November 2026"
 */
export function formatHeaderDate(date: Date = new Date()): string {
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"
  ];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName} ${day} ${monthName} ${year}`;
}

