import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMultipleRelativeDates,
  parseRelativeDate,
} from "../lib/utils/date";

const saturday = new Date("2026-09-19T12:00:00.000Z");

test("parses Indian slash dates without falling back to today", () => {
  assert.equal(parseRelativeDate("15/08/2026", null, saturday), "2026-08-15");
});

test("distinguishes this week and last week weekdays", () => {
  assert.equal(parseRelativeDate("this Wednesday", null, saturday), "2026-09-16");
  assert.equal(parseRelativeDate("last Wednesday", null, saturday), "2026-09-09");
  assert.equal(parseRelativeDate("last week Wednesday", null, saturday), "2026-09-09");
});

test("keeps multi-date weekday parsing distinct", () => {
  assert.deepEqual(
    parseMultipleRelativeDates("Wednesday and Friday", null, saturday),
    [parseRelativeDate("Wednesday", null, saturday), parseRelativeDate("Friday", null, saturday)],
  );
});


test("parses dotted Indian dates", () => {
  assert.equal(parseRelativeDate("15.08.2026", null, saturday), "2026-08-15");
});
