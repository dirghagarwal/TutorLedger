export interface LedgerBalance {
  outstanding: number;
  credit: number;
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function countInclusiveCalendarMonths(startMonth: string, endMonth: string): number {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  if (!start || !end) return 1;
  const count = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  return Math.max(1, count);
}

export function getEarliestBillingMonth(
  currentMonth: string,
  historicalDates: readonly string[],
  explicitStartMonth?: string | null,
): string {
  const current = parseMonthKey(currentMonth);
  if (!current) return currentMonth;

  const explicit = explicitStartMonth && parseMonthKey(explicitStartMonth);
  if (explicit && explicit <= currentMonth) return explicitStartMonth;

  let earliest = currentMonth;
  for (const date of historicalDates) {
    const candidate = getMonthKey(date);
    if (!parseMonthKey(candidate) || candidate > currentMonth) continue;
    if (!parseMonthKey(earliest) || candidate < earliest) earliest = candidate;
  }
  return earliest;
}

export function calculateMonthlyAccruedFee(
  monthlyFee: number,
  currentMonth: string,
  historicalDates: readonly string[],
  explicitStartMonth?: string | null,
): number {
  const explicit = explicitStartMonth && parseMonthKey(explicitStartMonth);
  const current = parseMonthKey(currentMonth);
  if (explicit && current && explicitStartMonth > currentMonth) return 0;

  const startMonth = getEarliestBillingMonth(currentMonth, historicalDates, explicitStartMonth);
  return Math.max(0, monthlyFee) * countInclusiveCalendarMonths(startMonth, currentMonth);
}

export function calculateLedgerBalance(
  accrued: number,
  collected: number,
): LedgerBalance {
  const outstanding = Math.max(0, accrued - collected);
  const credit = Math.max(0, collected - accrued);
  return { outstanding, credit };
}
