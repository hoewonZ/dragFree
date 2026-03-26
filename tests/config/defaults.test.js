import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG } from "../../src/main/config-store.js";

test("default config uses copy and immediate expand", () => {
  assert.equal(DEFAULT_CONFIG.behavior.defaultAction, "copy");
  assert.equal(DEFAULT_CONFIG.behavior.expandDelayMs, 0);
  assert.equal(DEFAULT_CONFIG.behavior.breadcrumbSeparator, "/");
  assert.equal(DEFAULT_CONFIG.behavior.dropPulseConfirmSec, 0.1);
  assert.equal(DEFAULT_CONFIG.behavior.hoverFollowupDelaySec, 0.3);
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
  assert.equal(DEFAULT_CONFIG.hotzone.displayText, "拖动文件到这里，或双击这里试试");
  assert.equal(DEFAULT_CONFIG.hotzone.displayTextColor, "#f5f8ff");
  assert.equal(DEFAULT_CONFIG.hotzone.displayTextBold, false);
  assert.equal(DEFAULT_CONFIG.notification.onSuccess, false);
  assert.equal(DEFAULT_CONFIG.notification.onCancelled, true);
  assert.equal(DEFAULT_CONFIG.notification.onFailed, true);
});
