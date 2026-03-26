import { isPointInHotzone } from "./hotzone.js";

const OPEN_GRACE_MS = 420;
const LEAVE_DEBOUNCE_MS = 140;
const PANEL_PADDING_PX = 56;

export class DragSessionController {
  constructor({ displayBounds, hotzone, onEvent }) {
    this.displayBounds = displayBounds;
    this.hotzone = hotzone;
    this.onEvent = onEvent;
    this.state = "idle";
    this.panelBounds = null;
    this.openedAtMs = null;
    this.leftPanelAtMs = null;
  }

  getState() {
    return this.state;
  }

  handleDragPosition(point, nowMs = Date.now()) {
    const hasDraggedFiles = Array.isArray(point?.paths) && point.paths.length > 0;
    const isLikelyFileDrag = point?.fileDrag === true;

    if (this.state === "idle") {
      if ((hasDraggedFiles || isLikelyFileDrag) && isPointInHotzone(point, this.displayBounds, this.hotzone)) {
        this.state = "panel-active";
        this.openedAtMs = nowMs;
        this.leftPanelAtMs = null;
        this.onEvent({ type: "panel-open", point });
      }
      return;
    }

    if (this.state === "panel-active") {
      if (this.shouldKeepPanelOpen(point, nowMs)) {
        this.leftPanelAtMs = null;
        return;
      }

      const inGracePeriod = this.openedAtMs !== null && nowMs - this.openedAtMs < OPEN_GRACE_MS;
      if (inGracePeriod) {
        return;
      }

      if (this.leftPanelAtMs === null) {
        this.leftPanelAtMs = nowMs;
        return;
      }

      if (nowMs - this.leftPanelAtMs >= LEAVE_DEBOUNCE_MS) {
        this.closePanel(point);
      }
      return;
    }
  }

  endDrag() {
    if (this.state === "panel-active") {
      this.onEvent({ type: "panel-close" });
    }
    this.reset();
  }

  setPanelBounds(bounds) {
    this.panelBounds = bounds;
  }

  shouldKeepPanelOpen(point, nowMs = Date.now()) {
    if (!this.panelBounds) {
      return isPointInHotzone(point, this.displayBounds, this.hotzone);
    }

    if (isPointInRect(point, this.panelBounds, PANEL_PADDING_PX)) {
      return true;
    }

    const inGracePeriod = this.openedAtMs !== null && nowMs - this.openedAtMs < OPEN_GRACE_MS;
    if (inGracePeriod) {
      return true;
    }

    return false;
  }

  closePanel(point) {
    this.onEvent({ type: "panel-cancel", point });
    this.onEvent({ type: "panel-close", point });
    this.reset();
  }

  reset() {
    this.state = "idle";
    this.panelBounds = null;
    this.openedAtMs = null;
    this.leftPanelAtMs = null;
  }
}

function isPointInRect(point, rect, padding) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}
