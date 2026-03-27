import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

export const DEFAULT_CONFIG = {
  version: 1,
  hotzone: {
    edge: "top",
    displayId: null,
    preferredDisplayId: null,
    widthPx: 200,
    heightPx: 300,
    xPx: null,
    yPx: 0,
    opacity: 0.08,
    color: "#467eff",
    titleBarColor: "#0c1220",
    pinned: true,
    displayText: "拖动文件到这里，或双击这里试试",
    displayTextColor: "#f5f8ff",
    displayTextBold: false,
    cancelRegionPx: 48,
    debugVisible: true
  },
  behavior: {
    defaultAction: "copy",
    expandDelayMs: 0,
    maxVisibleChildren: 8,
    breadcrumbSeparator: "/",
    dropPulseConfirmSec: 0.1,
    hoverFollowupDelaySec: 0.3,
    panelViewMode: "list",
    panelTileSize: "large",
    pulseLevel: "high"
  },
  notification: {
    onSuccess: false,
    onCancelled: true,
    onFailed: true
  },
  folders: []
};

export const HOTZONE_MIN_WIDTH = 120;
export const HOTZONE_MIN_HEIGHT = 96;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeConfig(partial = {}) {
  const edge = "top";
  const displayId = normalizeDisplayId(partial.hotzone?.displayId, DEFAULT_CONFIG.hotzone.displayId);
  const preferredDisplayId = normalizeDisplayId(
    partial.hotzone?.preferredDisplayId,
    DEFAULT_CONFIG.hotzone.preferredDisplayId
  );
  const widthPx = normalizePositiveInt(
    partial.hotzone?.widthPx,
    DEFAULT_CONFIG.hotzone.widthPx,
    HOTZONE_MIN_WIDTH
  );
  const heightPx = normalizePositiveInt(
    partial.hotzone?.heightPx,
    DEFAULT_CONFIG.hotzone.heightPx,
    HOTZONE_MIN_HEIGHT
  );
  const xPx = normalizeOptionalNumber(partial.hotzone?.xPx, DEFAULT_CONFIG.hotzone.xPx);
  const yPx = normalizeNumber(partial.hotzone?.yPx, DEFAULT_CONFIG.hotzone.yPx);
  const opacity = normalizeUnitNumber(partial.hotzone?.opacity, DEFAULT_CONFIG.hotzone.opacity);
  const color = normalizeHexColor(partial.hotzone?.color, DEFAULT_CONFIG.hotzone.color);
  const titleBarColor = normalizeHexColor(partial.hotzone?.titleBarColor, DEFAULT_CONFIG.hotzone.titleBarColor);
  const pinned = typeof partial.hotzone?.pinned === "boolean" ? partial.hotzone.pinned : DEFAULT_CONFIG.hotzone.pinned;
  const displayText = normalizeDisplayText(partial.hotzone?.displayText, DEFAULT_CONFIG.hotzone.displayText);
  const displayTextColor = normalizeHexColor(
    partial.hotzone?.displayTextColor,
    DEFAULT_CONFIG.hotzone.displayTextColor
  );
  const displayTextBold =
    typeof partial.hotzone?.displayTextBold === "boolean"
      ? partial.hotzone.displayTextBold
      : DEFAULT_CONFIG.hotzone.displayTextBold;
  const cancelRegionPx = normalizePositiveInt(
    partial.hotzone?.cancelRegionPx,
    DEFAULT_CONFIG.hotzone.cancelRegionPx
  );
  const debugVisible =
    typeof partial.hotzone?.debugVisible === "boolean"
      ? partial.hotzone.debugVisible
      : DEFAULT_CONFIG.hotzone.debugVisible;

  const folders = Array.isArray(partial.folders)
    ? partial.folders
        .map((item, index) => normalizeFolder(item, index))
        .filter((item) => item !== null)
    : DEFAULT_CONFIG.folders;

  const dropPulseConfirmSec = normalizeDropPulseConfirmSec(partial.behavior?.dropPulseConfirmSec);
  const hoverFollowupDelaySec = normalizeHoverFollowupDelaySec(partial.behavior?.hoverFollowupDelaySec);
  const panelViewMode = normalizePanelViewMode(partial.behavior?.panelViewMode);
  const panelTileSize = normalizePanelTileSize(partial.behavior?.panelTileSize);
  const pulseLevel = normalizePulseLevel(partial.behavior?.pulseLevel);
  return {
    ...DEFAULT_CONFIG,
    version:
      typeof partial.version === "number" && Number.isFinite(partial.version)
        ? Math.round(partial.version)
        : DEFAULT_CONFIG.version,
    hotzone: {
      ...DEFAULT_CONFIG.hotzone,
      edge,
      displayId,
      preferredDisplayId,
      widthPx,
      heightPx,
      xPx,
      yPx,
      opacity,
      color,
      titleBarColor,
      pinned,
      displayText,
      displayTextColor,
      displayTextBold,
      cancelRegionPx,
      debugVisible
    },
    behavior: {
      ...DEFAULT_CONFIG.behavior,
      ...(partial.behavior ?? {}),
      dropPulseConfirmSec,
      hoverFollowupDelaySec,
      panelViewMode,
      panelTileSize,
      pulseLevel
    },
    notification: {
      ...DEFAULT_CONFIG.notification,
      ...(partial.notification ?? {})
    },
    folders
  };
}

function normalizePanelViewMode(value) {
  if (value === "tile") {
    return value;
  }
  return "list";
}

function normalizePanelTileSize(value) {
  if (value === "medium" || value === "small") {
    return value;
  }
  return "large";
}

function normalizePulseLevel(value) {
  return "high";
}

function normalizePositiveInt(value, fallback, minValue = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    return fallback;
  }
  return Math.round(parsed);
}

function normalizeDisplayId(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalNumber(value, fallback) {
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUnitNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const clamped = Math.min(1, Math.max(0, parsed));
  return Math.round(clamped * 100) / 100;
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return fallback;
}

function normalizeDisplayText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  return trimmed.slice(0, 500);
}

function normalizeDropPulseConfirmSec(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.behavior.dropPulseConfirmSec;
  }

  const clamped = Math.min(1, Math.max(0, parsed));
  return Math.round(clamped * 100) / 100;
}

function normalizeHoverFollowupDelaySec(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.behavior.hoverFollowupDelaySec;
  }

  const clamped = Math.min(1, Math.max(0, parsed));
  return Math.round(clamped * 100) / 100;
}

function normalizeFolder(item, index) {
  if (typeof item === "string") {
    return {
      id: `legacy-${index}`,
      name: basename(item),
      path: item
    };
  }

  if (!item || typeof item.path !== "string" || item.path.length === 0) {
    return null;
  }

  return {
    id: typeof item.id === "string" && item.id.length > 0 ? item.id : `folder-${index}`,
    name:
      typeof item.name === "string" && item.name.length > 0
        ? item.name
        : basename(item.path),
    path: item.path
  };
}

export async function readConfigFromFile(configFilePath) {
  try {
    const raw = await readFile(configFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return mergeConfig(parsed);
  } catch {
    return deepClone(DEFAULT_CONFIG);
  }
}

export async function writeConfigToFile(configFilePath, partialConfig) {
  const merged = mergeConfig(partialConfig);
  await mkdir(dirname(configFilePath), { recursive: true });
  await writeFile(configFilePath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
