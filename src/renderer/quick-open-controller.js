const HOVER_QUERY_DELAY_MS = 500;
const SCROLL_ZONE_SPEED_PX_PER_SEC = 200;
const SCROLL_ZONE_TICK_MS = 60;
const SCROLL_ZONE_STEP_PX = Math.max(1, Math.round((SCROLL_ZONE_SPEED_PX_PER_SEC * SCROLL_ZONE_TICK_MS) / 1000));

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

export function createQuickOpenController({ root }) {
  const panelRoot = root.querySelector(".panel");
  const breadcrumbsContainer = root.querySelector("[data-breadcrumbs]");
  const listItemsContainer = root.querySelector("[data-directory-items]");
  const listContainer = root.querySelector("[data-directory-list]");
  const childHint = root.querySelector("[data-child-hint]");
  const childMeta = root.querySelector("[data-child-meta]");
  const emptyState = root.querySelector("[data-empty-state]");
  const scrollZoneUp = root.querySelector("[data-scroll-zone='up']");
  const scrollZoneDown = root.querySelector("[data-scroll-zone='down']");

  let folders = [];
  let breadcrumbSeparator = "/";
  let hoverDelayMs = HOVER_QUERY_DELAY_MS;
  let panelViewMode = "list";
  let panelTileSize = "large";

  let activePathChain = [];
  let currentPath = null;
  let currentItems = [];
  let currentItemsSource = "root";
  let pendingHoverTimer = null;
  let pendingHoverToken = "";
  let requestSeq = 0;

  let scrollZoneTicker = null;
  let scrollZoneDirection = null;

  const childrenCache = new Map();

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

  if (scrollZoneUp) {
    scrollZoneUp.addEventListener("mouseenter", () => {
      clearPendingHover();
    });
  }
  if (scrollZoneDown) {
    scrollZoneDown.addEventListener("mouseenter", () => {
      clearPendingHover();
    });
  }
  if (listContainer) {
    listContainer.addEventListener("scroll", () => {
      clearPendingHover();
    });
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

  function showScrollZones() {
    if (!listContainer || !scrollZoneUp || !scrollZoneDown) {
      return;
    }
    const isScrollable = listContainer.scrollHeight > listContainer.clientHeight;
    scrollZoneUp.classList.toggle("show", isScrollable);
    scrollZoneDown.classList.toggle("show", isScrollable);
  }

  function clearPendingHover() {
    if (pendingHoverTimer !== null) {
      clearTimeout(pendingHoverTimer);
      pendingHoverTimer = null;
    }
    pendingHoverToken = "";
  }

  function getHoverDelay() {
    return Math.max(200, Math.min(3000, hoverDelayMs));
  }

  function updateHintAndMeta() {
    const delaySec = (getHoverDelay() / 1000).toFixed(1);
    if (currentItemsSource === "root") {
      childHint.textContent = `悬停${delaySec}s后查下层；单击立即打开`;
      childMeta.textContent = `${currentItems.length} 个常用文件夹`;
      return;
    }

    if (currentItems.length === 0) {
      childHint.textContent = "当前目录无子目录，可点击打开该目录。";
      childMeta.textContent = "";
      return;
    }

    childHint.textContent = `悬停${delaySec}s后可继续下钻，单击立即打开`;
    childMeta.textContent = `${currentItems.length} 个子目录`;
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

  function setBreadcrumbContent(node, text) {
    node.textContent = "";
    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = text;
    node.title = text;
    node.append(label);
  }

  function setChipContent(node, text) {
    node.textContent = "";
    const icon = document.createElement("span");
    icon.className = "chip-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📂";

    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = text;
    node.title = text;

    node.append(icon, label);
  }

  function applyPathChain(chain) {
    activePathChain = Array.isArray(chain) ? chain : [];
    currentPath = activePathChain.length > 0 ? activePathChain[activePathChain.length - 1].path : null;
  }

  async function openPath(path) {
    if (typeof path !== "string" || path.length === 0) {
      return;
    }
    await window.quickOpenApi.openPath(path);
  }

  async function queryChildren(path) {
    if (childrenCache.has(path)) {
      return childrenCache.get(path);
    }
    const children = await window.quickOpenApi.listChildren(path);
    const normalized = Array.isArray(children)
      ? children.map((item) => normalizeFolder(item, "child")).filter(Boolean)
      : [];
    childrenCache.set(path, normalized);
    return normalized;
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

      chip.addEventListener("mouseenter", () => {
        if (index === 0) {
          setRootItems();
          return;
        }
        if (!item.path) {
          return;
        }
        clearPendingHover();
        const token = `breadcrumb:${index}:${item.path}`;
        pendingHoverToken = token;
        pendingHoverTimer = setTimeout(async () => {
          if (pendingHoverToken !== token) {
            return;
          }
          const localSeq = ++requestSeq;
          const children = await queryChildren(item.path);
          if (localSeq !== requestSeq) {
            return;
          }
          if (children.length === 0) {
            childHint.textContent = `${item.name} 无子目录，点击可直接打开`;
            childMeta.textContent = "";
            return;
          }
          applyPathChain(activePathChain.slice(0, index));
          currentItemsSource = "children";
          currentItems = children;
          render();
        }, getHoverDelay());
      });

      chip.addEventListener("click", () => {
        if (index === 0) {
          setRootItems();
          return;
        }
        if (!item.path) {
          return;
        }
        openPath(item.path);
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

  function renderCurrentItems() {
    listItemsContainer.innerHTML = "";
    if (currentItems.length === 0) {
      emptyState.style.display = "block";
      updateHintAndMeta();
      showScrollZones();
      return;
    }

    emptyState.style.display = "none";
    for (const item of currentItems) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "folder-chip";
      chip.dataset.path = item.path;
      chip.dataset.name = item.name;
      chip.dataset.folderId = item.id;
      setChipContent(chip, item.name);

      chip.addEventListener("mouseenter", () => {
        clearPendingHover();
        const token = `path:${item.path}`;
        pendingHoverToken = token;
        pendingHoverTimer = setTimeout(async () => {
          if (pendingHoverToken !== token) {
            return;
          }
          const localSeq = ++requestSeq;
          const children = await queryChildren(item.path);
          if (localSeq !== requestSeq) {
            return;
          }
          if (children.length === 0) {
            childHint.textContent = `${item.name} 无子目录，点击可直接打开`;
            childMeta.textContent = "";
            return;
          }

          const existingIndex = activePathChain.findIndex((entry) => entry.path === item.path);
          let nextChain;
          if (existingIndex >= 0) {
            nextChain = activePathChain.slice(0, existingIndex + 1);
          } else {
            nextChain = [...activePathChain, { id: item.id, path: item.path, name: item.name }];
          }
          applyPathChain(nextChain);
          currentItemsSource = "children";
          currentItems = children;
          render();
        }, getHoverDelay());
      });
      chip.addEventListener("mouseleave", () => {
        clearPendingHover();
      });

      chip.addEventListener("click", () => {
        openPath(item.path);
      });

      listItemsContainer.appendChild(chip);
    }

    updateHintAndMeta();
    showScrollZones();
  }

  function setRootItems() {
    const rootItems = folders.map((item) => normalizeFolder(item, "root")).filter(Boolean);
    currentItemsSource = "root";
    currentItems = rootItems;
    applyPathChain([]);
    render();
  }

  function render() {
    renderBreadcrumbs();
    renderCurrentItems();
  }

  window.quickOpenApi.onConfig((payload) => {
    folders = Array.isArray(payload.folders) ? payload.folders : [];
    breadcrumbSeparator = payload.behavior?.breadcrumbSeparator === ">" ? ">" : "/";
    hoverDelayMs = Math.max(200, Math.min(3000, Number(payload.behavior?.quickOpenHoverDelayMs) || 500));
    panelViewMode = payload.behavior?.panelViewMode === "tile" ? "tile" : "list";
    panelTileSize =
      payload.behavior?.panelTileSize === "small"
        ? "small"
        : payload.behavior?.panelTileSize === "medium"
          ? "medium"
          : "large";
    applyViewModeClass();
    childrenCache.clear();
    clearPendingHover();
    requestSeq += 1;
    stopZoneScroll();
    setRootItems();
  });

  window.quickOpenApi.onReset(() => {
    clearPendingHover();
    requestSeq += 1;
    childrenCache.clear();
  });

  return {
    close() {
      window.quickOpenApi.close();
    }
  };
}
