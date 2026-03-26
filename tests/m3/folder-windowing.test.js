import test from "node:test";
import assert from "node:assert/strict";

import { getVisibleWindow } from "../../src/renderer/folder-windowing.js";

test("returns all items when child count is below limit", () => {
  const children = ["a", "b", "c"];
  const result = getVisibleWindow(children, 1, 5);

  assert.deepEqual(result.items, ["a", "b", "c"]);
  assert.equal(result.startIndex, 0);
});

test("centers around active child when possible", () => {
  const children = ["a", "b", "c", "d", "e", "f", "g"];
  const result = getVisibleWindow(children, 3, 3);

  assert.deepEqual(result.items, ["c", "d", "e"]);
  assert.equal(result.startIndex, 2);
});

test("pins near top when active child is close to start", () => {
  const children = ["a", "b", "c", "d", "e", "f", "g"];
  const result = getVisibleWindow(children, 0, 4);

  assert.deepEqual(result.items, ["a", "b", "c", "d"]);
  assert.equal(result.startIndex, 0);
});

test("pins near bottom when active child is close to end", () => {
  const children = ["a", "b", "c", "d", "e", "f", "g"];
  const result = getVisibleWindow(children, 6, 4);

  assert.deepEqual(result.items, ["d", "e", "f", "g"]);
  assert.equal(result.startIndex, 3);
});
