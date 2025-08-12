class InputTranslator {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.isSelectOpen = false;
      this.isTranslating = false;
      this.activeButtons = new Map();
      this._focusinHandler = this.handleFocusIn.bind(this);
      this._focusoutHandler = this.handleFocusOut.bind(this);
      this._inputHandler = this.handleInput.bind(this);
      this.setupObservers();
      this.setupEventListeners();
      this.initializeExistingEditors();
    }
    setupObservers() {
      const settings = this.settings;
      if (!settings.inputTranslation?.enabled) return;
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.handleNewNode(node);
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.handleRemovedNode(node);
            }
          });
        });
      });
      this.resizeObserver = new ResizeObserver(
        debounce((entries) => {
          entries.forEach((entry) => {
            const editor = this.findParentEditor(entry.target);
            if (editor) {
              this.updateButtonPosition(editor);
            }
          });
        }, 100)
      );
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    getEditorSelectors() {
      return [
        ".fr-element.fr-view",
        ".message-editable",
        ".js-editor",
        ".xenForm textarea",
        '[contenteditable="true"]',
        '[role="textbox"]',
        "textarea",
        'input[type="text"]'
      ].join(",");
    }
    isValidEditor(element) {
      const settings = this.settings;
      if (!settings.inputTranslation?.enabled && !settings.shortcuts?.enabled) return;
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }
      return element.matches(this.getEditorSelectors());
    }
    findParentEditor(element) {
      while (element && element !== document.body) {
        if (this.isValidEditor(element)) {
          return element;
        }
        if (element.tagName === "IFRAME") {
          try {
            const iframeDoc = element.contentDocument;
            if (iframeDoc && this.isValidEditor(iframeDoc.body)) {
              return iframeDoc.body;
            }
          } catch (e) {
          }
        }
        element = element.parentElement;
      }
      return null;
    }
    setupEventListeners() {
      const settings = this.settings;
      if (!settings.inputTranslation?.enabled) return;
      document.addEventListener("focusin", this._focusinHandler);
      document.addEventListener("focusout", this._focusoutHandler);
      document.addEventListener("input", this._inputHandler);
    }
    handleFocusIn(e) {
      const editor = this.findParentEditor(e.target);
      if (editor) {
        this.addTranslateButton(editor);
        this.updateButtonVisibility(editor);
      }
    }
    handleFocusOut(e) {
      const editor = this.findParentEditor(e.target);
      if (editor) {
        setTimeout(() => {
          if (this.isSelectOpen) {
            return;
          }
          const activeElement = document.activeElement;
          const container = this.activeButtons.get(editor);
          const isContainerFocused = container && (
            container === activeElement ||
            container.contains(activeElement)
          );
          const isEditorFocused = editor === activeElement ||
            editor.contains(activeElement);
          if (!isContainerFocused && !isEditorFocused) {
            this.removeTranslateButton(editor);
          }
        }, 100);
      }
    }
    handleInput(e) {
      const editor = this.findParentEditor(e.target);
      if (editor) {
        if (!this.activeButtons.has(editor)) {
          this.addTranslateButton(editor);
        }
        this.updateButtonVisibility(editor);
      }
    }
    updateButtonVisibility(editor) {
      const container = this.activeButtons.get(editor);
      if (container) {
        const hasContent = this.getEditorContent(editor);
        container.style.display = hasContent ? "" : "none";
      }
    }
    getEditorContent(editor) {
      const settings = this.settings;
      if (!settings.inputTranslation?.enabled && !settings.shortcuts?.enabled) return;
      let content = "";
      if (editor.value !== undefined) {
        content = editor.value;
      } else if (editor.textContent !== undefined) {
        content = editor.textContent;
      } else if (editor.innerText !== undefined) {
        content = editor.innerText;
      }
      return content.trim();
    }
    setEditorContent(editor, content) {
      if (editor.matches(".fr-element.fr-view")) {
        editor.innerHTML = content;
      } else if (editor.value !== undefined) {
        editor.value = content;
      } else {
        editor.innerHTML = content;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
    createButton(icon, title) {
      const button = document.createElement("button");
      button.className = "input-translate-button";
      button.innerHTML = icon;
      button.title = title;
      const theme = this.getCurrentTheme();
      button.style.cssText = `
background-color: ${theme.backgroundColor};
color: ${theme.text};
border: none;
border-radius: 8px;
padding: 4px;
font-size: 16px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
min-width: 28px;
height: 28px;
transition: all 0.15s ease;
margin: 0;
outline: none;
`;
      button.onmouseover = () => {
        button.style.background = theme.hoverBg;
        button.style.color = theme.hoverText;
      };
      button.onmouseout = () => {
        button.style.background = "transparent";
        button.style.color = theme.text;
      };
      return button;
    }
    createButtonContainer() {
      const container = document.createElement("div");
      container.className = "input-translate-button-container";
      const theme = this.getCurrentTheme();
      container.style.cssText = `
position: absolute;
display: flex;
flex-direction: column;
gap: 5px;
z-index: 2147483647;
pointer-events: auto;
background-color: rgba(0,74,153,0.5);
border-radius: 8px;
padding: 5px;
box-shadow: 0 2px 5px rgba(0,0,0,0.3);
border: 1px solid ${theme.border};
`;
      return container;
    }
    addTranslateButton(editor) {
      if (this.activeButtons.has(editor)) {
        this.updateButtonVisibility(editor);
        return;
      }
      const container = this.createButtonContainer();
      const settings = this.settings.displayOptions;
      let isDragging = false;
      let currentX;
      let currentY;
      let initialX;
      let initialY;
      let xOffset = 0;
      let yOffset = 0;
      const dragHandle = document.createElement('div');
      dragHandle.className = 'translate-drag-handle';
      dragHandle.textContent = '⋮King1x32⋮';
      Object.assign(dragHandle.style, {
        padding: '2px 5px',
        cursor: 'grab',
        color: '#999',
        fontSize: '12px',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        marginRight: '5px'
      });
      container.insertBefore(dragHandle, container.firstChild);
      const getPositionFromEvent = (e) => {
        if (e.type.startsWith('touch')) {
          return {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
          };
        }
        return {
          x: e.clientX,
          y: e.clientY
        };
      };
      const setTranslate = (xPos, yPos, el) => {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
      };
      const dragStart = (e) => {
        const position = getPositionFromEvent(e);
        if (!position) return;
        initialX = position.x - xOffset;
        initialY = position.y - yOffset;
        if (e.target === dragHandle) {
          isDragging = true;
          container.style.cursor = 'grabbing';
        }
        if (e.type === 'touchstart') {
          e.preventDefault();
        }
      };
      const drag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const position = getPositionFromEvent(e);
        if (!position) return;
        currentX = position.x - initialX;
        currentY = position.y - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(xOffset, yOffset, container);
        if (e.type === 'touchmove') {
          e.preventDefault();
        }
      };
      const dragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';
        if (this.settings.inputTranslation.savePosition) {
          const position = {
            x: xOffset,
            y: yOffset
          };
          safeLocalStorageSet('translatorButtonPosition', JSON.stringify(position));
        }
      };
      if (this.settings.inputTranslation.savePosition) {
        const savedPosition = safeLocalStorageGet('translatorButtonPosition');
        if (savedPosition) {
          try {
            const position = JSON.parse(savedPosition);
            xOffset = position.x;
            yOffset = position.y;
            setTranslate(xOffset, yOffset, container);
          } catch (e) {
            console.error('Error restoring position:', e);
          }
        }
      }
      const resetButton = document.createElement('button');
      resetButton.textContent = '↺';
      resetButton.title = 'Reset position';
      Object.assign(resetButton.style, {
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        width: '20px',
        height: '20px',
        padding: '0',
        border: 'none',
        borderRadius: '50%',
        backgroundColor: '#ff4444',
        color: 'white',
        cursor: 'pointer',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        zIndex: '2147483647'
      });
      resetButton.onclick = () => {
        xOffset = 0;
        yOffset = 0;
        setTranslate(0, 0, container);
        safeLocalStorageRemove('translatorButtonPosition');
      };
      container.appendChild(resetButton);
      container.addEventListener('mouseenter', () => {
        if (xOffset !== 0 || yOffset !== 0) {
          resetButton.style.display = 'flex';
        }
      });
      container.addEventListener('mouseleave', () => {
        resetButton.style.display = 'none';
      });
      dragHandle.addEventListener('mousedown', dragStart, false);
      dragHandle.addEventListener('touchstart', dragStart, false);
      document.addEventListener('mousemove', drag, false);
      document.addEventListener('mouseup', dragEnd, false);
      document.addEventListener('touchmove', drag, false);
      document.addEventListener('touchend', dragEnd, false);
      container.cleanup = () => {
        dragHandle.removeEventListener('mousedown', dragStart);
        dragHandle.removeEventListener('touchstart', dragStart);
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', dragEnd);
      };
      const sourceRow = document.createElement("div");
      sourceRow.style.cssText = `
display: flex;
align-items: center;
gap: 5px;
`;
      const sourceButton = this.createButton("🌐", this._("notifications.source_trans"));
      const sourceSelect = document.createElement("select");
      const theme = this.getCurrentTheme();
      sourceSelect.style.cssText = `
background-color: ${theme.backgroundColor};
color: ${theme.text};
transition: all 0.15s ease;
padding: 4px;
border-radius: 6px;
border: none;
margin-left: 5px;
font-size: 14px;
max-height: 32px;
width: auto;
min-width: 75px;
max-width: 100px;
`;
      const languages = {
        auto: "Auto-detect",
        ...CONFIG.LANGUAGES
      };
      for (const [code, name] of Object.entries(languages)) {
        const option = document.createElement("option");
        option.value = code;
        option.text = name;
        option.selected = code === settings.sourceLanguage;
        sourceSelect.appendChild(option);
      }
      sourceSelect.addEventListener('mousedown', () => {
        this.isSelectOpen = true;
      });
      sourceSelect.addEventListener('blur', () => {
        setTimeout(() => {
          this.isSelectOpen = false;
        }, 200);
      });
      sourceSelect.addEventListener('change', () => {
        setTimeout(() => {
          editor.focus();
          this.isSelectOpen = false;
        }, 200);
      });
      sourceButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sourceLang = sourceSelect.value;
        await this.translateEditor(editor, true, sourceLang);
      };
      sourceRow.appendChild(sourceButton);
      sourceRow.appendChild(sourceSelect);
      const targetRow = document.createElement("div");
      targetRow.style.cssText = `
display: flex;
align-items: center;
gap: 5px;
margin-top: 5px;
`;
      const targetButton = this.createButton("🔄", this._("notifications.target_trans"));
      const targetSelect = document.createElement("select");
      targetSelect.style.cssText = sourceSelect.style.cssText;
      for (const [code, name] of Object.entries(languages)) {
        if (code !== 'auto') {
          const option = document.createElement("option");
          option.value = code;
          option.text = name;
          option.selected = code === settings.targetLanguage;
          targetSelect.appendChild(option);
        }
      }
      targetSelect.addEventListener('mousedown', () => {
        this.isSelectOpen = true;
      });
      targetSelect.addEventListener('blur', () => {
        setTimeout(() => {
          this.isSelectOpen = false;
        }, 200);
      });
      targetSelect.addEventListener('change', () => {
        setTimeout(() => {
          editor.focus();
          this.isSelectOpen = false;
        }, 200);
      });
      targetButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetLang = targetSelect.value;
        await this.translateEditor(editor, false, targetLang);
      };
      targetRow.appendChild(targetButton);
      targetRow.appendChild(targetSelect);
      container.appendChild(sourceRow);
      container.appendChild(targetRow);
      this.positionButtonContainer(container, editor);
      this.translator.uiRoot.getRoot().appendChild(container);
      this.activeButtons.set(editor, container);
      container.addEventListener("mousedown", (e) => {
        if (e.target.tagName !== 'SELECT') {
          e.preventDefault();
        }
      });
      this.updateButtonVisibility(editor);
      this.resizeObserver.observe(editor);
    }
    async translateEditor(editor, isSource, selectedLang) {
      if (this.isTranslating) return;
      this.isTranslating = true;
      const container = this.activeButtons.get(editor);
      const button = isSource ?
        container.querySelector('button:first-of-type') :
        container.querySelector('button:last-of-type');
      const originalIcon = button.innerHTML;
      try {
        const text = this.getEditorContent(editor);
        if (!text) return;
        button.textContent = "⌛";
        button.style.opacity = "0.7";
        const sourceLang = isSource && selectedLang === "auto" ?
          this.translator.page.languageCode : selectedLang;
        const result = await this.translator.translate(
          text,
          null,
          false,
          false,
          sourceLang
        );
        if (this.settings.displayOptions.translationMode === "translation_only") {
          this.setEditorContent(editor, result);
        } else {
          const translations = result.split("\n");
          let fullTranslation = "";
          for (const trans of translations) {
            const parts = trans.split("<|>");
            fullTranslation += (parts[2] || trans.replace("<|>", "")) + "\n";
          }
          this.setEditorContent(editor, fullTranslation);
        }
      } catch (error) {
        console.error("Translation error:", error);
        this.translator.ui.showNotification(this.translator.userSettings._("notifications.translation_error") + error.message, "error");
      } finally {
        this.isTranslating = false;
        if (button) {
          button.innerHTML = originalIcon;
          button.style.opacity = "1";
        }
      }
    }
    positionButtonContainer(container, editor) {
      const rect = editor.getBoundingClientRect();
      const toolbar = this.findEditorToolbar(editor);
      if (toolbar) {
        const toolbarRect = toolbar.getBoundingClientRect();
        container.style.top = `${toolbarRect.top + window.scrollY}px`;
        container.style.left = `${toolbarRect.right + 5}px`;
      } else {
        container.style.top = `${rect.top + window.scrollY}px`;
        container.style.left = `${rect.right + 5}px`;
      }
    }
    findEditorToolbar(editor) {
      return (
        editor.closest(".fr-box")?.querySelector(".fr-toolbar") ||
        editor.closest(".xenForm")?.querySelector(".buttonGroup")
      );
    }
    updateButtonPosition(editor) {
      const container = this.activeButtons.get(editor);
      if (container) {
        this.positionButtonContainer(container, editor);
      }
    }
    getCurrentTheme() {
      const themeMode = this.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === 'dark';
      return {
        backgroundColor: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
        text: isDark ? "#fff" : "#000",
        border: theme.border,
        hoverBg: isDark ? "#555" : "#eee",
        hoverText: isDark ? "#eee" : "#555"
      };
    }
    updateAllButtonStyles() {
      const theme = this.getCurrentTheme();
      this.activeButtons.forEach((container) => {
        container.style.background = theme.background;
        container.style.borderColor = theme.border;
        container
          .querySelectorAll(".input-translate-button")
          .forEach((button) => {
            button.style.color = theme.text;
          });
      });
    }
    handleNewNode(node) {
      if (this.isValidEditor(node)) {
        this.addTranslateButton(node);
      }
      node.querySelectorAll(this.getEditorSelectors()).forEach((editor) => {
        if (this.isValidEditor(editor)) {
          this.addTranslateButton(editor);
        }
      });
    }
    handleRemovedNode(node) {
      if (this.activeButtons.has(node)) {
        this.removeTranslateButton(node);
      }
      node.querySelectorAll(this.getEditorSelectors()).forEach((editor) => {
        if (this.activeButtons.has(editor)) {
          this.removeTranslateButton(editor);
        }
      });
    }
    handleEditorFocus(editor) {
      if (this.getEditorContent(editor)) {
        this.addTranslateButton(editor);
      }
    }
    handleEditorClick(editor) {
      if (this.getEditorContent(editor)) {
        this.addTranslateButton(editor);
      }
    }
    removeTranslateButton(editor) {
      const container = this.activeButtons.get(editor);
      if (container) {
        container.cleanup(),
          container.remove();
        this.activeButtons.delete(editor);
        this.resizeObserver.unobserve(editor);
      }
    }
    initializeExistingEditors() {
      const settings = this.settings;
      if (!settings.inputTranslation?.enabled) return;
      document.querySelectorAll(this.getEditorSelectors()).forEach((editor) => {
        if (this.isValidEditor(editor) && this.getEditorContent(editor)) {
          this.addTranslateButton(editor);
        }
      });
    }
    cleanup() {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      document.removeEventListener("focusin", this._focusinHandler);
      document.removeEventListener("focusout", this._focusoutHandler);
      document.removeEventListener("input", this._inputHandler);
      this.activeButtons.forEach((container, _editor) => {
        if (container.cleanup) container.cleanup();
        container.remove();
      });
      this.activeButtons.clear();
    }
  }
