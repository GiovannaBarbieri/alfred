import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const service = readFileSync(new URL("../src/services/reportHistoryService.ts", import.meta.url), "utf8");

test("delete report requests cannot keep the modal processing forever", () => {
  assert.match(service, /REPORT_DELETE_TIMEOUT_MS = 45_000/);
  assert.match(service, /AbortController/);
  assert.match(service, /timeoutMs: REPORT_DELETE_TIMEOUT_MS/);
  assert.match(service, /status === 408/);
});
