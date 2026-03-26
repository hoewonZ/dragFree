import test from "node:test";
import assert from "node:assert/strict";

import { DragSessionController } from "../../src/main/drag-session-controller.js";

const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
const hotzone = { edge: "top", widthPx: 200, heightPx: 300, cancelRegionPx: 48 };

test("enters hotzone and emits panel open", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 900, y: 20, paths: ["C:/tmp/a.txt"] });

  assert.equal(controller.getState(), "panel-active");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "panel-open");
});

test("moves beyond panel region and emits cancel", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 900, y: 20, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 700, y: 320, width: 560, height: 260 });
  controller.handleDragPosition({ x: 900, y: 330 }, 300);
  controller.handleDragPosition({ x: 100, y: 700 }, 700);
  controller.handleDragPosition({ x: 100, y: 700 }, 860);

  assert.equal(controller.getState(), "idle");
  assert.deepEqual(
    events.map((item) => item.type),
    ["panel-open", "panel-cancel", "panel-close"]
  );
});

test("returns to idle when drag ends after cancel", () => {
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: () => {}
  });

  controller.handleDragPosition({ x: 900, y: 10, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 700, y: 320, width: 560, height: 260 });
  controller.handleDragPosition({ x: 900, y: 330 }, 300);
  controller.handleDragPosition({ x: 100, y: 700 }, 700);
  controller.endDrag();

  assert.equal(controller.getState(), "idle");
});

test("keeps panel while moving through corridor to panel", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 960, y: 100, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 700, y: 320, width: 560, height: 260 });

  controller.handleDragPosition({ x: 960, y: 250 }, 180);
  controller.handleDragPosition({ x: 960, y: 320 }, 260);

  assert.equal(controller.getState(), "panel-active");
  assert.deepEqual(events.map((item) => item.type), ["panel-open"]);
});

test("does not close immediately after open during grace period", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 960, y: 100, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 700, y: 320, width: 560, height: 260 });
  controller.handleDragPosition({ x: 100, y: 700 }, 120);

  assert.equal(controller.getState(), "panel-active");
  assert.deepEqual(events.map((item) => item.type), ["panel-open"]);
});

test("reopens after close when re-entering hotzone", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 960, y: 100, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 680, y: 4, width: 560, height: 320 });
  controller.handleDragPosition({ x: 100, y: 700 }, 600);
  controller.handleDragPosition({ x: 100, y: 700 }, 820);

  controller.handleDragPosition({ x: 960, y: 100, paths: ["C:/tmp/b.txt"] }, 1000);

  assert.equal(controller.getState(), "panel-active");
  assert.deepEqual(events.map((item) => item.type), [
    "panel-open",
    "panel-cancel",
    "panel-close",
    "panel-open"
  ]);
});

test("does not close on brief leave and closes on sustained leave", () => {
  const events = [];
  const controller = new DragSessionController({
    displayBounds,
    hotzone,
    onEvent: (event) => events.push(event)
  });

  controller.handleDragPosition({ x: 960, y: 100, paths: ["C:/tmp/a.txt"] }, 0);
  controller.setPanelBounds({ x: 700, y: 4, width: 560, height: 320 });

  controller.handleDragPosition({ x: 100, y: 700 }, 200);
  controller.handleDragPosition({ x: 960, y: 200 }, 260);
  assert.equal(controller.getState(), "panel-active");

  controller.handleDragPosition({ x: 100, y: 700 }, 500);
  controller.handleDragPosition({ x: 100, y: 700 }, 700);
  assert.equal(controller.getState(), "idle");
  assert.deepEqual(events.map((item) => item.type), ["panel-open", "panel-cancel", "panel-close"]);
});
