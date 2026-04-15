import test from "node:test";
import assert from "node:assert/strict";

import { computeCenteredHotzonePosition } from "../../src/main/first-run-hotzone.js";

test("computeCenteredHotzonePosition centers within workArea and keeps header visible", () => {
  const pos = computeCenteredHotzonePosition(
    { x: 0, y: 0, width: 1920, height: 1080 },
    { width: 200, height: 300, headerHeight: 28 }
  );
  assert.deepEqual(pos, { x: 860, y: 390 });
});

test("computeCenteredHotzonePosition clamps when workArea too small", () => {
  const pos = computeCenteredHotzonePosition(
    { x: 0, y: 0, width: 200, height: 100 },
    { width: 260, height: 180, headerHeight: 28 }
  );
  assert.deepEqual(pos, { x: 0, y: 28 });
});

