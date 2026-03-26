export class HoverExpandController {
  constructor({ delayMs, setTimer, clearTimer }) {
    this.delayMs = delayMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.activeFolderId = null;
    this.activeTimerId = null;
    this.activeOnExpand = null;
  }

  startHover(folderId, { onFeedback, onExpand }) {
    if (this.activeTimerId !== null) {
      this.clearTimer(this.activeTimerId);
      this.activeTimerId = null;
    }

    this.activeFolderId = folderId;
    this.activeOnExpand = onExpand;
    onFeedback(folderId);

    this.activeTimerId = this.setTimer(() => {
      if (this.activeFolderId === folderId && this.activeOnExpand) {
        this.activeOnExpand(folderId);
      }
      this.activeTimerId = null;
    }, this.delayMs);
  }

  getActiveFolderId() {
    return this.activeFolderId;
  }

  clearHover(folderId) {
    if (this.activeFolderId !== folderId) {
      return;
    }

    if (this.activeTimerId !== null) {
      this.clearTimer(this.activeTimerId);
      this.activeTimerId = null;
    }

    this.activeFolderId = null;
    this.activeOnExpand = null;
  }
}
