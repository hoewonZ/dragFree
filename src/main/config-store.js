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
    textTabs: [
      {
        id: "tab-1",
        text: "拖动文件到这里，或双击这里试试"
      }
    ],
    activeTextTabId: "tab-1",
    displayTextColor: "#f5f8ff",
    displayTextBold: false,
    displayTextSizeLevel: 0,
    textLimitEnabled: true,
    dragTextAppendWithNewline: true,
    allowCrossScreenMove: false,
    backgroundImageEnabled: false,
    backgroundImagePath: "",
    backgroundFillMode: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    backgroundOpacity: 1,
    backgroundScale: 1,
    cancelRegionPx: 48,
    debugVisible: true,
    hotzoneDebugLogEnabled: false
  },
  behavior: {
    defaultAction: "copy",
    interactionMode: "drag",
    openTargetFolderOnDropSuccess: false,
    expandDelayMs: 0,
    maxVisibleChildren: 8,
    breadcrumbSeparator: "/",
    hoverQueryDelayMs: 220,
    queryCooldownSec: 2,
    quickOpenHoverDelayMs: 500,
    panelViewMode: "list",
    panelTileSize: "large",
    pulseLevel: "high",
    launchOnStartup: false
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

export function resolveSessionMinSize() {
  return {
    widthPx: HOTZONE_MIN_WIDTH,
    heightPx: HOTZONE_MIN_HEIGHT
  };
}

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
  const textLimitEnabled =
    typeof partial.hotzone?.textLimitEnabled === "boolean"
      ? partial.hotzone.textLimitEnabled
      : DEFAULT_CONFIG.hotzone.textLimitEnabled;
  const displayText = normalizeDisplayText(partial.hotzone?.displayText, DEFAULT_CONFIG.hotzone.displayText, {
    textLimitEnabled
  });
  const { textTabs, activeTextTabId, activeText } = normalizeHotzoneTextTabs({
    textTabs: partial.hotzone?.textTabs,
    activeTextTabId: partial.hotzone?.activeTextTabId,
    displayText,
    fallbackText: DEFAULT_CONFIG.hotzone.displayText,
    textLimitEnabled
  });
  const displayTextColor = normalizeHexColor(
    partial.hotzone?.displayTextColor,
    DEFAULT_CONFIG.hotzone.displayTextColor
  );
  const displayTextBold =
    typeof partial.hotzone?.displayTextBold === "boolean"
      ? partial.hotzone.displayTextBold
      : DEFAULT_CONFIG.hotzone.displayTextBold;
  const displayTextSizeLevel = normalizeDisplayTextSizeLevel(
    partial.hotzone?.displayTextSizeLevel,
    DEFAULT_CONFIG.hotzone.displayTextSizeLevel
  );
  const dragTextAppendWithNewline =
    typeof partial.hotzone?.dragTextAppendWithNewline === "boolean"
      ? partial.hotzone.dragTextAppendWithNewline
      : DEFAULT_CONFIG.hotzone.dragTextAppendWithNewline;
  const allowCrossScreenMove =
    typeof partial.hotzone?.allowCrossScreenMove === "boolean"
      ? partial.hotzone.allowCrossScreenMove
      : DEFAULT_CONFIG.hotzone.allowCrossScreenMove;
  const backgroundImageEnabled =
    typeof partial.hotzone?.backgroundImageEnabled === "boolean"
      ? partial.hotzone.backgroundImageEnabled
      : DEFAULT_CONFIG.hotzone.backgroundImageEnabled;
  const backgroundImagePath = normalizeBackgroundImagePath(
    partial.hotzone?.backgroundImagePath,
    DEFAULT_CONFIG.hotzone.backgroundImagePath
  );
  const backgroundFillMode = normalizeBackgroundFillMode(
    partial.hotzone?.backgroundFillMode,
    DEFAULT_CONFIG.hotzone.backgroundFillMode
  );
  const backgroundPosition = normalizeBackgroundPosition(
    partial.hotzone?.backgroundPosition,
    DEFAULT_CONFIG.hotzone.backgroundPosition
  );
  const backgroundRepeat = normalizeBackgroundRepeat(
    partial.hotzone?.backgroundRepeat,
    DEFAULT_CONFIG.hotzone.backgroundRepeat
  );
  const backgroundOpacity = normalizeUnitNumber(
    partial.hotzone?.backgroundOpacity,
    DEFAULT_CONFIG.hotzone.backgroundOpacity
  );
  const backgroundScale = normalizeBackgroundScale(
    partial.hotzone?.backgroundScale,
    DEFAULT_CONFIG.hotzone.backgroundScale
  );
  const cancelRegionPx = normalizePositiveInt(
    partial.hotzone?.cancelRegionPx,
    DEFAULT_CONFIG.hotzone.cancelRegionPx
  );
  const debugVisible =
    typeof partial.hotzone?.debugVisible === "boolean"
      ? partial.hotzone.debugVisible
      : DEFAULT_CONFIG.hotzone.debugVisible;
  const hotzoneDebugLogEnabled =
    typeof partial.hotzone?.hotzoneDebugLogEnabled === "boolean"
      ? partial.hotzone.hotzoneDebugLogEnabled
      : DEFAULT_CONFIG.hotzone.hotzoneDebugLogEnabled;

  const folders = Array.isArray(partial.folders)
    ? partial.folders
        .map((item, index) => normalizeFolder(item, index))
        .filter((item) => item !== null)
    : DEFAULT_CONFIG.folders;

  const hoverQueryDelayMs = normalizeHoverQueryDelayMs(partial.behavior?.hoverQueryDelayMs);
  const queryCooldownSec = normalizeQueryCooldownSec(partial.behavior?.queryCooldownSec);
  const panelViewMode = normalizePanelViewMode(partial.behavior?.panelViewMode);
  const panelTileSize = normalizePanelTileSize(partial.behavior?.panelTileSize);
  const pulseLevel = normalizePulseLevel(partial.behavior?.pulseLevel);
  const interactionMode = normalizeInteractionMode(partial.behavior?.interactionMode);
  const quickOpenHoverDelayMs = normalizeQuickOpenHoverDelayMs(partial.behavior?.quickOpenHoverDelayMs);
  const openTargetFolderOnDropSuccess =
    typeof partial.behavior?.openTargetFolderOnDropSuccess === "boolean"
      ? partial.behavior.openTargetFolderOnDropSuccess
      : DEFAULT_CONFIG.behavior.openTargetFolderOnDropSuccess;
  const launchOnStartup =
    typeof partial.behavior?.launchOnStartup === "boolean"
      ? partial.behavior.launchOnStartup
      : DEFAULT_CONFIG.behavior.launchOnStartup;
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
      displayText: activeText,
      textTabs,
      activeTextTabId,
      displayTextColor,
      displayTextBold,
      displayTextSizeLevel,
      textLimitEnabled,
      dragTextAppendWithNewline,
      allowCrossScreenMove,
      backgroundImageEnabled,
      backgroundImagePath,
      backgroundFillMode,
      backgroundPosition,
      backgroundRepeat,
      backgroundOpacity,
      backgroundScale,
      cancelRegionPx,
      debugVisible,
      hotzoneDebugLogEnabled
    },
    behavior: {
      ...DEFAULT_CONFIG.behavior,
      ...(partial.behavior ?? {}),
      openTargetFolderOnDropSuccess,
      hoverQueryDelayMs,
      queryCooldownSec,
      quickOpenHoverDelayMs,
      panelViewMode,
      panelTileSize,
      pulseLevel,
      interactionMode,
      launchOnStartup
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

function normalizeInteractionMode(value) {
  return value === "quick-open" ? "quick-open" : "drag";
}

function normalizeBackgroundImagePath(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function normalizeBackgroundFillMode(value, fallback) {
  if (value === "contain" || value === "stretch" || value === "tile") {
    return value;
  }
  return fallback;
}

function normalizeBackgroundPosition(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "center") {
    return "center center";
  }
  const allowed = new Set(["left", "center", "right", "top", "bottom"]);
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1 && allowed.has(parts[0])) {
    return `${parts[0]} center`;
  }
  if (parts.length === 2 && allowed.has(parts[0]) && allowed.has(parts[1])) {
    return `${parts[0]} ${parts[1]}`;
  }
  return fallback;
}

function normalizeBackgroundRepeat(value, fallback) {
  if (value === "repeat") {
    return "repeat";
  }
  return fallback;
}

function normalizeBackgroundScale(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(3, Math.max(0.5, Math.round(parsed * 100) / 100));
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

function normalizeDisplayText(value, fallback, options = {}) {
  const textLimitEnabled = options.textLimitEnabled !== false;
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  return textLimitEnabled ? trimmed.slice(0, 1000) : trimmed;
}

function normalizeHotzoneTextTabs({ textTabs, activeTextTabId, displayText, fallbackText, textLimitEnabled }) {
  const fallback = normalizeDisplayText(fallbackText, DEFAULT_CONFIG.hotzone.displayText, { textLimitEnabled });
  const inputTabs = Array.isArray(textTabs) ? textTabs : [];
  const normalizedTabs = inputTabs
    .map((item, index) => normalizeTextTab(item, index, textLimitEnabled))
    .filter((item) => item !== null);
  if (normalizedTabs.length === 0) {
    const singleText = normalizeDisplayText(displayText, fallback, { textLimitEnabled });
    return {
      textTabs: [{ id: "tab-1", text: singleText }],
      activeTextTabId: "tab-1",
      activeText: singleText
    };
  }
  const activeId = typeof activeTextTabId === "string" && activeTextTabId.trim().length > 0
    ? activeTextTabId.trim()
    : normalizedTabs[0].id;
  const active = normalizedTabs.find((item) => item.id === activeId) ?? normalizedTabs[0];
  return {
    textTabs: normalizedTabs,
    activeTextTabId: active.id,
    activeText: active.text
  };
}

function normalizeTextTab(item, index, textLimitEnabled) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const id = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : `tab-${index + 1}`;
  const text = normalizeDisplayText(item.text, DEFAULT_CONFIG.hotzone.displayText, { textLimitEnabled });
  return { id, text };
}

function normalizeDisplayTextSizeLevel(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(9, Math.max(0, Math.round(parsed)));
}

function normalizeHoverQueryDelayMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.behavior.hoverQueryDelayMs;
  }

  const clamped = Math.min(2000, Math.max(100, parsed));
  return Math.round(clamped);
}

function normalizeQueryCooldownSec(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.behavior.queryCooldownSec;
  }

  const clamped = Math.min(5, Math.max(0, parsed));
  return Math.round(clamped * 100) / 100;
}

function normalizeQuickOpenHoverDelayMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIG.behavior.quickOpenHoverDelayMs;
  }

  const clamped = Math.min(3000, Math.max(200, parsed));
  return Math.round(clamped);
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
