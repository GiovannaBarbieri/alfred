import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/components/general-indicators/GeneralIndicatorLineChartPrimitives.tsx", import.meta.url), "utf8");

test("line chart labels highlight first, min, max and last points", () => {
  assert.match(source, /highlighted\.add\(values\[0\]\.index\)/);
  assert.match(source, /highlighted\.add\(max\.index\)/);
  assert.match(source, /highlighted\.add\(min\.index\)/);
  assert.match(source, /highlighted\.add\(values\[values\.length - 1\]\.index\)/);
});

test("line chart label positioning uses offsets around the marker", () => {
  assert.match(source, /labelOffsetForIndex/);
  assert.match(source, /x=\{Number\(x\) \+ offsets\.dx\}/);
  assert.match(source, /y=\{Number\(y\) \+ offsets\.dy\}/);
  assert.match(source, /textAnchor=\{offsets\.anchor\}/);
});
