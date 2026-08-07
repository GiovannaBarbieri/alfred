import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("pages/MyReportsPage.tsx");
const hook = read("hooks/useReportHistory.ts");

test("report list does not expose manual refresh controls", () => {
  assert.doesNotMatch(page, /Atualizando a listagem/);
  assert.doesNotMatch(page, /saved-report-refreshing/);
  assert.doesNotMatch(page, /disabled=\{history\.isRefreshing\}/);
});

test("report refresh action lives inside the saved report detail", () => {
  assert.match(page, /saved-report-update-button/);
  assert.match(page, /Atualizar relatório/);
  assert.match(page, /history\.refreshOpenReport/);
  assert.match(hook, /async function refreshOpenReport/);
  assert.match(hook, /getReportDetail\(reportId\)/);
  assert.match(hook, /viewRefreshing/);
});
