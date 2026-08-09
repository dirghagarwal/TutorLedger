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

export function formatDisplayDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

function sanitizePromptForDates(text: string): string {
  let cleaned = text.toLowerCase();
  // Strip out negations such as "not yesterday", "not today", "not monday", "instead of yesterday"
  cleaned = cleaned.replaceAll(/not\s+(?:yesterday|today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|wed|thu|fri|sat|sun)\b/gi, "");
  cleaned = cleaned.replaceAll(/instead\s+of\s+(?:yesterday|today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "");
  return cleaned;
}

export function parseRelativeDate(
  reference?: string | null,
  fullPrompt?: string | null
): string {
  const rawInput = `${reference ?? ""} ${fullPrompt ?? ""}`.trim();
  if (!rawInput) return getTodayDateKey();

  const cleaned = sanitizePromptForDates(rawInput);

  // 1. Explicit ISO Date (YYYY-MM-DD)
  const isoMatch = cleaned.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) return isoMatch[1];

  // 2. Explicit Natural Date ("5 August", "5th Aug", "August 5", "Aug 5th")
  const naturalMatch1 = cleaned.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i);
  if (naturalMatch1) {
    const day = Number(naturalMatch1[1]);
    const monthStr = naturalMatch1[2]?.toLowerCase() ?? "";
    const month = MONTHS[monthStr];
    const year = naturalMatch1[3] ? Number(naturalMatch1[3]) : 2026;
    if (month !== undefined && !Number.isNaN(day)) {
      const d = new Date(Date.UTC(year, month, day));
      return getDateKey(d);
    }
  }

  const naturalMatch2 = cleaned.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
  if (naturalMatch2) {
    const monthStr = naturalMatch2[1]?.toLowerCase() ?? "";
    const day = Number(naturalMatch2[2]);
    const month = MONTHS[monthStr];
    const year = naturalMatch2[3] ? Number(naturalMatch2[3]) : 2026;
    if (month !== undefined && !Number.isNaN(day)) {
      const d = new Date(Date.UTC(year, month, day));
      return getDateKey(d);
    }
  }

  // Get current Kolkata date context
  const todayKey = getTodayDateKey();
  const todayDateObj = new Date(`${todayKey}T12:00:00.000Z`);
  const currentDayOfWeek = todayDateObj.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // 3. Weekday with Future Modifier ("next Wednesday", "next Monday")
  const nextWeekdayMatch = cleaned.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i);
  if (nextWeekdayMatch?.[1]) {
    const targetDay = WEEKDAYS[nextWeekdayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      let diff = (targetDay - currentDayOfWeek + 7) % 7;
      if (diff === 0) diff = 7;
      const targetDate = new Date(todayDateObj);
      targetDate.setUTCDate(todayDateObj.getUTCDate() + diff);
      return getDateKey(targetDate);
    }
  }

  // 4. Weekday with Past/Recent Modifier ("Wednesday", "on Wednesday", "last Wednesday", "this Wednesday")
  const weekdayMatch = cleaned.match(/\b(?:last\s+|this\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i);
  if (weekdayMatch?.[1]) {
    const targetDay = WEEKDAYS[weekdayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const diff = (currentDayOfWeek - targetDay + 7) % 7;
      const targetDate = new Date(todayDateObj);
      targetDate.setUTCDate(todayDateObj.getUTCDate() - diff);
      return getDateKey(targetDate);
    }
  }

  // 5. Relative Words ("today", "yesterday", "tomorrow", "N days ago")
  if (/\btoday\b/i.test(cleaned)) {
    return todayKey;
  }

  if (/\byesterday\b/i.test(cleaned)) {
    const d = new Date(todayDateObj);
    d.setUTCDate(d.getUTCDate() - 1);
    return getDateKey(d);
  }

  if (/\btomorrow\b/i.test(cleaned)) {
    const d = new Date(todayDateObj);
    d.setUTCDate(d.getUTCDate() + 1);
    return getDateKey(d);
  }

  const daysAgoMatch = cleaned.match(/\b(\d+|two|three|four|five)\s+days?\s+ago\b/i);
  if (daysAgoMatch?.[1]) {
    let num = Number(daysAgoMatch[1]);
    if (Number.isNaN(num)) {
      const wordMap: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
      num = wordMap[daysAgoMatch[1].toLowerCase()] ?? 2;
    }
    const d = new Date(todayDateObj);
    d.setUTCDate(d.getUTCDate() - num);
    return getDateKey(d);
  }

  return todayKey;
}
