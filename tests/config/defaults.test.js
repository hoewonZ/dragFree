import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONFIG,
  HOTZONE_MIN_HEIGHT,
  HOTZONE_MIN_WIDTH,
  mergeConfig,
  resolveSessionMinSize
} from "../../src/main/config-store.js";

test("default config uses copy and immediate expand", () => {
  assert.equal(DEFAULT_CONFIG.behavior.defaultAction, "copy");
  assert.equal(DEFAULT_CONFIG.behavior.interactionMode, "drag");
  assert.equal(DEFAULT_CONFIG.behavior.openTargetFolderOnDropSuccess, false);
  assert.equal(DEFAULT_CONFIG.behavior.expandDelayMs, 0);
  assert.equal(DEFAULT_CONFIG.behavior.breadcrumbSeparator, "/");
  assert.equal(DEFAULT_CONFIG.behavior.dropPulseConfirmSec, 0.1);
  assert.equal(DEFAULT_CONFIG.behavior.hoverFollowupDelaySec, 2);
  assert.equal(DEFAULT_CONFIG.behavior.quickOpenHoverDelayMs, 500);
  assert.equal(DEFAULT_CONFIG.behavior.panelViewMode, "list");
  assert.equal(DEFAULT_CONFIG.behavior.panelTileSize, "large");
  assert.equal(DEFAULT_CONFIG.behavior.pulseLevel, "high");
  assert.equal(DEFAULT_CONFIG.hotzone.widthPx, 200);
  assert.equal(DEFAULT_CONFIG.hotzone.heightPx, 300);
  assert.equal(DEFAULT_CONFIG.hotzone.displayId, null);
  assert.equal(DEFAULT_CONFIG.hotzone.preferredDisplayId, null);
  assert.equal(DEFAULT_CONFIG.hotzone.xPx, null);
  assert.equal(DEFAULT_CONFIG.hotzone.yPx, 0);
  assert.equal(DEFAULT_CONFIG.hotzone.opacity, 0.08);
  assert.equal(DEFAULT_CONFIG.hotzone.color, "#467eff");
  assert.equal(DEFAULT_CONFIG.hotzone.titleBarColor, "#0c1220");
  assert.equal(DEFAULT_CONFIG.hotzone.pinned, true);
  assert.equal(DEFAULT_CONFIG.hotzone.displayText, "拖动文件到这里，或双击这里试试");
  assert.equal(DEFAULT_CONFIG.hotzone.displayTextColor, "#f5f8ff");
  assert.equal(DEFAULT_CONFIG.hotzone.displayTextBold, false);
  assert.equal(DEFAULT_CONFIG.hotzone.displayTextSizeLevel, 0);
  assert.equal(DEFAULT_CONFIG.notification.onSuccess, false);
  assert.equal(DEFAULT_CONFIG.notification.onCancelled, true);
  assert.equal(DEFAULT_CONFIG.notification.onFailed, true);
});

test("mergeConfig enforces minimum hotzone width and height", () => {
  const merged = mergeConfig({
    hotzone: {
      widthPx: 80,
      heightPx: 60
    }
  });

  assert.equal(merged.hotzone.widthPx, DEFAULT_CONFIG.hotzone.widthPx);
  assert.equal(merged.hotzone.heightPx, DEFAULT_CONFIG.hotzone.heightPx);
  assert.equal(HOTZONE_MIN_WIDTH, 120);
  assert.equal(HOTZONE_MIN_HEIGHT, 96);
});

test("mergeConfig keeps default titlebar color when missing", () => {
  const merged = mergeConfig({
    hotzone: {
      color: "#123456"
    }
  });

  assert.equal(merged.hotzone.titleBarColor, DEFAULT_CONFIG.hotzone.titleBarColor);
});

test("mergeConfig clamps display text size level", () => {
  const mergedTooSmall = mergeConfig({
    hotzone: {
      displayTextSizeLevel: -2
    }
  });
  const mergedTooLarge = mergeConfig({
    hotzone: {
      displayTextSizeLevel: 9
    }
  });

  assert.equal(mergedTooSmall.hotzone.displayTextSizeLevel, 0);
  assert.equal(mergedTooLarge.hotzone.displayTextSizeLevel, 9);
});

test("mergeConfig normalizes interaction mode", () => {
  const mergedQuickOpen = mergeConfig({
    behavior: {
      interactionMode: "quick-open"
    }
  });
  const mergedInvalid = mergeConfig({
    behavior: {
      interactionMode: "invalid-mode"
    }
  });

  assert.equal(mergedQuickOpen.behavior.interactionMode, "quick-open");
  assert.equal(mergedInvalid.behavior.interactionMode, "drag");
});

test("session min size stays at fixed hotzone minimums", () => {
  const minFromLargeHotzone = resolveSessionMinSize({ widthPx: 540, heightPx: 420 });
  const minFromSmallHotzone = resolveSessionMinSize({ widthPx: 120, heightPx: 96 });

  assert.deepEqual(minFromLargeHotzone, {
    widthPx: HOTZONE_MIN_WIDTH,
    heightPx: HOTZONE_MIN_HEIGHT
  });
  assert.deepEqual(minFromSmallHotzone, {
    widthPx: HOTZONE_MIN_WIDTH,
    heightPx: HOTZONE_MIN_HEIGHT
  });
});
