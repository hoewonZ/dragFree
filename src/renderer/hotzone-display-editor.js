(function () {
  const STYLE_ID = "hotzone-display-editor-style";
  const DEFAULT_TEXT = "拖动文件到这里，或双击这里试试";
  const TEXT_SIZE_MIN_PX = 12;
  const TEXT_SIZE_STEP_PX = 4;
  const TEXT_SIZE_LEVEL_COUNT = 10;

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
      }

      .hotzone-interaction-toggle[data-mode="quick-open"] {
        border-color: rgba(121, 234, 187, 0.55);
        background: rgba(33, 122, 98, 0.34);
        color: #d8fff0;
      }

      #mode-toggle {
        display: none !important;
      }

      #hotzone-text-actions {
        display: none;
        align-items: center;
        gap: 6px;
        pointer-events: auto;
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

  function normalizeText(input) {
    if (typeof input !== "string") {
      return DEFAULT_TEXT;
    }
    const normalized = input.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return DEFAULT_TEXT;
    }
    return normalized.slice(0, 500);
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

    const { hotzoneEl, titlebarEl, displayEl, minWidth, minHeight, overlayApi, onSave } = options;

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
    displayBtn.textContent = "🖥";
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

    const displayScroll = document.createElement("div");
    displayScroll.id = "hotzone-text-scroll";

    const editor = document.createElement("textarea");
    editor.id = "hotzone-text-editor";
    editor.maxLength = 500;

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
    headerLeft.appendChild(interactionModeBtn);
    header.appendChild(headerLeft);
    header.appendChild(actions);

    displayViewport.appendChild(displayScroll);
    titlebarEl.appendChild(header);
    hotzoneEl.appendChild(displayViewport);
    hotzoneEl.appendChild(editor);

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
      interactionMode: "drag"
    };

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
      const normalized = normalizeText(state.text);
      displayScroll.textContent = normalized;
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
        return;
      }

      renderPinState();

      if (state.editing) {
        hotzoneEl.dataset.textEditing = "true";
        displayViewport.style.display = "none";
        editor.style.display = "block";
        actions.style.display = "inline-flex";
        if (editor.value !== state.draft) {
          editor.value = state.draft;
        }
        focusEditorAtEnd();
        return;
      }

      hotzoneEl.dataset.textEditing = "false";
      editor.style.display = "none";
      actions.style.display = "none";
      renderDisplay(contentRect);
    }

    function startEditing() {
      if (!state.enabled || !state.locked || state.saving || state.editing) {
        return;
      }

      state.editing = true;
      state.draft = normalizeText(state.text);
      render();
    }

    async function stopEditing() {
      state.editing = false;
      await releaseEditorFocus();
      render();
    }

    async function cancelEditing() {
      state.draft = normalizeText(state.text);
      await stopEditing();
    }

    async function saveEditing() {
      if (state.saving) {
        return;
      }

      state.saving = true;
      const normalized = normalizeText(editor.value);
      const result = await onSave(normalized);
      state.saving = false;

      if (result?.ok) {
        state.text = normalizeText(result.text ?? normalized);
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
    });

    window.addEventListener("resize", () => {
      render();
    });

    return {
      update(next) {
        state.text = normalizeText(typeof next.text === "string" ? next.text : state.text);
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
