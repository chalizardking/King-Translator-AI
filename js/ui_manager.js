function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.getItem for key "${key}". Reason:`, e.message);
      return null;
    }
  }
  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.setItem for key "${key}". Reason:`, e.message);
    }
  }
  function safeLocalStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.removeItem for key "${key}". Reason:`, e.message);
    }
  }
  function createElementFromHTML(htmlString) {
    const cleanString = htmlString.trim();
    try {
      const template = document.createElement('template');
      template.innerHTML = cleanString;
      if (template.content.firstChild) {
        return template.content.firstChild;
      }
    } catch (e) {
    }
    try {
      const wrappedString = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${cleanString}</div></foreignObject></svg>`;
      const doc = new DOMParser().parseFromString(wrappedString, 'image/svg+xml');
      const foreignObject = doc.querySelector('foreignObject');
      if (foreignObject && foreignObject.firstChild && foreignObject.firstChild.firstChild) {
        return foreignObject.firstChild.firstChild;
      }
    } catch (e) {
      console.error("King Translator: DOMParser with SVG trick also failed.", e);
    }
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanString;
      return tempDiv.firstChild;
    } catch (e) {
      console.error("King Translator: All methods to create element from HTML failed.", e);
    }
    return null;
  }
class MobileOptimizer {
    constructor(ui) {
      this.ui = ui;
      this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (this.isMobile) {
        this.optimizeForMobile();
      }
    }
    optimizeForMobile() {
      this.reduceDOMOperations();
      this.optimizeTouchHandling();
      this.adjustUIForMobile();
    }
    reduceDOMOperations() {
      const observer = new MutationObserver((mutations) => {
        requestAnimationFrame(() => {
          mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
              this.optimizeAddedNodes(mutation.addedNodes);
            }
          });
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    optimizeTouchHandling() {
      let touchStartY = 0;
      let touchStartX = 0;
      document.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        },
        { passive: true }
      );
      document.addEventListener(
        "touchmove",
        (e) => {
          const touchY = e.touches[0].clientY;
          const touchX = e.touches[0].clientX;
          if (
            Math.abs(touchY - touchStartY) > 10 ||
            Math.abs(touchX - touchStartX) > 10
          ) {
            this.ui.removeTranslateButton();
          }
        },
        { passive: true }
      );
    }
    adjustUIForMobile() {
      const style = document.createElement("style");
      style.textContent = `
.translator-tools-container {
  bottom: 25px;
  right: 5px;
}
.translator-tools-button {
  padding: 8px 15px;
  font-size: 14px;
}
.translator-tools-dropdown {
  min-width: 208px;
  max-height: 90vh;
  overflow-y: auto;
}
.translator-tools-item {
  padding: 10px;
}
.draggable {
  max-width: 95vw;
  max-height: 80vh;
}
`;
      this.ui.shadowRoot.appendChild(style);
    }
    optimizeAddedNodes(nodes) {
      nodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const images = node.getElementsByTagName("img");
          Array.from(images).forEach((img) => {
            if (!img.loading) img.loading = "lazy";
          });
        }
      });
    }
  }
class UIRoot {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      const themeMode = this.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      let existingContainer = document.querySelector('#king-translator-root');
      if (existingContainer) {
        existingContainer.remove();
      }
      this.container = document.createElement('div');
      this.container.id = 'king-translator-root';
      this.container.style.cssText = `z-index: 2147483647;`;
      // this.usesShadowDOM = true;
      if (this.container.attachShadow) {
        try {
          this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
        } catch (e) {
          console.error("King Translator: Error attaching Shadow DOM:", e);
          console.warn("King Translator: Could not attach Shadow DOM, falling back to direct injection.");
          this.shadowRoot = this.container;
        }
      } else {
        console.warn("King Translator: attachShadow is not supported, falling back to direct injection.");
        this.shadowRoot = this.container;
      }
      const style = document.createElement('style');
      style.textContent = `
.translator-settings-container {
  z-index: 2147483647;
  position: fixed;
  background-color: ${theme.background};
  color: ${theme.text};
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  width: auto;
  min-width: 320px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  top: ${window.innerHeight / 2}px;
  left: ${window.innerWidth / 2}px;
  transform: translate(-50%, -50%);
  display: block;
  visibility: visible;
  opacity: 1;
  font-size: 14px;
  line-height: 1.4;
}
.translator-settings-container * {
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  box-sizing: border-box;
}
.translator-settings-container input[type="checkbox"],
.translator-settings-container input[type="radio"] {
  appearance: auto;
  -webkit-appearance: auto;
  -moz-appearance: auto;
  position: relative;
  width: 16px;
  height: 16px;
  margin: 3px 5px;
  padding: 0;
  accent-color: #0000aa;
  border: 1px solid ${theme.border};
  opacity: 1;
  visibility: visible;
  cursor: pointer;
}
.radio-group {
  display: flex;
  gap: 15px;
  align-items: center;
}
.radio-group label {
  align-items: center;
  justify-content: center;
  padding: 5px;
  gap: 5px;
}
.radio-group input[type="radio"] {
  margin: 0;
  position: relative;
  top: 0;
}
.translator-settings-container input[type="radio"] {
  border-radius: 50%;
}
.translator-settings-container input[type="checkbox"] {
  display: flex;
  position: relative;
  margin: 5px 50% 5px 50%;
  align-items: center;
  justify-content: center;
}
.settings-grid input[type="text"],
.settings-grid input[type="number"],
.settings-grid select {
  appearance: auto;
  -webkit-appearance: auto;
  -moz-appearance: auto;
  background-color: ${isDark ? "#202020" : "#eeeeee"};
  color: ${theme.text};
  border: 1px solid ${theme.border};
  border-radius: 8px;
  padding: 7px 10px;
  margin: 5px;
  font-size: 14px;
  line-height: normal;
  height: auto;
  width: auto;
  min-width: 100px;
  display: inline-block;
  visibility: visible;
  opacity: 1;
}
.settings-grid select {
  padding-right: 20px;
}
.settings-grid label {
  display: inline-flex;
  align-items: center;
  margin: 3px 10px;
  color: ${theme.text};
  cursor: pointer;
  user-select: none;
}
.settings-grid input:not([type="hidden"]),
.settings-grid select,
.settings-grid textarea {
  display: inline-block;
  opacity: 1;
  visibility: visible;
  position: static;
}
.settings-grid input:disabled,
.settings-grid select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.translator-settings-container input[type="checkbox"]:hover,
.translator-settings-container input[type="radio"]:hover {
  border-color: ${theme.mode === "dark" ? "#777" : "#444"};
}
.settings-grid input:focus,
.settings-grid select:focus {
  outline: 2px solid rgba(74, 144, 226, 0.5);
  outline-offset: 1px;
}
.settings-grid input::before,
.settings-grid input::after {
  content: none;
  display: none;
}
.translator-settings-container button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  line-height: 1;
}
.translator-settings-container .api-key-entry input[type="text"] {
  padding: 8px 10px;
  margin: 0px 3px 3px 15px;
  appearance: auto;
  -webkit-appearance: auto;
  -moz-appearance: auto;
  font-size: 14px;
  line-height: normal;
  width: auto;
  min-width: 100px;
  display: inline-block;
  visibility: visible;
  opacity: 1;
  border: 1px solid ${theme.border};
  border-radius: 10px;
  box-sizing: border-box;
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  text-align: left;
  vertical-align: middle;
  background-color: ${isDark ? "#202020" : "#eeeeee"};
  color: ${theme.text};
}
.translator-settings-container .api-key-entry input[type="text"]:focus {
  outline: 3px solid rgba(74, 144, 226, 0.5);
  outline-offset: 1px;
  box-shadow: none;
}
.translator-settings-container .api-key-entry {
  display: flex;
  gap: 10px;
  align-items: center;
}
.remove-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  line-height: 1;
}
.translator-settings-container::-webkit-scrollbar {
  width: 8px;
}
.translator-settings-container::-webkit-scrollbar-track {
  background-color: ${theme.mode === "dark" ? "#222" : "#eeeeee"};
  border-radius: 8px;
}
.translator-settings-container::-webkit-scrollbar-thumb {
  background-color: ${theme.mode === "dark" ? "#666" : "#888"};
  border-radius: 8px;
}
.translator-tools-container {
  position: fixed;
  bottom: 40px;
  right: 20px;
  color: ${theme.text};
  border-radius: 10px;
  z-index: 2147483647;
  display: block;
  visibility: visible;
  opacity: 1;
}
.translator-tools-container * {
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  box-sizing: border-box;
}
.translator-tools-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: none;
  border-radius: 9px;
  background-color: rgba(74,144,226,0.3);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  font-size: 15px;
  line-height: 1;
  visibility: visible;
  opacity: 1;
}
.translator-tools-dropdown {
  display: none;
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 10px;
  background-color: ${theme.background};
  color: ${theme.text};
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
  padding: 15px 12px 9px 12px;
  min-width: 225px;
  overflow-y: auto;
  z-index: 2147483647;
  visibility: visible;
  opacity: 1;
}
.translator-tools-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-bottom: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 10px;
  background-color: ${theme.backgroundShadow};
  color: ${theme.text};
  border: 1px solid ${theme.border};
  visibility: visible;
  opacity: 1;
}
.item-icon, .item-text {
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  visibility: visible;
  opacity: 1;
}
.item-icon {
  font-size: 18px;
}
.item-text {
  font-size: 14px;
}
.translator-tools-item:hover {
  background-color: ${theme.button.translate.background};
  color: ${theme.button.translate.text};
}
.translator-tools-item:active {
  transform: scale(0.98);
}
.translator-tools-button:hover {
  transform: translateY(-2px);
  background-color: #357abd;
}
.translator-tools-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.translator-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.3);
  z-index: 2147483647;
  cursor: crosshair;
}
.translator-guide {
  position: fixed;
  top: 20px;
  left: ${window.innerWidth / 2}px;
  transform: translateX(-50%);
  background-color: rgba(0,0,0,0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 2147483647;
}
.translator-cancel {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  transition: all 0.3s ease;
}
.translator-cancel:hover {
  background-color: #ff0000;
  transform: scale(1.1);
}
/* Animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.translator-tools-container {
  animation: fadeIn 0.3s ease;
}
.translator-tools-dropdown {
  animation: fadeIn 0.2s ease;
}
.translator-tools-container.hidden,
.translator-notification.hidden,
.center-translate-status.hidden {
  visibility: hidden;
}
.settings-label,
.settings-section-title,
.shortcut-prefix,
.item-text,
.translator-settings-container label {
  color: ${theme.text};
  margin: 2px 10px;
}
.translator-settings-container input[type="text"],
.translator-settings-container input[type="number"],
.translator-settings-container select {
  background-color: ${isDark ? "#202020" : "#eeeeee"};
  color: ${theme.text};
}
/* Đảm bảo input không ghi đè lên label */
.translator-settings-container input {
  color: inherit;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.processing-spinner {
  width: 30px;
  height: 30px;
  color: white;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto 10px auto;
}
.processing-message {
  margin-bottom: 10px;
  font-size: 14px;
}
.processing-progress {
  font-size: 12px;
  opacity: 0.8;
}
.translator-content p {
  margin: 5px 0;
}
.translator-content strong {
  font-weight: bold;
}
.translator-context-menu {
  position: fixed;
  color: ${theme.text};
  background-color: ${theme.background};
  border-radius: 8px;
  padding: 8px 8px 5px 8px;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 2147483647;
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  font-size: 14px;
  opacity: 0;
  transform: scale(0.95);
  transition: all 0.1s ease-out;
  animation: menuAppear 0.15s ease-out forwards;
}
@keyframes menuAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.translator-context-menu-item {
  padding: 5px;
  margin-bottom: 3px;
  cursor: pointer;
  color: ${theme.text};
  background-color: ${theme.backgroundShadow};
  border: 1px solid ${theme.border};
  border-radius: 7px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  z-index: 2147483647;
}
.translator-context-menu-item:hover {
  background-color: ${theme.button.translate.background};
  color: ${theme.button.translate.text};
}
.translator-context-menu-item:active {
  transform: scale(0.98);
}
.input-translate-button-container {
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
}
.input-translate-button {
  font-family: inherit;
}
.translator-notification {
  position: fixed;
  top: 20px;
  left: ${window.innerWidth / 2}px;
  transform: translateX(-50%);
  z-index: 2147483647;
  animation: fadeInOut 2s ease;
}
/* Styles cho loading/processing status */
.center-translate-status {
  position: fixed;
  top: ${window.innerHeight / 2}px;
  left: ${window.innerWidth / 2}px;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  z-index: 2147483647;
}
/* Styles cho translate button */
.translator-button {
  position: fixed;
  border: none;
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
  z-index: 2147483647;
  font-size: 14px;
}
/* Styles cho popup */
.draggable {
  position: fixed;
  background-color: ${theme.background};
  color: ${theme.text};
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 2147483647;
}
.tts-controls {
  visibility: hidden;
  opacity: 0;
  transition: all 0.2s ease;
}
.tts-button:hover .tts-controls,
.tts-controls:hover {
  visibility: visible;
  opacity: 1;
}
.tts-controls input[type="range"] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
  border-radius: 2px;
  outline: none;
}
.tts-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: ${theme.button.translate.background};
  border-radius: 50%;
  cursor: pointer;
}
/* Styles cho manga translation */
.manga-translation-container {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 2147483647;
}
/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  10% { opacity: 1; transform: translateX(-50%) translateY(0); }
  90% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
      this.shadowRoot.appendChild(style);
      document.body.appendChild(this.container);
    }
    getRoot() {
      return this.shadowRoot;
    }
    getContainer() {
      return this.container;
    }
    cleanup() {
      if (this.container && this.container.parentNode) {
        this.container.remove();
      }
      this.container = null;
      this.shadowRoot = null;
    }
  }
class UIManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required");
      }
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.translatingStatus = null;
      this.ignoreNextSelectionChange = false;
      this.touchCount = 0;
      this.currentTranslateButton = null;
      this.isProcessing = false;
      this.touchEndProcessed = false;
      this.currentOverlay = null;
      this.currentSelectionBox = null;
      this.currentStatusContainer = null;
      this.currentGuide = null;
      this.currentCancelBtn = null;
      this.currentStyle = null;
      this.voiceStorage = {};
      this.selectSource = null;
      this.selectVoice = null;
      this.isTTSSpeaking = false;
      this.currentTTSAudio = null;
      this.translationButtonEnabled = true;
      this.translationTapEnabled = true;
      this.mediaElement = null;
      this.googleTranslateActive = false;
      this.googleTranslateAttempts = 0;
      this.container = this.translator.uiRoot.getContainer();
      this.shadowRoot = this.translator.uiRoot.getRoot();
      if (this.settings.translatorTools?.enabled && safeLocalStorageGet("translatorToolsEnabled") === null) {
        safeLocalStorageSet("translatorToolsEnabled", "true");
      }
      this.mobileOptimizer = new MobileOptimizer(this);
      this.page = this.translator.page;
      this.ocr = new OCRManager(translator);
      this.media = new MediaManager(translator);
      this.handleSettingsShortcut = this.handleSettingsShortcut.bind(this);
      this.handleTranslationShortcuts =
        this.handleTranslationShortcuts.bind(this);
      this.handleTranslateButtonClick =
        this.handleTranslateButtonClick.bind(this);
      this.setupClickHandlers = this.setupClickHandlers.bind(this);
      this.setupSelectionHandlers = this.setupSelectionHandlers.bind(this);
      this.showTranslatingStatus = this.showTranslatingStatus.bind(this);
      this.removeTranslatingStatus = this.removeTranslatingStatus.bind(this);
      this.resetState = this.resetState.bind(this);
      this.settingsShortcutListener = this.handleSettingsShortcut;
      this.translationShortcutListener = this.handleTranslationShortcuts;
      this.handleGeminiFileOrUrlTranslation = this.handleGeminiFileOrUrlTranslation.bind(this);
      this.setupEventListeners();
      if (document.readyState === "complete") {
        if (
          this.settings.pageTranslation.autoTranslate
        ) {
          this.page.checkAndTranslate();
        }
        if (
          this.settings.pageTranslation
            .showInitialButton
        ) {
          this.setupQuickTranslateButton();
        }
      } else {
        window.addEventListener("load", () => {
          if (
            this.settings.pageTranslation.autoTranslate
          ) {
            this.page.checkAndTranslate();
          }
          if (
            this.settings.pageTranslation
              .showInitialButton
          ) {
            this.setupQuickTranslateButton();
          }
        });
      }
      setTimeout(() => {
        if (!this.$(".translator-tools-container")) {
          let isEnabled = false;
          if (safeLocalStorageGet("translatorToolsEnabled") === null) safeLocalStorageGet("translatorToolsEnabled") === "true";
          if (safeLocalStorageGet("translatorToolsEnabled") === "true") isEnabled = true;
          if (this.settings.translatorTools?.enabled && isEnabled) {
            this.setupTranslatorTools();
          }
        }
      }, 5000);
      this.debouncedCreateButton = debounce((selection, x, y) => {
        this.createTranslateButton(selection, x, y);
      }, 100);
    }
    $(selector) {
      return this.shadowRoot.querySelector(selector);
    }
    $$(selector) {
      return this.shadowRoot.querySelectorAll(selector);
    }
}
function createFileInput(accept, onFileSelected) {
    return new Promise((resolve) => {
      const translator = window.translator;
      const _ = translator.userSettings._;
      const themeMode = translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const div = document.createElement('div');
      div.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100vw;
height: 100vh;
background: rgba(0,0,0,0.5);
z-index: 2147483647;
display: flex;
justify-content: center;
align-items: center;
font-family: "GoMono Nerd Font", "Noto Sans", Arial;
`;
      const container = document.createElement('div');
      container.style.cssText = `
background: ${theme.background};
padding: 20px;
border-radius: 12px;
box-shadow: 0 4px 20px rgba(0,0,0,0.2);
display: flex;
flex-direction: column;
gap: 15px;
min-width: 300px;
border: 1px solid ${theme.border};
`;
      const title = document.createElement('div');
      title.style.cssText = `
color: ${theme.title};
font-size: 16px;
font-weight: bold;
text-align: center;
margin-bottom: 5px;
`;
      title.textContent = _("notifications.file_input_title");
      const inputContainer = document.createElement('div');
      inputContainer.style.cssText = `
display: flex;
flex-direction: column;
gap: 10px;
align-items: center;
`;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.cssText = `
padding: 8px;
border-radius: 8px;
border: 1px solid ${theme.border};
background: ${themeMode === 'dark' ? '#444' : '#fff'};
color: ${theme.text};
width: 100%;
cursor: pointer;
font-family: inherit;
font-size: 14px;
`;
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
display: flex;
gap: 10px;
justify-content: center;
margin-top: 10px;
`;
      const cancelButton = document.createElement('button');
      cancelButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.close.background};
color: ${theme.button.close.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
font-family: inherit;
`;
      cancelButton.textContent = _("settings.cancel");
      cancelButton.onmouseover = () => {
        cancelButton.style.transform = 'translateY(-2px)';
        cancelButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.transform = 'none';
        cancelButton.style.boxShadow = 'none';
      };
      const translateButton = document.createElement('button');
      translateButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.translate.background};
color: ${theme.button.translate.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
opacity: 0.5;
font-family: inherit;
`;
      translateButton.textContent = _("notifications.translate");
      translateButton.disabled = true;
      translateButton.onmouseover = () => {
        if (!translateButton.disabled) {
          translateButton.style.transform = 'translateY(-2px)';
          translateButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }
      };
      translateButton.onmouseout = () => {
        translateButton.style.transform = 'none';
        translateButton.style.boxShadow = 'none';
      };
      const cleanup = () => {
        div.remove();
        resolve();
      };
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          translateButton.disabled = false;
          translateButton.style.opacity = '1';
        } else {
          translateButton.disabled = true;
          translateButton.style.opacity = '0.5';
        }
      });
      cancelButton.addEventListener('click', cleanup);
      translateButton.addEventListener('click', async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            translateButton.disabled = true;
            translateButton.style.opacity = '0.5';
            translateButton.textContent = _("notifications.processing");
            await onFileSelected(file);
          } catch (error) {
            console.error('Error processing file:', error);
          }
          cleanup();
        }
      });
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(translateButton);
      inputContainer.appendChild(input);
      container.appendChild(title);
      container.appendChild(inputContainer);
      container.appendChild(buttonContainer);
      div.appendChild(container);
      translator.uiRoot.getRoot().appendChild(div);
      div.addEventListener('click', (e) => {
        if (e.target === div) cleanup();
      });
    });
  }
class UserSettings {
    constructor(translator) {
        this.translator = translator;
        this.settings = DEFAULT_SETTINGS;
        this.isSettingsUIOpen = false;
        this.currentLanguage = CONFIG.LANG_DATA[this.settings.uiLanguage];
    }

    async init() {
        this.settings = await this.loadSettings();
        this.currentLanguage = CONFIG.LANG_DATA[this.settings.uiLanguage];
        if (!this.currentLanguage) {
            const browserLang = navigator.language || navigator.userLanguage;
            const langData = browserLang.startsWith('vi') ? 'vi' : 'en';
            this.currentLanguage = CONFIG.LANG_DATA[langData];
            this.settings.uiLanguage = langData;
            await this.saveSettings(this.settings);
        }
    }

    async loadSettings() {
        return new Promise(resolve => {
            chrome.storage.local.get("translatorSettings", (result) => {
                const savedSettings = result.translatorSettings;
                const settings = savedSettings
                    ? this.mergeWithDefaults(JSON.parse(savedSettings))
                    : DEFAULT_SETTINGS;
                resolve(settings);
            });
        });
    }

    async saveSettings(settingsUI) {
        // ... (logic to gather settings from UI)

        const mergedSettings = this.mergeWithDefaults(newSettings);
        await new Promise(resolve => {
            chrome.storage.local.set({ translatorSettings: JSON.stringify(mergedSettings) }, resolve);
        });
        this.settings = mergedSettings;
        const event = new CustomEvent("settingsChanged", {
            detail: mergedSettings
        });
        document.dispatchEvent(event);
        return mergedSettings;
    }

    // ... (rest of the UserSettings class methods)
}
