import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateLedgerBalance,
  calculateMonthlyAccruedFee,
} from "../lib/services/billing";

test("monthly billing accrues each calendar month from first evidence through current month", () => {
  assert.equal(
    calculateMonthlyAccruedFee(2000, "2026-09", ["2026-07-10"]),
    6000,
  );
  assert.deepEqual(calculateLedgerBalance(6000, 2000), {
    outstanding: 4000,
    credit: 0,
  });
});

test("monthly billing with no history starts in the current month", () => {
  assert.equal(calculateMonthlyAccruedFee(2000, "2026-09", []), 2000);
});

test("monthly billing uses explicit enrollment month even when there is no activity history", () => {
  assert.equal(
    calculateMonthlyAccruedFee(2000, "2026-11", [], "2026-09"),
    6000,
  );
});

test("an explicit future billing month does not accrue fees before enrollment", () => {
  assert.equal(
    calculateMonthlyAccruedFee(2000, "2026-09", ["2026-07-10"], "2026-10"),
    6000,
  );
});

test("classwise surplus becomes visible credit instead of negative due", () => {
  assert.deepEqual(calculateLedgerBalance(300, 1200), {
    outstanding: 0,
    credit: 900,
  });
});

test("collected exactly equals accrued means no due and no credit", () => {
  assert.deepEqual(calculateLedgerBalance(900, 900), {
    outstanding: 0,
    credit: 0,
  });
});


test("monthly billing keeps future months due after partial monthly collections", () => {
  assert.deepEqual(calculateLedgerBalance(6000, 4000), {
    outstanding: 2000,
    credit: 0,
  });
});