function normalizeEdge() {
  return "top";
}

function clampPositive(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const HOTZONE_HEADER_HEIGHT = 28;

export function getHotzoneRect(displayBounds, hotzone) {
  const edge = normalizeEdge(hotzone?.edge);
  const maxWidth = Math.max(1, displayBounds.width);
  const maxHeight = Math.max(1, displayBounds.height);
  const widthPx = Math.min(clampPositive(hotzone?.widthPx, 200), maxWidth);
  const heightPx = Math.min(clampPositive(hotzone?.heightPx, 300), maxHeight);

  const centeredX = Math.round(displayBounds.x + (displayBounds.width - widthPx) / 2);
  const rawX = hotzone?.xPx === null || hotzone?.xPx === undefined ? centeredX : toFiniteNumber(hotzone.xPx, centeredX);
  const rawY = toFiniteNumber(hotzone?.yPx, displayBounds.y);

  const minX = displayBounds.x;
  const maxX = displayBounds.x + displayBounds.width - widthPx;
  const minY = displayBounds.y;
  const maxY = displayBounds.y + displayBounds.height - HOTZONE_HEADER_HEIGHT;

  const x = Math.round(clamp(rawX, minX, maxX));
  const y = Math.round(clamp(rawY, minY, maxY));

  if (edge === "top") {
    return {
      x,
      y,
      width: widthPx,
      height: heightPx
    };
  }

  return {
    x,
    y,
    width: widthPx,
    height: heightPx
  };
}

export function isPointInHotzone(point, displayBounds, hotzone) {
  const rect = getHotzoneRect(displayBounds, hotzone);
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function isPointBeyondCancelRegion(point, displayBounds, hotzone) {
  const edge = normalizeEdge(hotzone.edge);
  const hotzoneRect = getHotzoneRect(displayBounds, hotzone);
  const cancelRegionPx = clampPositive(hotzone.cancelRegionPx, 48);

  if (edge === "top") {
    return point.y > hotzoneRect.y + hotzoneRect.height + cancelRegionPx;
  }

  return false;
}
