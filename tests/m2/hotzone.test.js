import test from "node:test";
import assert from "node:assert/strict";

import {
  getHotzoneRect,
  isPointBeyondCancelRegion,
  isPointInHotzone
} from "../../src/main/hotzone.js";

test("builds top-edge hotzone rectangle", () => {
  const rect = getHotzoneRect(
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  assert.deepEqual(rect, { x: 860, y: 0, width: 200, height: 300 });
});

test("builds hotzone rectangle from explicit x y", () => {
  const rect = getHotzoneRect(
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 240, heightPx: 260, cancelRegionPx: 48, xPx: 120, yPx: 16 }
  );

  assert.deepEqual(rect, { x: 120, y: 16, width: 240, height: 260 });
});

test("clamps hotzone rectangle within display", () => {
  const rect = getHotzoneRect(
    { x: 0, y: 0, width: 400, height: 300 },
    { edge: "top", widthPx: 500, heightPx: 600, cancelRegionPx: 48, xPx: -50, yPx: -20 }
  );

  assert.deepEqual(rect, { x: 0, y: 0, width: 400, height: 300 });
});

test("detects point inside top-edge hotzone", () => {
  const inside = isPointInHotzone(
    { x: 960, y: 20 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  const outside = isPointInHotzone(
    { x: 100, y: 120 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  assert.equal(inside, true);
  assert.equal(outside, false);
});

test("detects point outside 200 width hotzone", () => {
  const outside = isPointInHotzone(
    { x: 100, y: 20 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  assert.equal(outside, false);
});

test("keeps top hotzone behavior regardless of edge input", () => {
  const inside = isPointInHotzone(
    { x: 900, y: 20 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "left", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  assert.equal(inside, true);
});

test("detects cancel threshold for top-edge hotzone", () => {
  const cancelled = isPointBeyondCancelRegion(
    { x: 200, y: 150 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  const stillActive = isPointBeyondCancelRegion(
    { x: 200, y: 90 },
    { x: 0, y: 0, width: 1920, height: 1080 },
    { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48, xPx: null, yPx: 0 }
  );

  assert.equal(cancelled, false);
  assert.equal(stillActive, false);
});
