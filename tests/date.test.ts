import { test } from "node:test";
import assert from "node:assert/strict";

import { getTodayDateKey, parseRelativeDate } from "@/lib/utils/date";

test("parses DD/MM/YYYY without falling back to today", () => {
  assert.equal(parseRelativeDate("15/08/2026"), "2026-08-15");
});

test("distinguishes this Wednesday from last Wednesday", () => {
  const todayKey = getTodayDateKey();
  const today = new Date(`${todayKey}T12:00:00.000Z`);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;

  const thisWednesday = new Date(today);
  thisWednesday.setUTCDate(today.getUTCDate() - daysSinceMonday + 2);

  const lastWednesday = new Date(thisWednesday);
  lastWednesday.setUTCDate(lastWednesday.getUTCDate() - 7);

  const format = (date: Date) =>
    date.toISOString().slice(0, 10);

  assert.equal(parseRelativeDate("this Wednesday"), format(thisWednesday));
  assert.equal(parseRelativeDate("last Wednesday"), format(lastWednesday));
  assert.notEqual(parseRelativeDate("this Wednesday"), parseRelativeDate("last Wednesday"));
});
