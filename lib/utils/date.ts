/**
 * Central Date Utility for TutorLedger V2
 * Enforces Asia/Kolkata time zone for all relative date and YYYY-MM-DD calculations.
 */

export function getTodayDateKey(): string {
  return getDateKey(new Date());
}

export function getDateKey(dateInput?: Date | string | number): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) {
    return getTodayDateKey();
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function parseRelativeDate(reference: string | null | undefined): string {
  const today = getTodayDateKey();
  if (!reference) return today;

  const normalized = reference.toLowerCase().trim();

  if (normalized === "today") return today;

  if (normalized === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getDateKey(d);
  }

  if (normalized === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getDateKey(d);
  }

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  // Handle standard date strings like "August 10" or "10 Aug 2026"
  const parsed = Date.parse(reference);
  if (!Number.isNaN(parsed)) {
    return getDateKey(new Date(parsed));
  }

  return today;
}
