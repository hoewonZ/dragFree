function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function computeCenteredHotzonePosition(workArea, options = {}) {
  const width = Math.max(1, Math.round(Number(options.width) || 1));
  const height = Math.max(1, Math.round(Number(options.height) || 1));
  const headerHeight = Math.max(0, Math.round(Number(options.headerHeight) || 0));
  const wa = workArea && typeof workArea === "object" ? workArea : { x: 0, y: 0, width: width, height: height };

  const rawX = wa.x + (wa.width - width) / 2;
  const rawY = wa.y + (wa.height - height) / 2;

  const minX = wa.x;
  const maxX = wa.x + wa.width - width;
  const minY = wa.y + headerHeight;
  const maxY = wa.y + wa.height - height;

  return {
    x: Math.round(clamp(rawX, minX, Math.max(minX, maxX))),
    y: Math.round(clamp(rawY, minY, Math.max(minY, maxY)))
  };
}

