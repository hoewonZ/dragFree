(function () {
  const STYLE_ID = "hotzone-display-editor-style";
  const DEFAULT_TEXT = "拖动文件到这里，或双击这里试试";
  const TEXT_SIZE_MIN_PX = 12;
  const TEXT_SIZE_STEP_PX = 4;
  const TEXT_SIZE_LEVEL_COUNT = 10;
  const TAB_LONG_PRESS_MS = 520;
  const TAB_MAX_COUNT = 8;
  const LIMITED_TEXT_MAX_LENGTH = 1000;
  const HEADER_COMPACT_THRESHOLD_PX = 140;
  const HTTP_URL_REGEX = /https?:\/\/[^\s]+/gi;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #hotzone-header {
        position: static;
        width: 100%;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        z-index: 13;
        pointer-events: auto;
      }

      .hotzone-header-left {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        flex: 1 1 auto;
        position: relative;
      }

      .hotzone-pin-toggle {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-pin-toggle[data-pinned="false"] {
        opacity: 0.5;
      }

      .hotzone-collapse-toggle {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-display-toggle {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-display-toggle[data-disabled="true"] {
        opacity: 0.45;
        cursor: default;
      }

      .hotzone-text-size-toggle {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        font-size: 13px;
        line-height: 1;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-text-size-toggle[data-disabled="true"] {
        opacity: 0.45;
        cursor: default;
      }

      .hotzone-interaction-toggle {
        min-width: 54px;
        height: 24px;
        border: 1px solid rgba(245, 248, 255, 0.38);
        background: rgba(10, 18, 35, 0.28);
        color: rgba(245, 248, 255, 0.92);
        cursor: pointer;
        padding: 0 6px;
        font-size: 11px;
        line-height: 1;
        border-radius: 8px;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-interaction-toggle[data-mode="quick-open"] {
        border-color: rgba(121, 234, 187, 0.55);
        background: rgba(33, 122, 98, 0.34);
        color: #d8fff0;
      }

      #mode-toggle {
        display: none !important;
      }

      #hotzone-tab-list {
        display: inline-flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: auto;
      }

      .hotzone-tab-item {
        position: relative;
        width: 24px;
        height: 22px;
        border: 1px solid rgba(176, 198, 244, 0.45);
        border-radius: 6px;
        background: rgba(12, 18, 35, 0.34);
        color: rgba(231, 239, 255, 0.92);
        font-size: 10px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }

      .hotzone-tab-item.active {
        border-color: rgba(124, 233, 190, 0.62);
        background: rgba(26, 111, 86, 0.45);
        color: #e3fff5;
      }

      .hotzone-tab-item.add {
        border-style: dashed;
        font-size: 14px;
      }

      .hotzone-tab-delete {
        position: absolute;
        right: -5px;
        top: -5px;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: none;
        background: #ef4f5f;
        color: #fff;
        font-size: 10px;
        line-height: 1;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
      }

      .hotzone-tab-item.delete-mode .hotzone-tab-delete {
        display: inline-flex;
      }

      #hotzone-text-actions {
        display: none;
        align-items: center;
        gap: 6px;
        pointer-events: auto;
        flex: 0 0 auto;
      }

      .hotzone-header-more {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.9);
        cursor: pointer;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        display: none;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hotzone-header-menu {
        position: absolute;
        top: 26px;
        left: 0;
        display: none;
        flex-direction: column;
        gap: 4px;
        min-width: 120px;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid rgba(176, 198, 244, 0.45);
        background: rgba(12, 18, 35, 0.94);
        z-index: 30;
        pointer-events: auto;
      }

      .hotzone-header-menu.show {
        display: inline-flex;
      }

      .hotzone-header-menu-item {
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.92);
        text-align: left;
        font-size: 12px;
        line-height: 1.2;
        padding: 4px 6px;
        border-radius: 6px;
        cursor: pointer;
      }

      .hotzone-header-menu-item:hover {
        background: rgba(70, 126, 255, 0.24);
      }

      .hz-share-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        flex: 0 0 auto;
      }

      .hz-share-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .hz-share-btn:hover {
        color: rgba(180, 220, 255, 0.98);
      }

      .hz-share-btn svg {
        display: block;
      }

      .hotzone-text-action {
        width: auto;
        height: auto;
        border: none;
        background: transparent;
        color: #f5f8ff;
        cursor: pointer;
        font-size: 16px;
        font-weight: 800;
        line-height: 1;
        padding: 0 2px;
      }

      .hotzone-text-action.save {
        border-color: rgba(141, 231, 152, 0.7);
        color: #baf2c2;
      }

      .hotzone-text-action.cancel {
        border-color: rgba(248, 147, 147, 0.7);
        color: #ffc7c7;
      }

      #hotzone-text-display {
        position: absolute;
        z-index: 8;
        overflow: hidden;
        pointer-events: auto;
        display: none;
      }

      #hotzone-text-scroll {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        overflow-x: hidden;
        line-height: 1.42;
        text-align: left;
        color: var(--hotzone-text-color, rgba(255, 255, 255, 0.95));
        font-weight: var(--hotzone-text-weight, 400);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        font-size: 12px;
        white-space: pre-wrap;
      }

      #hotzone-text-scroll a {
        color: #9fc2ff;
        text-decoration: underline;
        cursor: pointer;
      }

      #hotzone-text-scroll.compact {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      }

      #hotzone-text-scroll.readonly {
        display: block;
      }

      #hotzone-text-scroll::-webkit-scrollbar,
      #hotzone-text-editor::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      #hotzone-text-scroll::-webkit-scrollbar-track,
      #hotzone-text-editor::-webkit-scrollbar-track {
        background: transparent;
      }

      #hotzone-text-scroll::-webkit-scrollbar-thumb,
      #hotzone-text-editor::-webkit-scrollbar-thumb {
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
        background: var(--hotzone-scrollbar-color, rgba(70, 126, 255, 0.26));
      }

      #hotzone-text-scroll:hover::-webkit-scrollbar-thumb,
      #hotzone-text-editor:hover::-webkit-scrollbar-thumb {
        background: var(--hotzone-scrollbar-color, rgba(70, 126, 255, 0.42));
      }

      #hotzone-text-editor {
        position: absolute;
        z-index: 10;
        box-sizing: border-box;
        border-radius: 8px;
        border: none;
        background: var(--hotzone-editor-bg, rgba(11, 15, 24, 0.32));
        color: #f5f8ff;
        font-family: "Segoe UI", "PingFang SC", sans-serif;
        font-size: 12px;
        line-height: 1.4;
        resize: none;
        outline: none;
        overflow-y: auto;
        overflow-x: hidden;
        pointer-events: auto;
        display: none;
      }

      #hotzone[data-text-editing="true"] #hotzone-text-editor {
        display: block;
      }

      #hotzone[data-text-editing="true"] #hotzone-text-actions {
        display: inline-flex;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeText(input, options = {}) {
    const textLimitEnabled = options.textLimitEnabled !== false;
    if (typeof input !== "string") {
      return DEFAULT_TEXT;
    }
    const normalized = input.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return DEFAULT_TEXT;
    }
    return textLimitEnabled ? normalized.slice(0, LIMITED_TEXT_MAX_LENGTH) : normalized;
  }

  function normalizeCurrentText(state, input) {
    return normalizeText(input, { textLimitEnabled: state.textLimitEnabled });
  }

  function isSafeHttpUrl(value) {
    if (typeof value !== "string" || value.length === 0) {
      return false;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function trimTrailingPunctuation(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.length === 0) {
      return "";
    }
    return rawUrl.replace(/[),.;!?]+$/g, "");
  }

  function appendDisplayTextWithLinks(container, text) {
    container.innerHTML = "";
    const source = typeof text === "string" ? text : "";
    if (!source) {
      return;
    }

    let lastIndex = 0;
    source.replace(HTTP_URL_REGEX, (match, offset) => {
      const safeIndex = Number(offset);
      if (!Number.isFinite(safeIndex)) {
        return match;
      }
      if (safeIndex > lastIndex) {
        container.appendChild(document.createTextNode(source.slice(lastIndex, safeIndex)));
      }
      const trimmed = trimTrailingPunctuation(match);
      const suffix = match.slice(trimmed.length);
      if (isSafeHttpUrl(trimmed)) {
        const link = document.createElement("a");
        link.href = trimmed;
        link.textContent = trimmed;
        link.setAttribute("data-external-link", "true");
        link.setAttribute("rel", "noopener noreferrer");
        container.appendChild(link);
      } else {
        container.appendChild(document.createTextNode(match));
      }
      if (suffix) {
        container.appendChild(document.createTextNode(suffix));
      }
      lastIndex = safeIndex + match.length;
      return match;
    });

    if (lastIndex < source.length) {
      container.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
  }

  function normalizeTabId(input, fallback) {
    if (typeof input === "string" && input.trim().length > 0) {
      return input.trim();
    }
    return fallback;
  }

  function normalizeTextTabs(inputTabs, fallbackText, options = {}) {
    const source = Array.isArray(inputTabs) ? inputTabs : [];
    const normalized = source
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        return {
          id: normalizeTabId(item.id, `tab-${index + 1}`),
          text: normalizeText(item.text, options)
        };
      })
      .filter((item) => item !== null);
    if (normalized.length > 0) {
      return normalized.slice(0, TAB_MAX_COUNT);
    }
    return [{ id: "tab-1", text: normalizeText(fallbackText, options) }];
  }

  function normalizeTextSizeLevel(input) {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.min(TEXT_SIZE_LEVEL_COUNT - 1, Math.max(0, Math.round(parsed)));
  }

  function getTextSizeStyle(level) {
    const normalizedLevel = normalizeTextSizeLevel(level);
    const fontSize = TEXT_SIZE_MIN_PX + normalizedLevel * TEXT_SIZE_STEP_PX;
    const lineHeight = 1.4;
    return { fontSize, lineHeight };
  }

  function createHotzoneDisplayEditor(options) {
    ensureStyle();

    const { hotzoneEl, titlebarEl, displayEl, tabRailEl, minWidth, minHeight, overlayApi, onSave } = options;

    const header = document.createElement("div");
    header.id = "hotzone-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "hotzone-header-left";

    const actions = document.createElement("div");
    actions.id = "hotzone-text-actions";
    actions.setAttribute("data-no-drag", "true");

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "hotzone-pin-toggle";
    pinBtn.textContent = "📌";
    pinBtn.title = "取消置顶";
    pinBtn.setAttribute("data-no-drag", "true");

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "hotzone-collapse-toggle";
    collapseBtn.textContent = "▴";
    collapseBtn.title = "折叠热区";
    collapseBtn.setAttribute("data-no-drag", "true");

    const displayBtn = document.createElement("button");
    displayBtn.type = "button";
    displayBtn.className = "hotzone-display-toggle";
    displayBtn.textContent = "⇄";
    displayBtn.title = "切换显示器";
    displayBtn.setAttribute("data-no-drag", "true");

    const textSizeDownBtn = document.createElement("button");
    textSizeDownBtn.type = "button";
    textSizeDownBtn.className = "hotzone-text-size-toggle";
    textSizeDownBtn.textContent = "A-";
    textSizeDownBtn.title = "减小文本";
    textSizeDownBtn.setAttribute("data-no-drag", "true");

    const textSizeUpBtn = document.createElement("button");
    textSizeUpBtn.type = "button";
    textSizeUpBtn.className = "hotzone-text-size-toggle";
    textSizeUpBtn.textContent = "A+";
    textSizeUpBtn.title = "增大文本";
    textSizeUpBtn.setAttribute("data-no-drag", "true");

    const interactionModeBtn = document.createElement("button");
    interactionModeBtn.type = "button";
    interactionModeBtn.className = "hotzone-interaction-toggle";
    interactionModeBtn.textContent = "拖拽模式";
    interactionModeBtn.title = "切换到快速打开模式";
    interactionModeBtn.setAttribute("data-no-drag", "true");

    const shareWrap = document.createElement("div");
    shareWrap.className = "hz-share-wrap";
    shareWrap.setAttribute("data-no-drag", "true");

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "hz-share-btn";
    shareBtn.title = "导出为 Word（系统保存对话框，默认打开常用文件夹快捷方式目录）";
    shareBtn.setAttribute("data-no-drag", "true");
    shareBtn.innerHTML =
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.02.17-.04.33-.04.5 0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2z\"/></svg>";

    shareWrap.appendChild(shareBtn);

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "hotzone-header-more";
    moreBtn.textContent = "⋯";
    moreBtn.title = "更多";
    moreBtn.setAttribute("data-no-drag", "true");

    const moreMenu = document.createElement("div");
    moreMenu.className = "hotzone-header-menu";
    moreMenu.setAttribute("data-no-drag", "true");

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "hotzone-text-action save";
    saveBtn.textContent = "✓";
    saveBtn.setAttribute("data-no-drag", "true");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "hotzone-text-action cancel";
    cancelBtn.textContent = "✕";
    cancelBtn.setAttribute("data-no-drag", "true");

    const displayViewport = document.createElement("div");
    displayViewport.id = "hotzone-text-display";

    const tabList = document.createElement("div");
    tabList.id = "hotzone-tab-list";

    const displayScroll = document.createElement("div");
    displayScroll.id = "hotzone-text-scroll";

    const editor = document.createElement("textarea");
    editor.id = "hotzone-text-editor";
    editor.maxLength = LIMITED_TEXT_MAX_LENGTH;

    // Remove legacy debug node from static markup and re-use text content.
    const initialText = typeof displayEl.textContent === "string" ? displayEl.textContent : DEFAULT_TEXT;
    if (displayEl.parentNode) {
      displayEl.parentNode.removeChild(displayEl);
    }

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    headerLeft.appendChild(pinBtn);
    headerLeft.appendChild(collapseBtn);
    headerLeft.appendChild(displayBtn);
    headerLeft.appendChild(textSizeDownBtn);
    headerLeft.appendChild(textSizeUpBtn);
    headerLeft.appendChild(shareWrap);
    headerLeft.appendChild(interactionModeBtn);
    headerLeft.appendChild(moreBtn);
    headerLeft.appendChild(moreMenu);
    header.appendChild(headerLeft);
    header.appendChild(actions);

    displayViewport.appendChild(displayScroll);
    titlebarEl.appendChild(header);
    hotzoneEl.appendChild(displayViewport);
    hotzoneEl.appendChild(editor);
    if (tabRailEl) {
      tabRailEl.appendChild(tabList);
      tabRailEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      tabRailEl.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      tabRailEl.addEventListener("contextmenu", (event) => {
        event.stopPropagation();
      });
    }

    const state = {
      text: normalizeText(initialText),
      locked: true,
      enabled: true,
      widthPx: 200,
      heightPx: 300,
      color: "#467eff",
      textColor: "#f5f8ff",
      textBold: false,
      editing: false,
      saving: false,
      draft: normalizeText(initialText),
      pinned: true,
      collapsed: false,
      displayCount: 1,
      textSizeLevel: 0,
      interactionMode: "drag",
      textLimitEnabled: true,
      dragTextAppendWithNewline: true,
      textTabs: normalizeTextTabs([], initialText),
      activeTextTabId: "tab-1",
      deleteMode: false
    };
    const exportApi = overlayApi;
    let tabLongPressTimer = null;
    let maxLengthWarningShown = false;
    const headerTools = [
      { key: "pin", button: pinBtn, label: "置顶热区" },
      { key: "collapse", button: collapseBtn, label: "折叠热区" },
      { key: "display", button: displayBtn, label: "切换显示器" },
      { key: "text-down", button: textSizeDownBtn, label: "减小文本" },
      { key: "text-up", button: textSizeUpBtn, label: "增大文本" },
      { key: "share", button: shareBtn, label: "导出为 Word" },
      { key: "mode", button: interactionModeBtn, label: "切换模式" }
    ];
    let headerMenuOpen = false;

    function alertTextTruncated(reason = "save") {
      const hint =
        reason === "drop"
          ? "拖拽追加后文本超过上限（1000字），超出部分将被截断。"
          : "文本最多仅支持 1000 个字符，超出部分将被截断。";
      window.alert(hint);
    }

    function renderPinState() {
      pinBtn.dataset.pinned = state.pinned ? "true" : "false";
      pinBtn.title = state.pinned ? "取消置顶" : "置顶热区";
      collapseBtn.textContent = state.collapsed ? "▾" : "▴";
      collapseBtn.title = state.collapsed ? "展开热区" : "折叠热区";
      const displaySwitchEnabled = state.displayCount > 1;
      displayBtn.dataset.disabled = displaySwitchEnabled ? "false" : "true";
      displayBtn.title = displaySwitchEnabled ? "切换显示器" : "仅检测到一个显示器";
      const minLevel = 0;
      const maxLevel = TEXT_SIZE_LEVEL_COUNT - 1;
      const canDecrease = state.textSizeLevel > minLevel;
      const canIncrease = state.textSizeLevel < maxLevel;
      textSizeDownBtn.dataset.disabled = canDecrease ? "false" : "true";
      textSizeUpBtn.dataset.disabled = canIncrease ? "false" : "true";
      interactionModeBtn.dataset.mode = state.interactionMode;
      interactionModeBtn.textContent = state.interactionMode === "quick-open" ? "快开模式" : "拖拽模式";
      interactionModeBtn.title =
        state.interactionMode === "quick-open"
          ? "切换到拖拽模式（快捷键：Ctrl+Space）"
          : "切换到快速打开模式（快捷键：Ctrl+Space）";
    }

    function measureButtonWidth(button, fallback = 24) {
      const rect = button.getBoundingClientRect();
      return Math.max(fallback, Math.ceil(rect.width || fallback));
    }

    function closeHeaderMenu() {
      headerMenuOpen = false;
      moreMenu.classList.remove("show");
      moreBtn.dataset.open = "false";
    }

    function renderHeaderTools() {
      const headerWidth = Math.max(0, Math.floor(header.clientWidth || 0));
      if (headerWidth <= 0) {
        return;
      }
      const gap = 6;
      const paddingReserve = 6;
      const actionsReserve = state.editing ? Math.max(68, Math.ceil(actions.getBoundingClientRect().width || 0)) : 0;
      const available = Math.max(0, headerWidth - actionsReserve - paddingReserve);
      const moreWidth = measureButtonWidth(moreBtn, 24);
      let used = 0;
      const hiddenTools = [];

      const forceCompact = headerWidth <= HEADER_COMPACT_THRESHOLD_PX || available <= moreWidth + 8;
      if (forceCompact) {
        headerTools.forEach((item) => {
          item.button.style.display = "none";
        });
        moreMenu.innerHTML = "";
        headerTools.forEach((item) => {
          const menuItem = document.createElement("button");
          menuItem.type = "button";
          menuItem.className = "hotzone-header-menu-item";
          menuItem.textContent = item.label;
          menuItem.setAttribute("data-no-drag", "true");
          menuItem.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeHeaderMenu();
            item.button.click();
          });
          moreMenu.appendChild(menuItem);
        });
        moreBtn.style.display = "inline-flex";
        if (headerMenuOpen) {
          moreMenu.classList.add("show");
        } else {
          moreMenu.classList.remove("show");
        }
        return;
      }

      for (let i = 0; i < headerTools.length; i += 1) {
        const item = headerTools[i];
        const buttonWidth = measureButtonWidth(item.button, 24);
        const withGap = used > 0 ? gap : 0;
        const nextUsed = used + withGap + buttonWidth;
        const willNeedMore = i < headerTools.length - 1;
        const reserveForMore = willNeedMore ? (used > 0 ? gap : 0) + moreWidth : 0;
        if (nextUsed + reserveForMore <= available) {
          item.button.style.display = "";
          used = nextUsed;
          continue;
        }
        item.button.style.display = "none";
        hiddenTools.push(item);
      }

      moreMenu.innerHTML = "";
      if (hiddenTools.length === 0) {
        moreBtn.style.display = "none";
        closeHeaderMenu();
        return;
      }

      hiddenTools.forEach((item) => {
        const menuItem = document.createElement("button");
        menuItem.type = "button";
        menuItem.className = "hotzone-header-menu-item";
        menuItem.textContent = item.label;
        menuItem.setAttribute("data-no-drag", "true");
        menuItem.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeHeaderMenu();
          item.button.click();
        });
        moreMenu.appendChild(menuItem);
      });
      moreBtn.style.display = "inline-flex";
      if (headerMenuOpen) {
        moreMenu.classList.add("show");
      } else {
        moreMenu.classList.remove("show");
      }
    }

    function applyColorStyle() {
      const hex = state.color.replace("#", "");
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const rgba = `rgba(${r}, ${g}, ${b}, 0.32)`;
      displayScroll.style.setProperty("--hotzone-scrollbar-color", rgba);
      editor.style.setProperty("--hotzone-scrollbar-color", rgba);
      editor.style.setProperty("--hotzone-editor-bg", `rgba(${r}, ${g}, ${b}, 0.2)`);
      displayScroll.style.setProperty("--hotzone-text-color", state.textColor);
      displayScroll.style.setProperty("--hotzone-text-weight", state.textBold ? "700" : "400");
    }

    function applyTextSizeStyle() {
      const style = getTextSizeStyle(state.textSizeLevel);
      displayScroll.style.fontSize = `${style.fontSize}px`;
      displayScroll.style.lineHeight = String(style.lineHeight);
      editor.style.fontSize = `${style.fontSize}px`;
      editor.style.lineHeight = String(style.lineHeight);
    }

    function getActiveTab() {
      return state.textTabs.find((item) => item.id === state.activeTextTabId) ?? state.textTabs[0] ?? null;
    }

    function getExportPlainText() {
      const active = getActiveTab();
      if (!active) {
        return "";
      }
      if (state.editing) {
        return normalizeCurrentText(state, editor.value);
      }
      return normalizeCurrentText(state, active.text);
    }

    async function tryWriteDocx(fullPath, text) {
      if (!exportApi || typeof exportApi.exportTabDocx !== "function") {
        window.alert("导出功能不可用。");
        return;
      }
      let result = await exportApi.exportTabDocx({ fullPath, text, overwrite: false });
      if (result?.ok) {
        window.alert("已导出。");
        return;
      }
      if (result?.code === "EEXIST") {
        if (!window.confirm("该位置已存在同名文件，是否覆盖？")) {
          return;
        }
        result = await exportApi.exportTabDocx({ fullPath, text, overwrite: true });
        if (result?.ok) {
          window.alert("已导出。");
        } else {
          window.alert(result?.message || "导出失败。");
        }
        return;
      }
      window.alert(result?.message || "导出失败。");
    }

    async function handleExportOther() {
      closeHeaderMenu();
      if (!exportApi || typeof exportApi.exportTabDocxSaveDialog !== "function") {
        window.alert("导出功能不可用。");
        return;
      }
      const dlg = await exportApi.exportTabDocxSaveDialog();
      if (!dlg?.ok || dlg.cancelled || typeof dlg.filePath !== "string" || !dlg.filePath.trim()) {
        return;
      }
      const text = getExportPlainText();
      await tryWriteDocx(dlg.filePath.trim(), text);
    }

    function setActiveTab(tabId) {
      const target = state.textTabs.find((item) => item.id === tabId);
      if (!target) {
        return;
      }
      state.activeTextTabId = target.id;
      state.text = normalizeCurrentText(state, target.text);
      state.draft = state.text;
    }

    function buildTabLabel(index) {
      return String(index + 1);
    }

    function clearTabLongPressTimer() {
      if (tabLongPressTimer) {
        clearTimeout(tabLongPressTimer);
        tabLongPressTimer = null;
      }
    }

    async function handleUnsavedBeforeTabSwitch() {
      if (!state.editing) {
        return true;
      }
      const active = getActiveTab();
      const persisted = normalizeCurrentText(state, active?.text ?? state.text);
      const draft = normalizeCurrentText(state, editor.value);
      if (draft === persisted) {
        return true;
      }
      const shouldSave = window.confirm(
        "当前标签页文本尚未保存。\n选择“确定”先保存后切换，选择“取消”将直接切换且不保存。"
      );
      if (shouldSave) {
        await saveEditing();
        return true;
      }
      state.editing = false;
      await releaseEditorFocus();
      state.draft = persisted;
      return true;
    }

    async function persistTabs() {
      const active = getActiveTab();
      if (!active) {
        return;
      }
      const payload = {
        textTabs: state.textTabs,
        activeTextTabId: active.id,
        displayText: active.text
      };
      await onSave(payload);
    }

    async function addTab() {
      if (state.saving) {
        return;
      }
      if (state.textTabs.length >= TAB_MAX_COUNT) {
        window.alert(`最多仅支持 ${TAB_MAX_COUNT} 个标签页。`);
        return;
      }
      const nextId = `tab-${Date.now()}`;
      state.textTabs = [...state.textTabs, { id: nextId, text: DEFAULT_TEXT }];
      setActiveTab(nextId);
      await persistTabs();
      render();
    }

    async function deleteTab(tabId) {
      if (state.textTabs.length <= 1 || state.saving) {
        return;
      }
      const target = state.textTabs.find((item) => item.id === tabId);
      if (!target) {
        return;
      }
      const preview = normalizeCurrentText(state, target.text).slice(0, 20);
      const ok = window.confirm(`确认删除该标签页？\n${preview}${target.text.length > 20 ? "..." : ""}`);
      if (!ok) {
        return;
      }
      const index = state.textTabs.findIndex((item) => item.id === tabId);
      const nextTabs = state.textTabs.filter((item) => item.id !== tabId);
      const nextActive = nextTabs[Math.min(index, nextTabs.length - 1)];
      state.textTabs = nextTabs;
      setActiveTab(nextActive.id);
      await persistTabs();
      render();
    }

    function renderTabs() {
      if (!tabList) {
        return;
      }
      tabList.innerHTML = "";
      if (!state.enabled || state.collapsed) {
        return;
      }
      state.textTabs.forEach((tab, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "hotzone-tab-item";
        if (tab.id === state.activeTextTabId) {
          item.classList.add("active");
        }
        if (state.deleteMode) {
          item.classList.add("delete-mode");
        }
        const label = buildTabLabel(index);
        item.textContent = label;
        item.title = normalizeCurrentText(state, tab.text);
        item.setAttribute("data-no-drag", "true");

        const del = document.createElement("button");
        del.type = "button";
        del.className = "hotzone-tab-delete";
        del.textContent = "x";
        del.title = "删除";
        del.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void deleteTab(tab.id);
        });
        item.appendChild(del);

        item.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          clearTabLongPressTimer();
          tabLongPressTimer = setTimeout(() => {
            state.deleteMode = !state.deleteMode;
            renderTabs();
          }, TAB_LONG_PRESS_MS);
        });
        item.addEventListener("pointerup", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const wasLongPressed = state.deleteMode;
          clearTabLongPressTimer();
          if (wasLongPressed) {
            return;
          }
          if (state.activeTextTabId !== tab.id) {
            const canSwitch = await handleUnsavedBeforeTabSwitch();
            if (!canSwitch) {
              return;
            }
            setActiveTab(tab.id);
            await persistTabs();
            render();
          }
        });
        item.addEventListener("pointerleave", clearTabLongPressTimer);
        tabList.appendChild(item);
      });

      const addItem = document.createElement("button");
      addItem.type = "button";
      addItem.className = "hotzone-tab-item add";
      addItem.textContent = "+";
      addItem.title = "新增标签页";
      addItem.setAttribute("data-no-drag", "true");
      addItem.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      addItem.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void addTab();
      });
      tabList.appendChild(addItem);
    }

    function computeContentRect() {
      const hotzoneRect = hotzoneEl.getBoundingClientRect();
      const top = 8;
      const left = 8;
      const right = 8;
      const bottom = 8;
      const width = Math.max(40, Math.round(hotzoneRect.width - left - right));
      const height = Math.max(28, Math.round(hotzoneRect.height - top - bottom));

      return { top, left, width, height };
    }

    function applyContentRect(rect) {
      displayViewport.style.left = `${rect.left}px`;
      displayViewport.style.top = `${rect.top}px`;
      displayViewport.style.width = `${rect.width}px`;
      displayViewport.style.height = `${rect.height}px`;

      editor.style.left = `${rect.left}px`;
      editor.style.top = `${rect.top}px`;
      editor.style.width = `${rect.width}px`;
      editor.style.height = `${rect.height}px`;
      editor.style.padding = "8px";
      displayScroll.style.padding = "8px";
    }

    function renderDisplay(rect) {
      const normalized = normalizeCurrentText(state, state.text);
      appendDisplayTextWithLinks(displayScroll, normalized);
      displayScroll.classList.remove("readonly");
      displayScroll.classList.remove("compact");
      displayScroll.style.removeProperty("-webkit-line-clamp");

      requestAnimationFrame(() => {
        const isOverflowing = displayScroll.scrollHeight > displayScroll.clientHeight + 1;
        displayScroll.title = isOverflowing ? normalized : "";
      });

      displayViewport.style.display = state.enabled ? "block" : "none";
    }

    async function focusEditorAtEnd() {
      await overlayApi.setTextEditing(true);
      requestAnimationFrame(() => {
        editor.focus();
        const end = editor.value.length;
        editor.setSelectionRange(end, end);
      });
    }

    async function releaseEditorFocus() {
      await overlayApi.setTextEditing(false);
    }

    function updateLayout() {
      const rect = computeContentRect();
      applyContentRect(rect);
      applyColorStyle();
      applyTextSizeStyle();
      return rect;
    }

    function render() {
      const contentRect = updateLayout();
      if (!state.enabled) {
        hotzoneEl.dataset.textEditing = "false";
        displayViewport.style.display = "none";
        editor.style.display = "none";
        actions.style.display = "none";
        renderPinState();
        renderHeaderTools();
        renderTabs();
        return;
      }

      if (state.editing) {
        hotzoneEl.dataset.textEditing = "true";
        displayViewport.style.display = "none";
        editor.style.display = "block";
        actions.style.display = "inline-flex";
        renderPinState();
        renderHeaderTools();
        renderTabs();
        if (editor.value !== state.draft) {
          editor.value = state.draft;
        }
        focusEditorAtEnd();
        return;
      }

      hotzoneEl.dataset.textEditing = "false";
      editor.style.display = "none";
      actions.style.display = "none";
      renderPinState();
      renderHeaderTools();
      renderTabs();
      renderDisplay(contentRect);
    }

    function startEditing() {
      if (!state.enabled || !state.locked || state.saving || state.editing) {
        return;
      }

      state.editing = true;
      state.draft = normalizeCurrentText(state, state.text);
      maxLengthWarningShown = false;
      render();
    }

    async function stopEditing() {
      state.editing = false;
      await releaseEditorFocus();
      render();
    }

    async function cancelEditing() {
      state.draft = normalizeCurrentText(state, state.text);
      await stopEditing();
    }

    async function saveEditing() {
      if (state.saving) {
        return;
      }

      state.saving = true;
      const normalized = normalizeCurrentText(state, editor.value);
      const active = getActiveTab();
      if (active) {
        state.textTabs = state.textTabs.map((tab) => (tab.id === active.id ? { ...tab, text: normalized } : tab));
      }
      const result = await onSave({
        text: normalized,
        textTabs: state.textTabs,
        activeTextTabId: state.activeTextTabId
      });
      state.saving = false;

      if (result?.ok) {
        state.text = normalizeCurrentText(state, result.text ?? normalized);
        state.draft = state.text;
      }

      await stopEditing();
    }

    async function saveTextSizeLevel(nextLevel) {
      const normalizedLevel = normalizeTextSizeLevel(nextLevel);
      if (normalizedLevel === state.textSizeLevel || state.saving) {
        return;
      }

      state.saving = true;
      const result = await overlayApi.commitHotzone({ displayTextSizeLevel: normalizedLevel });
      state.saving = false;
      if (result?.ok && result.hotzone) {
        state.textSizeLevel = normalizeTextSizeLevel(result.hotzone.displayTextSizeLevel);
        render();
      }
    }

    hotzoneEl.addEventListener("dblclick", (event) => {
      if (actions.contains(event.target)) {
        return;
      }
      startEditing();
    });

    cancelBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelEditing();
    });

    cancelBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    saveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveEditing();
    });

    saveBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    pinBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextPinned = !state.pinned;
      const result = await overlayApi.setPinned(nextPinned);
      if (result?.ok) {
        state.pinned = result.pinned === true;
        renderPinState();
      }
    });

    pinBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    moreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      headerMenuOpen = !headerMenuOpen;
      if (headerMenuOpen) {
        moreMenu.classList.add("show");
        moreBtn.dataset.open = "true";
      } else {
        closeHeaderMenu();
      }
    });

    moreBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    shareBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      headerMenuOpen = false;
      moreMenu.classList.remove("show");
      moreBtn.dataset.open = "false";
      void handleExportOther();
    });
    shareBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    collapseBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextCollapsed = !state.collapsed;
      const result = await overlayApi.setCollapsed(nextCollapsed);
      if (result?.ok) {
        state.collapsed = result.collapsed === true;
        renderPinState();
      }
    });

    collapseBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    displayBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.displayCount <= 1) {
        return;
      }
      await overlayApi.cycleDisplay();
    });

    displayBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    textSizeDownBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (textSizeDownBtn.dataset.disabled === "true") {
        return;
      }
      saveTextSizeLevel(state.textSizeLevel - 1);
    });

    textSizeDownBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    textSizeUpBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (textSizeUpBtn.dataset.disabled === "true") {
        return;
      }
      saveTextSizeLevel(state.textSizeLevel + 1);
    });

    textSizeUpBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    interactionModeBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextMode = state.interactionMode === "quick-open" ? "drag" : "quick-open";
      const result = await overlayApi.setInteractionMode(nextMode);
      if (result?.ok) {
        state.interactionMode = result.mode === "quick-open" ? "quick-open" : "drag";
        renderPinState();
      }
    });

    interactionModeBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    editor.addEventListener("input", () => {
      state.draft = editor.value;
      if (state.textLimitEnabled !== false && editor.value.length >= LIMITED_TEXT_MAX_LENGTH && !maxLengthWarningShown) {
        maxLengthWarningShown = true;
        alertTextTruncated();
        return;
      }
      if (state.textLimitEnabled === false || editor.value.length < LIMITED_TEXT_MAX_LENGTH) {
        maxLengthWarningShown = false;
      }
    });

    editor.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") {
        return;
      }
      event.preventDefault();
      const start = editor.selectionStart ?? 0;
      const end = editor.selectionEnd ?? start;
      editor.setRangeText("\t", start, end, "end");
      state.draft = editor.value;
    });

    displayScroll.addEventListener("click", async (event) => {
      const rawTarget = event.target;
      if (!(rawTarget instanceof Element)) {
        return;
      }
      const anchor = rawTarget.closest("a[data-external-link]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const href = anchor.getAttribute("href") || "";
      if (!isSafeHttpUrl(href)) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      await overlayApi.openExternal(href);
    });

    window.addEventListener("resize", () => {
      render();
    });

    const headerResizeObserver = new ResizeObserver(() => {
      renderHeaderTools();
    });
    headerResizeObserver.observe(hotzoneEl);

    document.addEventListener("pointerdown", (event) => {
      if (!headerMenuOpen) {
        return;
      }
      if (headerLeft.contains(event.target)) {
        return;
      }
      closeHeaderMenu();
    });

    return {
      appendDroppedTextAndEdit(droppedText, options = {}) {
        if (!state.enabled || !state.locked || state.saving) {
          return { ok: false, reason: "disabled" };
        }
        const raw = typeof droppedText === "string" ? droppedText.replace(/\r\n/g, "\n") : "";
        if (!raw.trim()) {
          return { ok: false, reason: "empty" };
        }
        const base = state.editing ? state.draft : normalizeCurrentText(state, state.text);
        const forceLeadingNewline = options?.forceLeadingNewline === true;
        const shouldUseNewline = forceLeadingNewline || state.dragTextAppendWithNewline;
        const separator = shouldUseNewline && base && raw ? "\n" : "";
        const nextDraft = `${base}${separator}${raw}`;
        const shouldLimit = state.textLimitEnabled !== false;
        const willTruncate = shouldLimit && nextDraft.length > LIMITED_TEXT_MAX_LENGTH;
        if (willTruncate) {
          alertTextTruncated("drop");
        }
        state.draft = shouldLimit ? nextDraft.slice(0, LIMITED_TEXT_MAX_LENGTH) : nextDraft;
        state.editing = true;
        maxLengthWarningShown = shouldLimit && state.draft.length >= LIMITED_TEXT_MAX_LENGTH;
        render();
        return { ok: true, truncated: willTruncate };
      },
      update(next) {
        const nextTextLimitEnabled = next.textLimitEnabled !== false;
        const fallbackText = typeof next.text === "string" ? next.text : state.text;
        const incomingTabs = normalizeTextTabs(next.textTabs, fallbackText, { textLimitEnabled: nextTextLimitEnabled });
        state.textTabs = incomingTabs;
        const candidateActive =
          typeof next.activeTextTabId === "string" && next.activeTextTabId.trim().length > 0
            ? next.activeTextTabId.trim()
            : incomingTabs[0].id;
        state.activeTextTabId = incomingTabs.some((item) => item.id === candidateActive) ? candidateActive : incomingTabs[0].id;
        state.textLimitEnabled = nextTextLimitEnabled;
        const active = getActiveTab();
        state.text = normalizeCurrentText(state, active?.text ?? fallbackText);
        state.locked = next.locked === true;
        state.enabled = next.enabled === true;
        state.widthPx = Number.isFinite(next.widthPx) ? next.widthPx : state.widthPx;
        state.heightPx = Number.isFinite(next.heightPx) ? next.heightPx : state.heightPx;
        state.color = typeof next.color === "string" ? next.color : state.color;
        state.textColor =
          typeof next.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(next.textColor)
            ? next.textColor.toLowerCase()
            : state.textColor;
        state.textBold = typeof next.textBold === "boolean" ? next.textBold : state.textBold;
        state.textSizeLevel = normalizeTextSizeLevel(next.textSizeLevel ?? state.textSizeLevel);
        state.pinned = typeof next.pinned === "boolean" ? next.pinned : state.pinned;
        state.collapsed = typeof next.collapsed === "boolean" ? next.collapsed : state.collapsed;
        state.displayCount = Number.isFinite(next.displayCount) ? Math.max(1, Math.round(next.displayCount)) : state.displayCount;
        state.interactionMode = next.interactionMode === "quick-open" ? "quick-open" : "drag";
        state.dragTextAppendWithNewline = next.dragTextAppendWithNewline !== false;
        if (state.textLimitEnabled) {
          editor.maxLength = LIMITED_TEXT_MAX_LENGTH;
        } else {
          editor.removeAttribute("maxlength");
        }
        if (!state.enabled || state.collapsed) {
          state.deleteMode = false;
        }

        if (!state.locked && state.editing) {
          state.editing = false;
          releaseEditorFocus();
        }

        render();
      }
    };
  }

  window.createHotzoneDisplayEditor = createHotzoneDisplayEditor;
})();
