import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell,
  ipcMain
} from "electron";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import { access, appendFile, mkdir, readdir } from "node:fs/promises";

import {
  HOTZONE_MIN_HEIGHT,
  HOTZONE_MIN_WIDTH,
  mergeConfig,
  readConfigFromFile,
  writeConfigToFile
} from "./config-store.js";
import { DragSessionController } from "./drag-session-controller.js";
import { inferAction, routeEntries } from "./file-router.js";
import { getHotzoneRect } from "./hotzone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tray = null;
let configWindow = null;
let panelWindow = null;
let overlayWindow = null;
let config = null;
let dragController = null;
let activeDisplayBounds = null;
let configFilePath = null;
let dragMonitorTimer = null;
let overlayEventsEnabled = true;
let panelEventsEnabled = false;
let currentDragPaths = [];
let pendingCreateFolderContext = null;
let newFolderWindow = null;
let overlayHotzonePreview = null;
let hotzonePreviewTimer = null;
let hotzonePreviewLastAppliedAt = 0;
let displayTopologyTimer = null;
let startupLogFilePath = null;
let startupStartMs = 0;
let startupOverlayLoadedLogged = false;
let hotzoneDebugLogFilePath = null;
let configDirty = false;
let configPersisted = true;
let quitFlushInProgress = false;
let quitFlushCompleted = false;
let overlayCollapsed = false;
let sessionMinWidthPx = HOTZONE_MIN_WIDTH;
let sessionMinHeightPx = HOTZONE_MIN_HEIGHT;

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 620;
const HOTZONE_PREVIEW_THROTTLE_MS = 33;
const DISPLAY_TOPOLOGY_DEBOUNCE_MS = 220;
const HOTZONE_DEBUG_LOG_NAME = "hotzone-debug.log";
const HOTZONE_HEADER_HEIGHT = 28;

async function initStartupLogger() {
  try {
    const logDir = join(app.getPath("userData"), "dragfree", "logs");
    await mkdir(logDir, { recursive: true });
    startupLogFilePath = join(logDir, "startup-profile.log");
    startupStartMs = Date.now();
    const sessionHeader = `\n=== startup session ${new Date().toISOString()} (packaged=${app.isPackaged}) ===\n`;
    await appendFile(startupLogFilePath, sessionHeader, "utf8");
  } catch {
    startupLogFilePath = null;
  }
}

async function initHotzoneDebugLogger() {
  try {
    const logDir = join(app.getPath("userData"), "dragfree", "logs");
    await mkdir(logDir, { recursive: true });
    hotzoneDebugLogFilePath = join(logDir, HOTZONE_DEBUG_LOG_NAME);
    const sessionHeader = `\n=== hotzone session ${new Date().toISOString()} (packaged=${app.isPackaged}) ===\n`;
    await appendFile(hotzoneDebugLogFilePath, sessionHeader, "utf8");
  } catch {
    hotzoneDebugLogFilePath = null;
  }
}

function appendHotzoneDebug(event, payload = {}) {
  if (!hotzoneDebugLogFilePath) {
    return;
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    payload
  });
  appendFile(hotzoneDebugLogFilePath, `${line}\n`, "utf8").catch(() => {});
}

function getDisplaySummaries() {
  return screen.getAllDisplays().map((item) => ({
    id: String(item.id),
    bounds: item.bounds
  }));
}

function getConfigStateFlags() {
  return {
    changed: configDirty ? 1 : 0,
    persisted: configPersisted ? 1 : 0
  };
}

function markConfigDirty(reason) {
  const wasDirty = configDirty;
  configDirty = true;
  configPersisted = false;
  if (!wasDirty) {
    appendHotzoneDebug("config_state", {
      reason,
      ...getConfigStateFlags()
    });
  }
}

function markConfigPersisted(reason) {
  const wasDirty = configDirty;
  configDirty = false;
  configPersisted = true;
  if (wasDirty) {
    appendHotzoneDebug("config_state", {
      reason,
      ...getConfigStateFlags()
    });
  }
}

async function flushRuntimeConfigToDisk(reason) {
  if (!configDirty || !config) {
    return {
      ok: true,
      skipped: true,
      data: config,
      state: getConfigStateFlags()
    };
  }

  config = await writeConfigToFile(configFilePath, config);
  markConfigPersisted(reason);
  return {
    ok: true,
    skipped: false,
    data: config,
    state: getConfigStateFlags()
  };
}

function logStartupStep(step, details = "") {
  if (!startupLogFilePath) {
    return;
  }
  const elapsed = startupStartMs > 0 ? Date.now() - startupStartMs : 0;
  const suffix = details ? ` | ${details}` : "";
  const line = `${new Date().toISOString()} +${elapsed}ms ${step}${suffix}\n`;
  appendFile(startupLogFilePath, line, "utf8").catch(() => {});
}

function getWindowIconPath() {
  const iconBasePath = app.isPackaged
    ? join(process.resourcesPath, "assets")
    : join(__dirname, "../../assets");
  return join(iconBasePath, "dragFree-transparent.png");
}

function createTrayIcon() {
  try {
    const iconBasePath = app.isPackaged
      ? join(process.resourcesPath, "assets")
      : join(__dirname, "../../assets");

    const addTrayRepresentation = (icon, scaleFactor, pixelSize) => {
      const iconPath = join(iconBasePath, `tray-${pixelSize}.png`);
      icon.addRepresentation({
        scaleFactor,
        width: 16,
        height: 16,
        buffer: readFileSync(iconPath)
      });
    };

    if (process.platform === "win32") {
      const icon = nativeImage.createEmpty();

      const representationMap = [
        [1.0, 16],
        [1.25, 20],
        [1.5, 24],
        [1.75, 28],
        [2.0, 32],
        [2.25, 36],
        [2.5, 40],
        [3.0, 48],
        [4.0, 64]
      ];

      for (const [scaleFactor, pixelSize] of representationMap) {
        addTrayRepresentation(icon, scaleFactor, pixelSize);
      }

      return icon;
    }

    const icon = nativeImage.createFromPath(join(iconBasePath, "tray-64.png"));
    return icon.isEmpty() ? nativeImage.createEmpty() : icon;
  } catch (error) {
    console.error("Failed to load tray icon:", error);
    return nativeImage.createEmpty();
  }
}

function createConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
    return configWindow;
  }

  logStartupStep("createConfigWindow:start");

  configWindow = new BrowserWindow({
    width: 520,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../renderer/config-preload.cjs")
    }
  });

  configWindow.loadFile(join(__dirname, "../renderer/config.html"));
  configWindow.webContents.on("did-finish-load", () => {
    logStartupStep("createConfigWindow:did-finish-load");
  });

  configWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      configWindow.hide();
    }
  });

  configWindow.on("minimize", (event) => {
    event.preventDefault();
    configWindow.hide();
  });

  logStartupStep("createConfigWindow:created");

  return configWindow;
}

function showConfigWindow() {
  const windowRef = createConfigWindow();
  if (!windowRef || windowRef.isDestroyed()) {
    return;
  }

  windowRef.show();
  windowRef.focus();
}

function createTray() {
  if (tray) {
    return tray;
  }

  logStartupStep("createTray:start");

  tray = new Tray(createTrayIcon());
  tray.setToolTip("dragFree");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Config",
      click: () => {
        showConfigWindow();
      }
    },
    {
      type: "separator"
    },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    showConfigWindow();
  });

  logStartupStep("createTray:created");

  return tray;
}

function ensurePanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow;
  }

  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: true,
    transparent: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    focusable: false,
    skipTaskbar: true,
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../renderer/panel-preload.cjs")
    }
  });

  panelWindow.setIgnoreMouseEvents(false, { forward: true });
  ensureWindowTopmost(panelWindow);

  panelWindow.loadFile(join(__dirname, "../renderer/panel.html"));
  panelWindow.webContents.on("did-finish-load", () => {
    panelWindow.webContents.send("panel-config", {
      folders: config.folders,
      behavior: config.behavior
    });
    panelWindow.webContents.send("panel-active", { enabled: panelEventsEnabled });
  });

  return panelWindow;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positionPanelForCurrentEdge(displayBounds, cursorX = null) {
  const panel = ensurePanelWindow();
  const panelWidth = PANEL_WIDTH;
  const preferredCenterX = Number.isFinite(cursorX)
    ? cursorX
    : displayBounds.x + displayBounds.width / 2;
  const rawX = preferredCenterX - panelWidth / 2;
  const minX = displayBounds.x;
  const maxX = displayBounds.x + displayBounds.width - panelWidth;
  const x = Math.round(clamp(rawX, minX, maxX));
  const y = Math.round(displayBounds.y + 4);

  panel.setBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  if (dragController) {
    dragController.setPanelBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  }
}

function handleDragEvent(event) {
  if (event.type === "panel-open") {
    const panel = ensurePanelWindow();
    setHotzoneEnabled(false);
    setPanelEventsEnabled(true);

    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    positionPanelForCurrentEdge(display.bounds, cursorPoint.x);
    panel.webContents.send("panel-config", {
      folders: config.folders,
      behavior: config.behavior
    });
    panel.showInactive();
    startDragMonitor();
    return;
  }

  if (event.type === "panel-cancel") {
    if (tray) {
      tray.displayBalloon({
        iconType: "warning",
        title: "dragFree",
        content: "拖拽已取消，已回退为普通拖拽。"
      });
    }
    stopDragMonitor();
    return;
  }

  if (event.type === "panel-close") {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.hide();
      panelWindow.webContents.send("panel-reset");
    }
    setPanelEventsEnabled(false);
    setHotzoneEnabled(true);
    stopDragMonitor();
  }
}

function setHotzoneEnabled(enabled) {
  overlayEventsEnabled = enabled;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (enabled) {
      overlayWindow.showInactive();
      overlayWindow.setIgnoreMouseEvents(false, { forward: true });
      applyOverlayPinnedState(config?.hotzone?.pinned === true);
      return;
    }

    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.hide();
  }
}

function setPanelEventsEnabled(enabled) {
  panelEventsEnabled = enabled;
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("panel-active", { enabled });
  }
}

function startDragMonitor() {
  stopDragMonitor();
  dragMonitorTimer = setInterval(() => {
    if (!dragController) {
      return;
    }
    const point = screen.getCursorScreenPoint();
    dragController.handleDragPosition(point);
  }, 80);
}

function stopDragMonitor() {
  if (dragMonitorTimer) {
    clearInterval(dragMonitorTimer);
    dragMonitorTimer = null;
  }
}

function recreateDragController() {
  const effectiveHotzone = overlayHotzonePreview ?? config.hotzone;
  dragController = new DragSessionController({
    displayBounds: activeDisplayBounds,
    hotzone: effectiveHotzone,
    onEvent: handleDragEvent
  });
}

function getDisplayId(display) {
  return String(display.id);
}

function getDisplayById(displayId) {
  const allDisplays = screen.getAllDisplays();
  return allDisplays.find((item) => String(item.id) === String(displayId)) ?? null;
}

function resolveDisplayForHotzone(hotzone) {
  const configuredDisplay = hotzone?.displayId ? getDisplayById(hotzone.displayId) : null;
  if (configuredDisplay) {
    return configuredDisplay;
  }

  const preferredDisplay = hotzone?.preferredDisplayId ? getDisplayById(hotzone.preferredDisplayId) : null;
  return preferredDisplay ?? screen.getPrimaryDisplay();
}

function getVirtualDisplayBounds() {
  const allDisplays = screen.getAllDisplays();
  if (!allDisplays.length) {
    return screen.getPrimaryDisplay().bounds;
  }

  let minX = allDisplays[0].bounds.x;
  let minY = allDisplays[0].bounds.y;
  let maxX = allDisplays[0].bounds.x + allDisplays[0].bounds.width;
  let maxY = allDisplays[0].bounds.y + allDisplays[0].bounds.height;

  for (const item of allDisplays) {
    minX = Math.min(minX, item.bounds.x);
    minY = Math.min(minY, item.bounds.y);
    maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
    maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function getOverlayConfigPayload(hotzone, overlayBounds, headerHeight = HOTZONE_HEADER_HEIGHT) {
  return {
    displayBounds: activeDisplayBounds,
    virtualBounds: getVirtualDisplayBounds(),
    overlayBounds,
    hotzone,
    headerHeight,
    collapsed: overlayCollapsed,
    minWidthPx: sessionMinWidthPx,
    minHeightPx: sessionMinHeightPx,
    displayCount: screen.getAllDisplays().length
  };
}

function isSameRect(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function ensureWindowTopmost(windowRef) {
  if (!windowRef || windowRef.isDestroyed()) {
    return;
  }
  windowRef.moveTop();
}

function applyOverlayPinnedState(pinned) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const nextPinned = pinned === true;
  overlayWindow.setAlwaysOnTop(nextPinned, nextPinned ? "screen-saver" : "normal");
  if (nextPinned) {
    overlayWindow.moveTop();
  }
}

function createOrUpdateOverlayWindow(options = {}) {
  const { previewOnly = false, forceRendererSync = false, deferShowUntilReady = false } = options;
  const effectiveHotzone = overlayHotzonePreview ?? config.hotzone;
  const source = overlayHotzonePreview ? "preview" : "config";
  let display = resolveDisplayForHotzone(effectiveHotzone);
  let nextHotzone = {
    ...effectiveHotzone,
    displayId: getDisplayId(display)
  };
  let hotzoneRect = getHotzoneRect(display.bounds, nextHotzone);

  if (previewOnly) {
    hotzoneRect = getHotzoneRect(display.bounds, nextHotzone);
  }

  nextHotzone = {
    ...nextHotzone,
    xPx: hotzoneRect.x,
    yPx: hotzoneRect.y,
    widthPx: hotzoneRect.width,
    heightPx: hotzoneRect.height
  };
  if (previewOnly) {
    overlayHotzonePreview = nextHotzone;
  }

  const geometryChanged =
    nextHotzone.xPx !== effectiveHotzone.xPx ||
    nextHotzone.yPx !== effectiveHotzone.yPx ||
    nextHotzone.widthPx !== effectiveHotzone.widthPx ||
    nextHotzone.heightPx !== effectiveHotzone.heightPx ||
    nextHotzone.displayId !== effectiveHotzone.displayId;

  if (!nextHotzone.preferredDisplayId) {
    nextHotzone = {
      ...nextHotzone,
      preferredDisplayId: nextHotzone.displayId
    };
    if (previewOnly) {
      overlayHotzonePreview = nextHotzone;
    }
  }

  activeDisplayBounds = display.bounds;
  const overlayY = hotzoneRect.y - HOTZONE_HEADER_HEIGHT;
  const effectiveHeaderHeight = HOTZONE_HEADER_HEIGHT;
  const overlayHeight = overlayCollapsed ? Math.max(1, effectiveHeaderHeight) : hotzoneRect.height + effectiveHeaderHeight;
  const overlayBounds = {
    x: hotzoneRect.x,
    y: overlayY,
    width: hotzoneRect.width,
    height: overlayHeight
  };

  appendHotzoneDebug("overlay_window_update", {
    previewOnly,
    forceRendererSync,
    deferShowUntilReady,
    source,
    editing: false,
    selectedDisplayId: getDisplayId(display),
    activeDisplayBounds: display.bounds,
    overlayBounds,
    headerHeight: effectiveHeaderHeight,
    collapsed: overlayCollapsed,
    hotzone: {
      xPx: nextHotzone.xPx,
      yPx: nextHotzone.yPx,
      widthPx: nextHotzone.widthPx,
      heightPx: nextHotzone.heightPx,
      displayId: nextHotzone.displayId,
      preferredDisplayId: nextHotzone.preferredDisplayId
    }
  });

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const currentBounds = overlayWindow.getBounds();
    const boundsChanged = !isSameRect(currentBounds, overlayBounds);
    if (boundsChanged) {
      overlayWindow.setBounds({
        x: overlayBounds.x,
        y: overlayBounds.y,
        width: overlayBounds.width,
        height: overlayBounds.height
      });
    }

    if (!previewOnly) {
      recreateDragController();
      overlayWindow.webContents.send("drag-config", getOverlayConfigPayload(nextHotzone, overlayBounds, effectiveHeaderHeight));
    } else if (boundsChanged || geometryChanged || forceRendererSync) {
      recreateDragController();
      overlayWindow.webContents.send("drag-config", getOverlayConfigPayload(nextHotzone, overlayBounds, effectiveHeaderHeight));
    }
    applyOverlayPinnedState(nextHotzone.pinned === true);
    return;
  }

  overlayWindow = new BrowserWindow({
    x: overlayBounds.x,
    y: overlayBounds.y,
    width: overlayBounds.width,
    height: overlayBounds.height,
    frame: false,
    resizable: false,
    movable: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: nextHotzone.pinned === true,
    focusable: false,
    skipTaskbar: true,
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../renderer/overlay-preload.cjs")
    }
  });

  overlayWindow.setIgnoreMouseEvents(false, { forward: true });
  applyOverlayPinnedState(nextHotzone.pinned === true);

  overlayWindow.loadFile(join(__dirname, "../renderer/overlay.html"));

  recreateDragController();
  if (deferShowUntilReady) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    setHotzoneEnabled(true);
  }
  setPanelEventsEnabled(false);

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow.webContents.send("drag-config", getOverlayConfigPayload(nextHotzone, overlayBounds, effectiveHeaderHeight));
    if (deferShowUntilReady) {
      setHotzoneEnabled(overlayEventsEnabled);
    }
    applyOverlayPinnedState(nextHotzone.pinned === true);
    if (!startupOverlayLoadedLogged) {
      startupOverlayLoadedLogged = true;
      logStartupStep("overlay:did-finish-load");
    }
  });
}

function rebuildOverlayWindow(options = {}) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    overlayWindow = null;
    createOrUpdateOverlayWindow(options);
    return;
  }

  const previousWindow = overlayWindow;
  overlayWindow = null;
  createOrUpdateOverlayWindow({
    ...options,
    deferShowUntilReady: true
  });

  const nextWindow = overlayWindow;
  if (!nextWindow || nextWindow.isDestroyed()) {
    if (!previousWindow.isDestroyed()) {
      previousWindow.destroy();
    }
    return;
  }

  const destroyPrevious = () => {
    if (!previousWindow.isDestroyed()) {
      previousWindow.destroy();
    }
  };

  nextWindow.webContents.once("did-finish-load", destroyPrevious);
  setTimeout(destroyPrevious, 1500);
}

function updateSessionMinSize(configHotzone) {
  const widthPx = Number(configHotzone?.widthPx);
  const heightPx = Number(configHotzone?.heightPx);
  sessionMinWidthPx = Math.max(HOTZONE_MIN_WIDTH, Number.isFinite(widthPx) ? Math.round(widthPx) : HOTZONE_MIN_WIDTH);
  sessionMinHeightPx = Math.max(HOTZONE_MIN_HEIGHT, Number.isFinite(heightPx) ? Math.round(heightPx) : HOTZONE_MIN_HEIGHT);
}

function scheduleHotzonePreviewUpdate() {
  const now = Date.now();
  const elapsed = now - hotzonePreviewLastAppliedAt;

  if (elapsed >= HOTZONE_PREVIEW_THROTTLE_MS) {
    hotzonePreviewLastAppliedAt = now;
    if (hotzonePreviewTimer) {
      clearTimeout(hotzonePreviewTimer);
      hotzonePreviewTimer = null;
    }
    createOrUpdateOverlayWindow({ previewOnly: true });
    return;
  }

  if (hotzonePreviewTimer) {
    return;
  }

  hotzonePreviewTimer = setTimeout(() => {
    hotzonePreviewTimer = null;
    hotzonePreviewLastAppliedAt = Date.now();
    createOrUpdateOverlayWindow({ previewOnly: true });
  }, HOTZONE_PREVIEW_THROTTLE_MS - elapsed);
}

function handleDisplayTopologyChanged() {
  if (!config) {
    return;
  }

  const preferredDisplay = config.hotzone?.preferredDisplayId
    ? getDisplayById(config.hotzone.preferredDisplayId)
    : null;
  const runtimeDisplay = preferredDisplay ?? screen.getPrimaryDisplay();
  const runtimeDisplayId = getDisplayId(runtimeDisplay);
  if (config.hotzone.displayId !== runtimeDisplayId) {
    config = mergeConfig({
      ...config,
      hotzone: {
        ...config.hotzone,
        displayId: runtimeDisplayId
      }
    });
  }

  if (overlayHotzonePreview) {
    const previewDisplay = resolveDisplayForHotzone(overlayHotzonePreview);
    const previewDisplayId = getDisplayId(previewDisplay);
    if (overlayHotzonePreview.displayId !== previewDisplayId) {
      overlayHotzonePreview = {
        ...overlayHotzonePreview,
        displayId: previewDisplayId
      };
    }
  }

  createOrUpdateOverlayWindow();
  setHotzoneEnabled(overlayEventsEnabled);
}

function scheduleDisplayTopologyRebind() {
  if (displayTopologyTimer) {
    clearTimeout(displayTopologyTimer);
  }

  displayTopologyTimer = setTimeout(() => {
    displayTopologyTimer = null;
    if (hotzonePreviewTimer) {
      clearTimeout(hotzonePreviewTimer);
      hotzonePreviewTimer = null;
    }
    handleDisplayTopologyChanged();
  }, DISPLAY_TOPOLOGY_DEBOUNCE_MS);
}

function buildCommittedHotzone(baseHotzone) {
  const widthPx = Number(baseHotzone.widthPx) || 200;
  const heightPx = Number(baseHotzone.heightPx) || 300;
  const rawX = Number.isFinite(baseHotzone.xPx) ? baseHotzone.xPx : 0;
  const rawY = Number.isFinite(baseHotzone.yPx) ? baseHotzone.yPx : 0;
  const centerPoint = {
    x: Math.round(rawX + widthPx / 2),
    y: Math.round(rawY + heightPx / 2)
  };
  const resolvedDisplay = screen.getDisplayNearestPoint(centerPoint);
  const resolvedDisplayId = getDisplayId(resolvedDisplay);
  const normalizedBase = {
    ...baseHotzone,
    displayId: resolvedDisplayId,
    preferredDisplayId: resolvedDisplayId,
    pinned: baseHotzone.pinned === true
  };
  const rect = getHotzoneRect(resolvedDisplay.bounds, normalizedBase);
  return {
    ...normalizedBase,
    xPx: rect.x,
    yPx: rect.y,
    widthPx: rect.width,
    heightPx: rect.height
  };
}

function buildNextConfigWithHotzone(baseConfig, hotzonePatch = {}) {
  return mergeConfig({
    ...baseConfig,
    hotzone: {
      ...baseConfig.hotzone,
      ...hotzonePatch,
      edge: "top"
    },
    behavior: {
      ...baseConfig.behavior,
      expandDelayMs: 0
    }
  });
}

function getAnchorWindowBounds() {
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    return panelWindow.getBounds();
  }

  if (configWindow && !configWindow.isDestroyed() && configWindow.isVisible()) {
    return configWindow.getBounds();
  }

  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    return overlayWindow.getBounds();
  }

  return null;
}

function resolveNewFolderWindowPosition(width, height) {
  const anchorBounds = getAnchorWindowBounds();
  const defaultDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  let x = Math.round(defaultDisplay.workArea.x + (defaultDisplay.workArea.width - width) / 2);
  let y = Math.round(defaultDisplay.workArea.y + (defaultDisplay.workArea.height - height) / 2);

  if (anchorBounds) {
    x = Math.round(anchorBounds.x + (anchorBounds.width - width) / 2);
    y = Math.round(anchorBounds.y + (anchorBounds.height - height) / 2);
  }

  const targetDisplay = screen.getDisplayNearestPoint({
    x: x + Math.round(width / 2),
    y: y + Math.round(height / 2)
  });
  const workArea = targetDisplay.workArea;
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - width;
  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.round(clamp(x, minX, Math.max(minX, maxX))),
    y: Math.round(clamp(y, minY, Math.max(minY, maxY)))
  };
}

function getDialogParentWindow() {
  if (newFolderWindow && !newFolderWindow.isDestroyed() && newFolderWindow.isVisible()) {
    return newFolderWindow;
  }

  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    return panelWindow;
  }

  if (configWindow && !configWindow.isDestroyed() && configWindow.isVisible()) {
    return configWindow;
  }

  return null;
}

async function showOpenDirectoryDialogForContext({ title }) {
  const options = {
    properties: ["openDirectory"],
    title
  };
  const parentWindow = getDialogParentWindow();
  if (parentWindow) {
    return dialog.showOpenDialog(parentWindow, options);
  }

  const hotzoneDisplay = resolveDisplayForHotzone(overlayHotzonePreview ?? config?.hotzone);
  const anchorX = Math.round(hotzoneDisplay.workArea.x + hotzoneDisplay.workArea.width / 2);
  const anchorY = Math.round(hotzoneDisplay.workArea.y + hotzoneDisplay.workArea.height / 2);
  const anchorWindow = new BrowserWindow({
    width: 1,
    height: 1,
    x: anchorX,
    y: anchorY,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: true,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    return await dialog.showOpenDialog(anchorWindow, options);
  } finally {
    if (!anchorWindow.isDestroyed()) {
      anchorWindow.destroy();
    }
  }
}

ipcMain.on("overlay:drag-position", (_event, payload) => {
  if (!overlayEventsEnabled) {
    return;
  }
  if (!dragController) {
    return;
  }
  if (Array.isArray(payload.paths)) {
    currentDragPaths = payload.paths;
  }
  dragController.handleDragPosition(payload);
});

ipcMain.on("overlay:drag-end", () => {
  if (!overlayEventsEnabled) {
    return;
  }
  if (!dragController) {
    return;
  }
  dragController.endDrag();
  stopDragMonitor();
  currentDragPaths = [];
});

ipcMain.on("panel:drag-position", (_event, payload) => {
  if (!panelEventsEnabled) {
    return;
  }
  if (!dragController) {
    return;
  }
  if (Array.isArray(payload.paths)) {
    currentDragPaths = payload.paths;
  }
  dragController.handleDragPosition(payload);
});

ipcMain.on("panel:drag-end", () => {
  if (!dragController) {
    return;
  }
  dragController.endDrag();
  stopDragMonitor();
  currentDragPaths = [];
});

ipcMain.on("panel:drop-target", async (_event, payload) => {
  const targetPath = payload?.targetPath;
  const isCreateFolderTarget = targetPath === "__CREATE_FOLDER__";

  if (isCreateFolderTarget) {
    const result = await showOpenDirectoryDialogForContext({ title: "选择新建文件夹的位置" });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    const sourcePathsForCreate =
      Array.isArray(payload?.sourcePaths) && payload.sourcePaths.length > 0
        ? payload.sourcePaths
        : currentDragPaths;

    pendingCreateFolderContext = {
      parentPath: result.filePaths[0],
      sourcePaths: sourcePathsForCreate
    };
    showNewFolderWindow(result.filePaths[0]);
    return;
  }

  if (typeof targetPath !== "string" || targetPath.length === 0) {
    return;
  }

  const sourcePaths =
    Array.isArray(payload?.sourcePaths) && payload.sourcePaths.length > 0
      ? payload.sourcePaths
      : currentDragPaths;

  const action = inferAction(config.behavior.defaultAction);

  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
    if (tray) {
      tray.displayBalloon({
        iconType: "warning",
        title: "dragFree",
        content: "未获取到拖拽文件，未执行复制/移动。"
      });
    }
    return;
  }

  console.debug("[dragFree] drop-target", {
    targetPath,
    sourceCount: sourcePaths.length,
    preview: sourcePaths.slice(0, 3),
    action
  });

  console.info(`[dragFree] drop requested -> target: ${targetPath}, action: ${action}`);

  const result = await routeEntries({
    sourcePaths,
    targetDirectory: targetPath,
    action
  });

  console.debug("[dragFree] route-result", result);
  console.info(
    `[dragFree] drop completed -> target: ${targetPath}, status: ${result.status}, copied: ${result.copiedCount}, moved: ${result.movedCount}, errors: ${result.errors.length}`
  );

  if (action === "move" && (result.status === "success" || result.status === "partial-failed")) {
    const moveCheck = await verifyMoveOperation(sourcePaths, result);
    console.info(
      `[dragFree] move verify -> target: ${targetPath}, sourceRemoved: ${moveCheck.sourceRemovedCount}/${moveCheck.checkedCount}, stillExists: ${moveCheck.stillExistsCount}`
    );
  }

  if (result.status === "failed" || result.status === "partial-failed") {
    if (tray) {
      tray.displayBalloon({
        iconType: "error",
        title: "dragFree",
        content: `文件处理失败：${result.errors.length} 项` 
      });
    }
  }

  finalizeDropUiState();
  await settleUiThenOpenTargetFolder(targetPath, result);
});

ipcMain.on("new-folder:cancel", () => {
  closeNewFolderWindow();
  pendingCreateFolderContext = null;
});

ipcMain.on("new-folder:submit", async (_event, folderName) => {
  if (!pendingCreateFolderContext) {
    return;
  }

  const safeName = typeof folderName === "string" && folderName.trim().length > 0 ? folderName.trim() : "New Folder";
  const targetDirectory = join(pendingCreateFolderContext.parentPath, safeName);

  const exists = await checkPathExists(targetDirectory);
  if (exists) {
    if (newFolderWindow && !newFolderWindow.isDestroyed()) {
      newFolderWindow.webContents.send("new-folder:conflict", {
        message: `已存在同名文件夹：${basename(targetDirectory)}，请修改名称。`
      });
    }
    return;
  }

  let dropResult = null;
  let shouldOpenTarget = false;
  try {
    await mkdir(targetDirectory, { recursive: true });

    const result = await routeEntries({
      sourcePaths: pendingCreateFolderContext.sourcePaths,
      targetDirectory,
      action: inferAction(config.behavior.defaultAction)
    });
    dropResult = result;
    shouldOpenTarget = true;

    if (result.status === "failed" || result.status === "partial-failed") {
      if (tray) {
        tray.displayBalloon({
          iconType: "error",
          title: "dragFree",
          content: `文件处理失败：${result.errors.length} 项`
        });
      }
    }

  } catch (error) {
    if (tray) {
      tray.displayBalloon({
        iconType: "error",
        title: "dragFree",
        content: error instanceof Error ? error.message : "新建文件夹失败"
      });
    }
  } finally {
    finalizeDropUiState({ closeFolderWindow: true });
    if (shouldOpenTarget && dropResult) {
      await settleUiThenOpenTargetFolder(targetDirectory, dropResult);
    }
  }
});

async function checkPathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function verifyMoveOperation(sourcePaths, routeResult) {
  const checkedPaths = sourcePaths.slice(0, routeResult.movedCount);
  let sourceRemovedCount = 0;
  let stillExistsCount = 0;

  for (const sourcePath of checkedPaths) {
    const exists = await checkPathExists(sourcePath);
    if (exists) {
      stillExistsCount += 1;
    } else {
      sourceRemovedCount += 1;
    }
  }

  return {
    checkedCount: checkedPaths.length,
    sourceRemovedCount,
    stillExistsCount
  };
}

async function openTargetFolderAfterDropIfNeeded(targetPath, routeResult) {
  if (!config?.behavior?.openTargetFolderOnDropSuccess) {
    return;
  }

  const succeeded = routeResult?.status === "success";
  const partialSucceeded =
    routeResult?.status === "partial-failed" &&
    ((Number(routeResult?.copiedCount) || 0) + (Number(routeResult?.movedCount) || 0) > 0);

  if (!succeeded && !partialSucceeded) {
    return;
  }

  try {
    const result = await shell.openPath(targetPath);
    if (result) {
      console.error(`[dragFree] open target folder failed: ${result}`);
    }
  } catch (error) {
    console.error("[dragFree] open target folder failed", error);
  }
}

async function settleUiThenOpenTargetFolder(targetPath, routeResult) {
  await new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
  await openTargetFolderAfterDropIfNeeded(targetPath, routeResult);
}

function finalizeDropUiState({ closeFolderWindow = false } = {}) {
  if (closeFolderWindow) {
    closeNewFolderWindow();
  }
  pendingCreateFolderContext = null;
  if (dragController) {
    dragController.endDrag();
  }
  stopDragMonitor();
  currentDragPaths = [];
  setPanelEventsEnabled(false);
  setHotzoneEnabled(true);
}

ipcMain.on("panel:open-config", () => {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.show();
    configWindow.focus();
  }
});

ipcMain.handle("panel:get-active", async () => ({ enabled: panelEventsEnabled }));

ipcMain.handle("panel:list-children", async (_event, folderPath) => {
  if (typeof folderPath !== "string" || folderPath.length === 0) {
    return [];
  }

  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        id: `${folderPath}::${entry.name}`,
        name: entry.name,
        path: join(folderPath, entry.name)
      }));
  } catch {
    return [];
  }
});

ipcMain.handle("config:get", async () => ({
  ...config,
  _state: getConfigStateFlags()
}));

ipcMain.handle("config:pick-folder", async () => {
  const result = await showOpenDirectoryDialogForContext({ title: "选择常用文件夹" });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("config:save", async (_event, nextConfig) => {
  try {
    const runtimeHotzone = overlayHotzonePreview ?? config.hotzone;
    const mergedRuntime = mergeConfig({
      ...config,
      ...nextConfig,
      hotzone: {
        ...runtimeHotzone,
        ...(nextConfig.hotzone ?? {}),
        edge: "top",
        xPx: runtimeHotzone.xPx,
        yPx: runtimeHotzone.yPx,
        widthPx: runtimeHotzone.widthPx,
        heightPx: runtimeHotzone.heightPx,
        displayId: runtimeHotzone.displayId,
        preferredDisplayId: runtimeHotzone.preferredDisplayId ?? runtimeHotzone.displayId,
        pinned:
          typeof nextConfig.hotzone?.pinned === "boolean"
            ? nextConfig.hotzone.pinned
            : runtimeHotzone.pinned === true
      },
      behavior: {
        ...config.behavior,
        ...(nextConfig.behavior ?? {}),
        expandDelayMs: 0
      },
      folders: Array.isArray(nextConfig.folders) ? nextConfig.folders : config.folders
    });
    config = mergedRuntime;
    overlayHotzonePreview = config.hotzone;
    markConfigDirty("config_save_runtime");
    createOrUpdateOverlayWindow();
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send("panel-config", {
        folders: config.folders,
        behavior: config.behavior
      });
    }
    return {
      ok: true,
      data: {
        ...config,
        _state: getConfigStateFlags()
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存失败"
    };
  }
});

ipcMain.on("overlay:hotzone-preview", (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const merged = buildNextConfigWithHotzone(config, payload);
  overlayHotzonePreview = merged.hotzone;
  config = merged;
  markConfigDirty("overlay_hotzone_preview");
  scheduleHotzonePreviewUpdate();
});

ipcMain.on("overlay:debug-snapshot", (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return;
  }

  appendHotzoneDebug("renderer_snapshot", payload);
});

ipcMain.handle("overlay:hotzone-commit", async (_event, payload) => {
  try {
    appendHotzoneDebug("lock_commit_request", {
      payload,
      source: overlayHotzonePreview ? "preview" : "config",
      baseHotzone: {
        ...(overlayHotzonePreview ?? config.hotzone)
      }
    });
    if (hotzonePreviewTimer) {
      clearTimeout(hotzonePreviewTimer);
      hotzonePreviewTimer = null;
    }

    const latestBase = overlayHotzonePreview ?? config.hotzone;
    const latestWithPayload = {
      ...latestBase,
      ...(payload ?? {})
    };
    const committedHotzone = buildCommittedHotzone(latestWithPayload);
    const merged = buildNextConfigWithHotzone(config, committedHotzone);
    config = merged;
    markConfigDirty("overlay_hotzone_commit");
    const flushResult = await flushRuntimeConfigToDisk("overlay_hotzone_commit_flush");
    if (!flushResult.ok) {
      throw new Error("flush_failed");
    }
    appendHotzoneDebug("lock_commit_applied", {
      committedHotzone,
      configHotzone: config.hotzone
    });
    overlayHotzonePreview = null;
    createOrUpdateOverlayWindow({ forceRendererSync: true });
    return { ok: true, hotzone: config.hotzone };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "保存热区失败"
    };
  }
});

ipcMain.handle("config:flush", async () => {
  try {
    const result = await flushRuntimeConfigToDisk("explicit_flush");
    return {
      ok: true,
      data: {
        ...result.data,
        _state: result.state
      },
      skipped: result.skipped
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "落盘失败"
    };
  }
});

ipcMain.handle("overlay:set-text-editing", async (_event, payload) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return { ok: false };
  }

  const editing = payload?.editing === true;
  try {
    overlayWindow.setFocusable(editing);
    if (editing) {
      overlayWindow.focus();
    } else {
      overlayWindow.blur();
      overlayWindow.setIgnoreMouseEvents(false, { forward: true });
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("overlay:set-pinned", async (_event, payload) => {
  const pinned = payload?.pinned === true;
  try {
    config = mergeConfig({
      ...config,
      hotzone: {
        ...config.hotzone,
        pinned
      }
    });
    if (overlayHotzonePreview) {
      overlayHotzonePreview = {
        ...overlayHotzonePreview,
        pinned
      };
    }
    markConfigDirty("overlay_set_pinned");
    applyOverlayPinnedState(pinned);
    createOrUpdateOverlayWindow({ forceRendererSync: true });
    return { ok: true, pinned };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "切换置顶失败"
    };
  }
});

ipcMain.handle("overlay:set-collapsed", async (_event, payload) => {
  overlayCollapsed = payload?.collapsed === true;
  try {
    if (overlayCollapsed) {
      if (dragController) {
        dragController.endDrag();
      }
      stopDragMonitor();
      setPanelEventsEnabled(false);
    }
    createOrUpdateOverlayWindow({ forceRendererSync: true });
    return { ok: true, collapsed: overlayCollapsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "切换折叠失败"
    };
  }
});

ipcMain.handle("overlay:cycle-display", async () => {
  if (!config) {
    return { ok: false };
  }

  const allDisplays = screen.getAllDisplays();
  if (allDisplays.length <= 1) {
    return { ok: false, reason: "single-display" };
  }

  const currentHotzone = overlayHotzonePreview ?? config.hotzone;
  const currentDisplay = resolveDisplayForHotzone(currentHotzone);
  const currentIndex = allDisplays.findIndex((item) => String(item.id) === String(currentDisplay.id));
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % allDisplays.length : 0;
  const nextDisplay = allDisplays[nextIndex];
  const currentBounds = currentDisplay.bounds;
  const nextBounds = nextDisplay.bounds;

  const currentWidth = Math.max(1, Number(currentHotzone.widthPx) || 200);
  const currentHeight = Math.max(1, Number(currentHotzone.heightPx) || 300);
  const nextWidth = Math.min(nextBounds.width, Math.max(sessionMinWidthPx, currentWidth));
  const nextHeight = Math.min(nextBounds.height, Math.max(sessionMinHeightPx, currentHeight));

  const currentXSpan = Math.max(1, currentBounds.width - currentWidth);
  const currentYSpan = Math.max(1, currentBounds.height - currentHeight);
  const rawX = Number.isFinite(currentHotzone.xPx) ? currentHotzone.xPx : currentBounds.x;
  const rawY = Number.isFinite(currentHotzone.yPx) ? currentHotzone.yPx : currentBounds.y;

  const ratioX = (rawX - currentBounds.x) / currentXSpan;
  const ratioY = (rawY - currentBounds.y) / currentYSpan;
  const normalizedRatioX = Math.min(1, Math.max(0, ratioX));
  const normalizedRatioY = Math.min(1, Math.max(0, ratioY));

  const nextXSpan = Math.max(0, nextBounds.width - nextWidth);
  const minNextY = Math.min(nextBounds.y + HOTZONE_HEADER_HEIGHT, nextBounds.y + Math.max(0, nextBounds.height - nextHeight));
  const maxNextY = nextBounds.y + Math.max(0, nextBounds.height - nextHeight);
  const nextYSpan = Math.max(0, maxNextY - minNextY);
  const nextX = Math.round(nextBounds.x + normalizedRatioX * nextXSpan);
  const nextY = Math.round(minNextY + normalizedRatioY * nextYSpan);
  const nextDisplayId = getDisplayId(nextDisplay);

  config = mergeConfig({
    ...config,
    hotzone: {
      ...config.hotzone,
      ...currentHotzone,
      displayId: nextDisplayId,
      preferredDisplayId: nextDisplayId,
      xPx: nextX,
      yPx: nextY,
      widthPx: nextWidth,
      heightPx: nextHeight
    }
  });
  overlayHotzonePreview = config.hotzone;
  markConfigDirty("overlay_cycle_display");
  rebuildOverlayWindow({ forceRendererSync: true });

  return {
    ok: true,
    displayId: nextDisplayId,
    hotzone: config.hotzone
  };
});

function showNewFolderWindow(parentPath) {
  closeNewFolderWindow();

  const width = 420;
  const height = 220;
  const { x, y } = resolveNewFolderWindowPosition(width, height);

  newFolderWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    modal: true,
    parent: configWindow,
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../renderer/new-folder-preload.cjs")
    }
  });

  newFolderWindow.setAlwaysOnTop(true, "screen-saver");
  newFolderWindow.moveTop();

  newFolderWindow.loadFile(join(__dirname, "../renderer/new-folder.html"));
  newFolderWindow.once("ready-to-show", () => {
    newFolderWindow.show();
    newFolderWindow.focus();
    newFolderWindow.moveTop();
    newFolderWindow.webContents.send("new-folder:init", { parentPath });
  });
}

function closeNewFolderWindow() {
  if (newFolderWindow && !newFolderWindow.isDestroyed()) {
    newFolderWindow.close();
  }
  newFolderWindow = null;
}

async function bootstrap() {
  await initStartupLogger();
  await initHotzoneDebugLogger();
  logStartupStep("bootstrap:start");
  const userDataPath = app.getPath("userData");
  configFilePath = join(userDataPath, "dragfree", "config.json");
  logStartupStep("bootstrap:config-read:start", configFilePath);
  config = await readConfigFromFile(configFilePath);
  logStartupStep("bootstrap:config-read:done");
  config = mergeConfig({
    ...config,
    hotzone: {
      ...config.hotzone,
      displayId: config.hotzone?.displayId ?? getDisplayId(screen.getPrimaryDisplay()),
      preferredDisplayId:
        config.hotzone?.preferredDisplayId ??
        config.hotzone?.displayId ??
        getDisplayId(screen.getPrimaryDisplay())
    }
  });
  updateSessionMinSize(config.hotzone);
  markConfigPersisted("bootstrap_loaded");
  logStartupStep("bootstrap:config-merge:done");

  logStartupStep("bootstrap:overlay:init:start");
  createOrUpdateOverlayWindow();
  logStartupStep("bootstrap:overlay:init:done");

  setTimeout(() => {
    logStartupStep("bootstrap:deferred-init:start");
    createConfigWindow();
    createTray();
    screen.on("display-added", scheduleDisplayTopologyRebind);
    screen.on("display-removed", scheduleDisplayTopologyRebind);
    screen.on("display-metrics-changed", scheduleDisplayTopologyRebind);
    logStartupStep("bootstrap:deferred-init:done");
  }, 0);

  logStartupStep("bootstrap:done");
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const windowRef = createConfigWindow();
    if (windowRef && !windowRef.isDestroyed()) {
      if (windowRef.isMinimized()) {
        windowRef.restore();
      }
      windowRef.show();
      windowRef.focus();
    }
  });

  app.whenReady()
    .then(() => {
      logStartupStep("app:whenReady");
      return bootstrap();
    })
    .catch((error) => {
      logStartupStep("bootstrap:error", error instanceof Error ? error.message : String(error));
      console.error("Failed to bootstrap app:", error);
      app.quit();
    });
}

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  if (quitFlushInProgress || quitFlushCompleted) {
    return;
  }

  if (!configDirty) {
    return;
  }

  quitFlushInProgress = true;
  flushRuntimeConfigToDisk("before_quit").finally(() => {
    quitFlushInProgress = false;
    quitFlushCompleted = true;
  });
});

export function getLoadedConfig() {
  return config;
}
