const HOVER_QUERY_DELAY_MS = 220;
const DEFAULT_POST_QUERY_COOLDOWN_MS = 300;
const SCROLL_ZONE_SPEED_PX_PER_SEC = 200;
const SCROLL_ZONE_TICK_MS = 60;
const SCROLL_ZONE_STEP_PX = Math.max(1, Math.round((SCROLL_ZONE_SPEED_PX_PER_SEC * SCROLL_ZONE_TICK_MS) / 1000));

function getDraggedPathsFromEvent(event) {
  const files = event.dataTransfer?.files;
  if (!files) {
    return [];
  }

  const paths = [];
  for (const file of files) {
    const resolvedPath = window.panelApi.getPathForFile(file);
    if (typeof resolvedPath === "string" && resolvedPath.length > 0) {
      paths.push(resolvedPath);
    }
  }
  return paths;
}

function normalizeFolder(item, fallbackIdPrefix = "node") {
  if (!item || typeof item.path !== "string" || item.path.length === 0) {
    return null;
  }

  const rawName = typeof item.name === "string" && item.name.length > 0 ? item.name : item.path;
  return {
    id: typeof item.id === "string" && item.id.length > 0 ? item.id : `${fallbackIdPrefix}-${item.path}`,
    name: rawName,
    path: item.path
  };
}

export function createPanelController({ root }) {
  const panelRoot = root.querySelector(".panel");
  const breadcrumbsContainer = root.querySelector("[data-breadcrumbs]");
  const listContainer = root.querySelector("[data-directory-list]");
  const listItemsContainer = root.querySelector("[data-directory-items]");
  const scrollZoneUp = root.querySelector("[data-scroll-zone='up']");
  const scrollZoneDown = root.querySelector("[data-scroll-zone='down']");
  const parentActionsContainer = root.querySelector("[data-parent-actions]");
  const emptyDropZone = root.querySelector("[data-empty-drop-zone]");
  const childHint = root.querySelector("[data-child-hint]");
  const childMeta = root.querySelector("[data-child-meta]");
  const emptyState = root.querySelector("[data-empty-state]");
  const openConfigButton = root.querySelector("[data-open-config]");

  let folders = [];
  let breadcrumbSeparator = "/";
  let panelViewMode = "list";
  let panelTileSize = "large";
  let pulseLevel = "high";
  let defaultAction = "copy";
  let sessionDropAction = null;
  let postQueryCooldownMs = DEFAULT_POST_QUERY_COOLDOWN_MS;

  let activePathChain = [];
  let currentPath = null;
  let currentItems = [];
  let currentItemsSource = "root";

  let pendingHoverTimer = null;
  let pendingHoverTargetPath = null;
  let pendingHoverAction = null;
  let lastQueryAt = 0;
  let hoverFocusNode = null;

  let inflightChildrenPath = null;
  let childrenRequestSeq = 0;
  const childrenCache = new Map();

  let scrollZoneTicker = null;
  let scrollZoneDirection = null;

  openConfigButton.addEventListener("click", () => {
    window.panelApi.openConfig();
  });

  function applyViewModeClass() {
    if (!panelRoot) {
      return;
    }
    panelRoot.classList.remove("panel-view-list", "panel-view-tile");
    panelRoot.classList.remove("panel-tile-large", "panel-tile-medium", "panel-tile-small");

    if (panelViewMode === "tile") {
      panelRoot.classList.add("panel-view-tile");
      panelRoot.classList.add(
        panelTileSize === "small"
          ? "panel-tile-small"
          : panelTileSize === "medium"
            ? "panel-tile-medium"
            : "panel-tile-large"
      );
      return;
    }

    panelRoot.classList.add("panel-view-list");
  }

  function applyPulseLevelClass() {
    if (!panelRoot) {
      return;
    }
    panelRoot.classList.remove("pulse-level-low", "pulse-level-medium", "pulse-level-high");
    panelRoot.classList.add(
      pulseLevel === "high" ? "pulse-level-high" : pulseLevel === "medium" ? "pulse-level-medium" : "pulse-level-low"
    );
  }

  function clearPendingHover() {
    if (pendingHoverTimer !== null) {
      clearTimeout(pendingHoverTimer);
      pendingHoverTimer = null;
    }
    pendingHoverTargetPath = null;
    pendingHoverAction = null;
  }

  function setHoverFocus(node) {
    if (hoverFocusNode && (!hoverFocusNode.isConnected || hoverFocusNode !== node)) {
      hoverFocusNode.classList.remove("hover-focus");
      hoverFocusNode = null;
    }

    if (!(node instanceof Element)) {
      return;
    }

    if (hoverFocusNode === node) {
      return;
    }

    node.classList.add("hover-focus");
    hoverFocusNode = node;
  }

  function setScrollZoneActive(direction = null) {
    if (scrollZoneUp) {
      scrollZoneUp.classList.toggle("active", direction === "up");
    }
    if (scrollZoneDown) {
      scrollZoneDown.classList.toggle("active", direction === "down");
    }
  }

  function stopZoneScroll() {
    if (scrollZoneTicker !== null) {
      clearInterval(scrollZoneTicker);
      scrollZoneTicker = null;
    }
    scrollZoneDirection = null;
    setScrollZoneActive(null);
  }

  function startZoneScroll(direction) {
    if (scrollZoneDirection === direction && scrollZoneTicker !== null) {
      return;
    }

    stopZoneScroll();
    scrollZoneDirection = direction;
    setScrollZoneActive(direction);
    scrollZoneTicker = setInterval(() => {
      const delta = direction === "down" ? SCROLL_ZONE_STEP_PX : -SCROLL_ZONE_STEP_PX;
      listContainer.scrollBy({ top: delta, behavior: "auto" });
    }, SCROLL_ZONE_TICK_MS);
  }

  function setChipContent(node, text) {
    node.textContent = "";
    const icon = document.createElement("span");
    icon.className = "chip-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📁";

    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = text;
    node.title = text;

    node.append(icon, label);
  }

  function normalizeAction(action) {
    return action === "move" ? "move" : "copy";
  }

  function getEffectiveDropAction() {
    return normalizeAction(sessionDropAction ?? defaultAction);
  }

  function applyDropEffect(event, allowDrop) {
    if (!event?.dataTransfer) {
      return;
    }
    if (!allowDrop) {
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.dataTransfer.dropEffect = getEffectiveDropAction() === "move" ? "move" : "copy";
  }

  function setBreadcrumbContent(node, text) {
    node.textContent = "";
    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = text;
    node.title = text;
    node.append(label);
  }

  function markDragHover(node) {
    if (!(node instanceof Element)) {
      return;
    }
    node.classList.add("drag-hover");
  }

  function clearDragHover(node) {
    if (!(node instanceof Element)) {
      return;
    }
    node.classList.remove("drag-hover");
  }

  function buildBreadcrumbRenderItems() {
    const rootItem = {
      id: "root",
      path: "",
      name: "常用文件夹"
    };

    const chain = [rootItem, ...activePathChain];
    if (chain.length <= 5) {
      return chain.map((item, index) => ({
        type: "item",
        item,
        index
      }));
    }

    return [
      { type: "item", item: chain[0], index: 0 },
      { type: "item", item: chain[1], index: 1 },
      { type: "ellipsis" },
      { type: "item", item: chain[chain.length - 2], index: chain.length - 2 },
      { type: "item", item: chain[chain.length - 1], index: chain.length - 1 }
    ];
  }

  function updateHintAndMeta() {
    childHint.classList.remove("success-tip");
    if (currentItemsSource === "root") {
      childHint.textContent = "悬停常用目录 220ms 后展开子目录";
      childMeta.textContent = `${currentItems.length} 个常用文件夹`;
      return;
    }

    if (currentItems.length === 0) {
      childHint.textContent = "当前目录无子目录，可直接投放到该目录。";
      childMeta.textContent = "";
      return;
    }

    childHint.textContent = "悬停目录 220ms 后查询；双闪后展开。";
    childMeta.textContent = `${currentItems.length} 个子目录`;
  }

  function showSuccessHint(action, count) {
    childHint.classList.add("success-tip");
    const suffix = Number.isFinite(count) && count > 0 ? `${count} 文件` : "文件";
    childHint.textContent = action === "move" ? `成功移动 ${suffix}` : `成功复制 ${suffix}`;
    childMeta.textContent = "";
  }

  function renderBreadcrumbs() {
    breadcrumbsContainer.innerHTML = "";
    const displayItems = buildBreadcrumbRenderItems();

    displayItems.forEach((displayItem, displayIndex) => {
      if (displayItem.type === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "breadcrumb-ellipsis";
        ellipsis.textContent = "...";
        breadcrumbsContainer.appendChild(ellipsis);

        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = breadcrumbSeparator;
        breadcrumbsContainer.appendChild(sep);
        return;
      }

      const { item, index } = displayItem;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "breadcrumb-chip interactive";
      chip.dataset.path = item.path;
      chip.dataset.breadcrumbIndex = String(index);
      chip.dataset.isRoot = index === 0 ? "1" : "0";
      setBreadcrumbContent(chip, item.name);

      if (index === 0) {
        chip.classList.add("is-root");
      }

      chip.addEventListener("dragenter", (event) => {
        markDragHover(chip);
        handleLiveHoverFromEvent(event);
      });
      chip.addEventListener("dragleave", () => {
        clearDragHover(chip);
        clearPendingHover();
      });
      chip.addEventListener("dragover", (event) => {
        const allowDrop = index > 0;
        applyDropEffect(event, allowDrop);
        if (allowDrop) {
          event.preventDefault();
        }
        handleLiveHoverFromEvent(event);
      });
      chip.addEventListener("drop", (event) => {
        clearDragHover(chip);
        if (index === 0) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        handleDropToPath(event, item.path);
      });

      breadcrumbsContainer.appendChild(chip);

      if (displayIndex < displayItems.length - 1 && displayItems[displayIndex + 1].type !== "ellipsis") {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = breadcrumbSeparator;
        breadcrumbsContainer.appendChild(sep);
      }
    });
  }

  function renderCreateAction() {
    if (!parentActionsContainer) {
      return;
    }
    parentActionsContainer.innerHTML = "";

    const createChip = document.createElement("button");
    createChip.type = "button";
    createChip.className = "chip create-chip";
    createChip.dataset.path = "__CREATE_FOLDER__";
    setChipContent(createChip, "新建文件夹并保存");
    createChip.addEventListener("dragenter", () => {
      markDragHover(createChip);
    });
    createChip.addEventListener("dragleave", () => {
      clearDragHover(createChip);
    });
    createChip.addEventListener("dragover", (event) => {
      applyDropEffect(event, true);
      event.preventDefault();
    });
    createChip.addEventListener("drop", (event) => {
      clearDragHover(createChip);
      handleDropToPath(event, "__CREATE_FOLDER__");
    });

    parentActionsContainer.appendChild(createChip);
  }

  function renderCurrentItems() {
    emptyState.style.display = "none";
    setHoverFocus(null);
    listItemsContainer.innerHTML = "";
    listContainer.style.display = "block";

    if (!currentItems || currentItems.length === 0) {
      if (scrollZoneUp) {
        scrollZoneUp.classList.remove("show");
      }
      if (scrollZoneDown) {
        scrollZoneDown.classList.remove("show");
      }
      stopZoneScroll();
      emptyDropZone.style.display = currentPath ? "flex" : "none";
      emptyDropZone.dataset.path = currentPath || "";
      updateHintAndMeta();
      return;
    }

    emptyDropZone.style.display = "none";
    emptyDropZone.dataset.path = "";

    for (const item of currentItems) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "folder-chip";
      chip.dataset.path = item.path;
      chip.dataset.name = item.name;
      chip.dataset.folderId = item.id;
      setChipContent(chip, item.name);

      chip.addEventListener("dragenter", (event) => {
        markDragHover(chip);
        handleLiveHoverFromEvent(event);
      });
      chip.addEventListener("dragleave", () => {
        clearDragHover(chip);
        clearPendingHover();
      });
      chip.addEventListener("dragover", (event) => {
        applyDropEffect(event, true);
        event.preventDefault();
        handleLiveHoverFromEvent(event);
      });
      chip.addEventListener("drop", (event) => {
        clearDragHover(chip);
        handleDropToPath(event, item.path);
      });

      listItemsContainer.appendChild(chip);
    }

    const isScrollable = listContainer.scrollHeight > listContainer.clientHeight;
    if (scrollZoneUp) {
      scrollZoneUp.classList.toggle("show", isScrollable);
    }
    if (scrollZoneDown) {
      scrollZoneDown.classList.toggle("show", isScrollable);
    }

    updateHintAndMeta();
  }

  function applyPathChain(chain) {
    activePathChain = Array.isArray(chain) ? chain : [];
    currentPath = activePathChain.length > 0 ? activePathChain[activePathChain.length - 1].path : null;
    renderBreadcrumbs();
  }

  function setRootItems() {
    const rootItems = folders.map((item) => normalizeFolder(item, "root")).filter(Boolean);
    currentItemsSource = "root";
    currentItems = rootItems;
    applyPathChain([]);
    renderCurrentItems();
  }

  function queryAndShowChildren(target) {
    if (!target || typeof target.path !== "string" || target.path.length === 0) {
      return;
    }

    const path = target.path;
    const name = target.name;
    currentPath = path;

    if (childrenCache.has(path)) {
      const cached = childrenCache.get(path);
      currentItemsSource = "children";
      currentItems = cached;
      renderCurrentItems();
      return;
    }

    inflightChildrenPath = path;
    const requestSeq = ++childrenRequestSeq;
    currentItemsSource = "children";
    childHint.textContent = `正在查询 ${name} 的子目录，可直接投放到该目录。`;
    childMeta.textContent = "";

    window.panelApi.listChildren(path).then((children) => {
      if (requestSeq !== childrenRequestSeq) {
        return;
      }
      inflightChildrenPath = null;
      const normalized = Array.isArray(children)
        ? children.map((item) => normalizeFolder(item, "child")).filter(Boolean)
        : [];
      childrenCache.set(path, normalized);
      if (currentPath !== path) {
        return;
      }
      currentItemsSource = "children";
      currentItems = normalized;
      renderCurrentItems();
    }).catch(() => {
      if (requestSeq !== childrenRequestSeq) {
        return;
      }
      inflightChildrenPath = null;
      if (currentPath !== path) {
        return;
      }
      currentItemsSource = "children";
      currentItems = [];
      renderCurrentItems();
    });
  }

  function navigateByBreadcrumbIndex(index) {
    if (index <= 0) {
      setRootItems();
      return;
    }

    const nextChain = activePathChain.slice(0, index);
    if (nextChain.length === 0) {
      setRootItems();
      return;
    }

    applyPathChain(nextChain);
    queryAndShowChildren(nextChain[nextChain.length - 1]);
  }

  function runHoverPulse(target) {
    let node = null;
    if (target instanceof Element) {
      node = target;
    } else if (typeof target === "string") {
      node = root.querySelector(`[data-path='${CSS.escape(target)}']`);
    }
    if (node) {
      node.classList.remove("pulse-twice");
      void node.offsetWidth;
      node.classList.add("pulse-twice");
    }
  }

  function scheduleHoverAction(path, action, pulseElement = null) {
    if (typeof path !== "string") {
      return;
    }

    if (path === currentPath || path === inflightChildrenPath) {
      return;
    }

    const now = Date.now();
    if (now - lastQueryAt < postQueryCooldownMs) {
      return;
    }

    if (pendingHoverTargetPath === path && pendingHoverTimer !== null) {
      return;
    }

    clearPendingHover();
    pendingHoverTargetPath = path;
    pendingHoverAction = action;
    pendingHoverTimer = setTimeout(() => {
      if (pendingHoverTargetPath !== path || pendingHoverAction !== action) {
        return;
      }
      pendingHoverTimer = null;
      pendingHoverTargetPath = null;
      pendingHoverAction = null;
      runHoverPulse(pulseElement || path);
      lastQueryAt = Date.now();
      action();
    }, HOVER_QUERY_DELAY_MS);
  }

  function resolveTargetElement(event) {
    const fromPoint = root.elementFromPoint?.(event.clientX, event.clientY);
    if (fromPoint instanceof Element) {
      return fromPoint;
    }

    if (event.target instanceof Element) {
      return event.target;
    }
    return null;
  }

  function handleLiveHoverFromEvent(event) {
    const target = resolveTargetElement(event);
    if (!target) {
      setHoverFocus(null);
      return;
    }

    const breadcrumbNode = target.closest(".breadcrumb-chip");
    if (breadcrumbNode) {
      setHoverFocus(breadcrumbNode);
      const index = Number.parseInt(breadcrumbNode.dataset.breadcrumbIndex || "-1", 10);
      if (Number.isInteger(index) && index >= 0) {
        const breadcrumbPath = breadcrumbNode.dataset.path || "";
        scheduleHoverAction(
          `breadcrumb:${index}`,
          () => {
            navigateByBreadcrumbIndex(index);
          },
          breadcrumbNode
        );
        if (breadcrumbPath.length > 0) {
          return;
        }
      }
      return;
    }

    const directoryNode = target.closest(".folder-chip");
    if (directoryNode) {
      setHoverFocus(directoryNode);
      const path = directoryNode.dataset.path;
      const name = directoryNode.dataset.name || directoryNode.title || "目录";
      const id = directoryNode.dataset.folderId || path;
      scheduleHoverAction(
        path,
        () => {
          const existingIndex = activePathChain.findIndex((entry) => entry.path === path);
          let nextChain;
          if (existingIndex >= 0) {
            nextChain = activePathChain.slice(0, existingIndex + 1);
          } else {
            nextChain = [...activePathChain, { id, path, name }];
          }
          applyPathChain(nextChain);
          queryAndShowChildren({ id, path, name });
        },
        directoryNode
      );
      return;
    }

    setHoverFocus(null);
  }

  function handleDropToPath(event, targetPath) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof targetPath !== "string" || targetPath.length === 0) {
      return;
    }

    window.panelApi.emitDropTarget({
      targetPath,
      sourcePaths: getDraggedPathsFromEvent(event),
      action: getEffectiveDropAction()
    });
  }

  function resolveDropHit(event) {
    const target = resolveTargetElement(event);
    if (!target) {
      return { type: "disabled", targetPath: null };
    }

    const directoryNode = target.closest(".folder-chip");
    if (directoryNode) {
      const path = directoryNode.dataset.path;
      if (typeof path === "string" && path.length > 0) {
        return { type: "directory-item", targetPath: path };
      }
    }

    const breadcrumbNode = target.closest(".breadcrumb-chip");
    if (breadcrumbNode) {
      const isRoot = breadcrumbNode.dataset.isRoot === "1";
      const path = breadcrumbNode.dataset.path;
      if (!isRoot && typeof path === "string" && path.length > 0) {
        return { type: "breadcrumb-item", targetPath: path };
      }
      return { type: "disabled", targetPath: null };
    }

    const createNode = target.closest(".create-chip");
    if (createNode) {
      return { type: "create-folder", targetPath: "__CREATE_FOLDER__" };
    }

    const inList = target.closest("[data-directory-list]");
    if (inList && typeof currentPath === "string" && currentPath.length > 0) {
      return { type: "list-empty-zone", targetPath: currentPath };
    }

    const inEmptyZone = target.closest("[data-empty-drop-zone]");
    if (inEmptyZone && typeof currentPath === "string" && currentPath.length > 0) {
      return { type: "empty-zone", targetPath: currentPath };
    }

    return { type: "disabled", targetPath: null };
  }

  function renderEmptyState() {
    clearPendingHover();
    inflightChildrenPath = null;
    childrenRequestSeq += 1;
    childrenCache.clear();
    currentPath = null;
    currentItems = [];
    activePathChain = [];

    emptyState.style.display = "block";
    listItemsContainer.innerHTML = "";
    listContainer.style.display = "none";
    if (scrollZoneUp) {
      scrollZoneUp.classList.remove("show");
    }
    if (scrollZoneDown) {
      scrollZoneDown.classList.remove("show");
    }
    stopZoneScroll();
    emptyDropZone.style.display = "none";
    emptyDropZone.dataset.path = "";
    childHint.textContent = "尚未配置常用文件夹";
    childMeta.textContent = "";
    renderBreadcrumbs();
    renderCreateAction();
  }

  function renderPreConfigState() {
    clearPendingHover();
    stopZoneScroll();
    setHoverFocus(null);
    listItemsContainer.innerHTML = "";
    if (parentActionsContainer) {
      parentActionsContainer.innerHTML = "";
    }
    activePathChain = [];
    currentPath = null;
    currentItems = [];
    currentItemsSource = "root";
    listContainer.style.display = "block";
    emptyDropZone.style.display = "none";
    emptyDropZone.dataset.path = "";
    emptyState.style.display = "none";
    if (scrollZoneUp) {
      scrollZoneUp.classList.remove("show");
    }
    if (scrollZoneDown) {
      scrollZoneDown.classList.remove("show");
    }
    childHint.textContent = "";
    childMeta.textContent = "";
    renderBreadcrumbs();
  }

  window.panelApi.onConfig((payload) => {
    folders = Array.isArray(payload.folders) ? payload.folders : [];
    breadcrumbSeparator = payload.behavior?.breadcrumbSeparator === ">" ? ">" : "/";
    defaultAction = payload.behavior?.defaultAction === "move" ? "move" : "copy";
    panelViewMode =
      payload.behavior?.panelViewMode === "tile"
          ? "tile"
          : "list";
    panelTileSize = payload.behavior?.panelTileSize === "small"
      ? "small"
      : payload.behavior?.panelTileSize === "medium"
        ? "medium"
        : "large";
    pulseLevel = payload.behavior?.pulseLevel === "medium" ? "medium" : payload.behavior?.pulseLevel === "low" ? "low" : "high";
    const followupSec = Number(payload.behavior?.hoverFollowupDelaySec ?? 0.3);
    postQueryCooldownMs = Number.isFinite(followupSec)
      ? Math.round(Math.max(0, Math.min(1, followupSec)) * 1000)
      : DEFAULT_POST_QUERY_COOLDOWN_MS;
    applyViewModeClass();
    applyPulseLevelClass();

    clearPendingHover();
    inflightChildrenPath = null;
    childrenRequestSeq += 1;
    childrenCache.clear();
    stopZoneScroll();

    if (folders.length === 0) {
      renderEmptyState();
      return;
    }

    emptyState.style.display = "none";
    renderCreateAction();
    setRootItems();
  });

  window.panelApi.onReset(() => {
    clearPendingHover();
    inflightChildrenPath = null;
    childrenRequestSeq += 1;
    stopZoneScroll();
    root.querySelectorAll(".drag-hover").forEach((node) => {
      node.classList.remove("drag-hover");
    });
    renderPreConfigState();
  });

  renderPreConfigState();

  return {
    handleWindowDragOver(event) {
      const hit = resolveDropHit(event);
      const target = resolveTargetElement(event);
      const zone = target?.closest?.(".scroll-zone")?.dataset?.scrollZone;
      if (zone === "up" || zone === "down") {
        setHoverFocus(null);
        startZoneScroll(zone === "up" ? "up" : "down");
      } else {
        stopZoneScroll();
        handleLiveHoverFromEvent(event);
      }

      const dropEffect = getEffectiveDropAction() === "move" ? "move" : "copy";
      if (hit.type === "list-empty-zone" || hit.type === "empty-zone") {
        listContainer.classList.add("drop-ready-parent");
        childHint.textContent = "当前空白区域可投放到该目录";
        return { allowDrop: true, dropEffect };
      }

      if (hit.type === "directory-item" || hit.type === "breadcrumb-item" || hit.type === "create-folder") {
        listContainer.classList.remove("drop-ready-parent");
        return { allowDrop: true, dropEffect };
      }

      listContainer.classList.remove("drop-ready-parent");
      updateHintAndMeta();
      return { allowDrop: false, dropEffect: "none" };
    },
    handleWindowDrop(event) {
      const hit = resolveDropHit(event);
      stopZoneScroll();
      event.preventDefault();
      event.stopPropagation();

      if (hit.targetPath) {
        const sourceCount = getDraggedPathsFromEvent(event).length;
        handleDropToPath(event, hit.targetPath);
        listContainer.classList.remove("drop-ready-parent");
        return { dropped: true, action: getEffectiveDropAction(), sourceCount };
      }

      listContainer.classList.remove("drop-ready-parent");
      return { dropped: false, action: null };
    },
    handleWindowDragLeave() {
      stopZoneScroll();
      clearPendingHover();
      setHoverFocus(null);
      root.querySelectorAll(".drag-hover").forEach((node) => {
        node.classList.remove("drag-hover");
      });
    },
    isLikelyOutsideWindow(event) {
      if (!event) {
        return false;
      }
      const width = window.innerWidth;
      const height = window.innerHeight;
      return event.clientX < 0 || event.clientY < 0 || event.clientX > width || event.clientY > height;
    },
    getState() {
      return {
        currentPath,
        configuredFoldersCount: folders.length
      };
    },
    setSessionDropAction(action) {
      sessionDropAction = normalizeAction(action);
    },
    showSuccessHint
  };
}
