export function getVisibleWindow(children, activeIndex, maxVisible) {
  const total = children.length;
  if (total === 0) {
    return { startIndex: 0, endIndex: 0, items: [] };
  }

  if (maxVisible <= 0 || total <= maxVisible) {
    return {
      startIndex: 0,
      endIndex: total,
      items: children.slice(0)
    };
  }

  const half = Math.floor(maxVisible / 2);
  let startIndex = activeIndex - half;

  if (startIndex < 0) {
    startIndex = 0;
  }

  const maxStart = total - maxVisible;
  if (startIndex > maxStart) {
    startIndex = maxStart;
  }

  const endIndex = startIndex + maxVisible;
  return {
    startIndex,
    endIndex,
    items: children.slice(startIndex, endIndex)
  };
}
