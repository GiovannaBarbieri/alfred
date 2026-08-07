import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const hook = read("hooks/useReportHistory.ts");
const filters = read("components/my-reports/ReportFilters.tsx");

test("year filter defaults to the current year and clears back to it", () => {
  assert.match(hook, /year: currentYearFilter\(\)/);
  assert.match(hook, /function currentYearFilter\(\)/);
  assert.match(hook, /new Date\(\)\.getFullYear\(\)/);
  assert.match(hook, /setDraft\(defaultFilters\)/);
  assert.match(hook, /setApplied\(defaultFilters\)/);
});

test("year options keep all-years and individual years from 2020 to current year", () => {
  assert.match(filters, /<option value="">Todos os anos<\/option>/);
  assert.match(filters, /MIN_REPORT_YEAR = 2020/);
  assert.match(filters, /currentYear - MIN_REPORT_YEAR \+ 1/);
  assert.match(filters, /MIN_REPORT_YEAR \+ index/);
  assert.doesNotMatch(filters, /1999|2000|2019/);
});
