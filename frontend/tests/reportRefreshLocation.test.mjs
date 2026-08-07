import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("pages/MyReportsPage.tsx");
const hook = read("hooks/useReportHistory.ts");
const service = read("services/reportHistoryService.ts");
const modal = read("components/my-reports/ReportUpdatePeriodModal.tsx");

test("report list does not expose manual refresh controls", () => {
  assert.doesNotMatch(page, /Atualizando a listagem/);
  assert.doesNotMatch(page, /saved-report-refreshing/);
  assert.doesNotMatch(page, /disabled=\{history\.isRefreshing\}/);
});

test("report refresh action lives inside the saved report detail", () => {
  assert.match(page, /saved-report-update-button/);
  assert.match(page, /Atualizar relatório/);
  assert.match(page, /history\.requestReportUpdate/);
  assert.match(page, /ReportUpdatePeriodModal/);
  assert.match(page, /history\.refreshOpenReport/);
  assert.match(hook, /setUpdatePeriodDraft/);
  assert.match(hook, /periodStart\.slice\(0, 10\)/);
  assert.match(hook, /periodEnd\.slice\(0, 10\)/);
  assert.match(hook, /async function refreshOpenReport/);
  assert.match(hook, /updateReport\(reportId/);
  assert.match(hook, /viewRefreshing/);
  assert.match(service, /\/general-indicators\/reports\/\$\{id\}\/update/);
  assert.match(modal, /Data inicial/);
  assert.match(modal, /Data final/);
  assert.match(modal, /A data final não pode ser anterior à data inicial\./);
});
