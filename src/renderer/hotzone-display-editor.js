(function () {
  const STYLE_ID = "hotzone-display-editor-style";
  const DEFAULT_TEXT = "拖动文件到这里，或双击这里试试";

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
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: rgba(245, 248, 255, 0.88);
        cursor: pointer;
        padding: 0;
        font-size: 13px;
        line-height: 1;
        pointer-events: auto;
      }

      .hotzone-pin-toggle[data-pinned="false"] {
        opacity: 0.5;
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
        pointer-events: none;
        display: none;
      }

      #hotzone-text-scroll {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
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
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #hotzone-text-scroll::-webkit-scrollbar,
      #hotzone-text-editor::-webkit-scrollbar {
        width: 8px;
        height: 8px;
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
        background: var(--hotzone-scrollbar-color, rgba(70, 126, 255, 0.58));
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
      pinned: true
    };

    function renderPinState() {
      pinBtn.dataset.pinned = state.pinned ? "true" : "false";
      pinBtn.title = state.pinned ? "取消置顶" : "置顶热区";
    }

    function applyColorStyle() {
      const hex = state.color.replace("#", "");
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const rgba = `rgba(${r}, ${g}, ${b}, 0.58)`;
      displayScroll.style.setProperty("--hotzone-scrollbar-color", rgba);
      editor.style.setProperty("--hotzone-scrollbar-color", rgba);
      editor.style.setProperty("--hotzone-editor-bg", `rgba(${r}, ${g}, ${b}, 0.2)`);
      displayScroll.style.setProperty("--hotzone-text-color", state.textColor);
      displayScroll.style.setProperty("--hotzone-text-weight", state.textBold ? "700" : "400");
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
      const compact = state.widthPx <= minWidth || state.heightPx <= minHeight;
      displayScroll.classList.add("readonly");
      displayScroll.classList.toggle("compact", compact);
      if (compact) {
        displayScroll.style.removeProperty("-webkit-line-clamp");
      } else {
        const lineHeightPx = 17;
        const availableHeight = Math.max(17, Math.floor((rect?.height ?? 80) - 12));
        const lineClamp = Math.max(1, Math.floor(availableHeight / lineHeightPx));
        displayScroll.style.setProperty("-webkit-line-clamp", String(lineClamp));
      }

      requestAnimationFrame(() => {
        const isTruncated = compact
          ? displayScroll.scrollWidth > displayScroll.clientWidth + 1
          : displayScroll.scrollHeight > displayScroll.clientHeight + 1;
        displayScroll.title = isTruncated ? normalized : "";
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
        state.pinned = typeof next.pinned === "boolean" ? next.pinned : state.pinned;

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
