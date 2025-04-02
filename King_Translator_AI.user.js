// ==UserScript==
// @name         King Translator AI
// @namespace    https://kingsmanvn.pages.dev
// @version      4.3
// @author       King1x32
// @icon         https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/kings.jpg
// @license      GPL3
// @description  Dịch văn bản (bôi đen văn bản, khi nhập văn bản), hình ảnh, audio, video bằng Google Gemini API. Hỗ trợ popup phân tích từ vựng, popup dịch và dịch nhanh.
// @match        *://*/*
// @match        file:///*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @inject-into  auto
// @connect      generativelanguage.googleapis.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
// @homepageURL  https://github.com/king1x32/UserScripts
// @downloadURL  https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/King_Translator_AI.user.js
// @updateURL    https://raw.githubusercontent.com/king1x32/UserScripts/refs/heads/main/King_Translator_AI.user.js
// ==/UserScript==
(function() {
  "use strict";
  const CONFIG = {
    API: {
      providers: {
        gemini: {
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
          models: {
            fast: [
              "gemini-2.0-flash-lite",
              "gemini-2.0-flash",
              "gemini-2.0-flash-exp",
            ],
            pro: ["gemini-2.0-pro-exp-02-05", "gemini-2.0-pro-exp"],
            vision: [
              "gemini-2.0-flash-thinking-exp-01-21",
              "gemini-2.0-flash-thinking-exp",
            ],
          },
          headers: { "Content-Type": "application/json" },
          body: (prompt) => ({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: { temperature: 0.7 },
          }),
          responseParser: (response) => {
            console.log("Parsing response:", response);
            if (typeof response === "string") {
              return response;
            }
            if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
              return response.candidates[0].content.parts[0].text;
            }
            throw new Error("Không thể đọc kết quả từ API");
          },
        },
        openai: {
          url: () => "https://api.groq.com/openai/v1/chat/completions",
          headers: (apiKey) => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          }),
          body: (prompt) => ({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
          }),
          responseParser: (response) => response.choices?.[0]?.message?.content,
        },
      },
      currentProvider: "gemini",
      apiKey: {
        gemini: [""],
        openai: [""],
      },
      currentKeyIndex: {
        gemini: 0,
        openai: 0,
      },
      maxRetries: 3,
      retryDelay: 1000,
    },
    OCR: {
      generation: {
        temperature: 0.2,
        topP: 0.7,
        topK: 20,
      },
      maxFileSize: 15 * 1024 * 1024, // 15MB
      supportedFormats: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
    },
    MEDIA: {
      generation: {
        temperature: 0.2,
        topP: 0.7,
        topK: 20,
      },
      audio: {
        maxSize: 100 * 1024 * 1024, // 100MB
        supportedFormats: [
          "audio/wav",
          "audio/mp3",
          "audio/ogg",
          "audio/m4a",
          "audio/aac",
          "audio/flac",
          "audio/wma",
          "audio/opus",
          "audio/amr",
          "audio/midi",
          "audio/mpa",
        ],
      },
      video: {
        maxSize: 200 * 1024 * 1024, // 200MB
        supportedFormats: [
          "video/mp4",
          "video/webm",
          "video/ogg",
          "video/x-msvideo",
          "video/quicktime",
          "video/x-ms-wmv",
          "video/x-flv",
          "video/3gpp",
          "video/3gpp2",
          "video/x-matroska",
        ],
      },
    },
    contextMenu: {
      enabled: true,
    },
    pageTranslation: {
      enabled: true, // Bật/tắt tính năng
      autoTranslate: false,
      showInitialButton: true, // Hiện nút dịch ban đầu
      buttonTimeout: 10000, // Thời gian hiển thị nút (10 giây)
      useCustomSelectors: false,
      customSelectors: [],
      defaultSelectors: [
        "script",
        "code",
        "style",
        "input",
        "button",
        "textarea",
        ".notranslate",
        ".translator-settings-container",
        ".translator-tools-container",
        ".translation-div",
        ".draggable",
        ".page-translate-button",
        ".translator-tools-dropdown",
        ".translator-notification",
        ".translator-content",
        ".translator-context-menu",
        ".translator-overlay",
        ".translator-guide",
        ".center-translate-status",
        ".no-translate",
        "[data-notranslate]",
        "[translate='no']",
        ".html5-player-chrome",
        ".html5-video-player",
      ],
      generation: {
        temperature: 0.2,
        topP: 0.9,
        topK: 40
      }
    },
    promptSettings: {
      enabled: true,
      customPrompts: {
        normal: "",
        advanced: "",
        chinese: "",
        ocr: "",
        media: "",
        page: "",
      },
      useCustom: false,
    },
    CACHE: {
      text: {
        maxSize: 100, // Tối đa 100 entries cho text
        expirationTime: 300000, // 5 phút
      },
      image: {
        maxSize: 25, // Tối đa 25 entries cho ảnh
        expirationTime: 1800000, // 30 phút
      },
      media: {
        maxSize: 25, // Số lượng media được cache tối đa
        expirationTime: 1800000, // 30 phút
      },
    },
    RATE_LIMIT: {
      maxRequests: 5,
      perMilliseconds: 10000,
    },
    THEME: {
      mode: "dark",
      light: {
        background: "#cccccc",
        backgroundShadow: "rgba(255, 255, 255, 0.05)",
        text: "#333333",
        border: "#bbb",
        title: "#202020",
        content: "#555",
        button: {
          close: { background: "#ff4444", text: "#ddd" },
          translate: { background: "#007BFF", text: "#ddd" },
        },
      },
      dark: {
        background: "#333333",
        backgroundShadow: "rgba(0, 0, 0, 0.05)",
        text: "#cccccc",
        border: "#555",
        title: "#eeeeee",
        content: "#bbb",
        button: {
          close: { background: "#aa2222", text: "#ddd" },
          translate: { background: "#004a99", text: "#ddd" },
        },
      },
    },
    STYLES: {
      translation: {
        marginTop: "10px",
        padding: "10px",
        backgroundColor: "#f0f0f0",
        borderLeft: "3px solid #4CAF50",
        borderRadius: "8px",
        color: "#333",
        position: "relative",
        fontFamily: "SF Pro Rounded, sans-serif",
        fontSize: "16px",
        zIndex: "2147483647",
      },
      popup: {
        position: "fixed",
        border: "1px solid",
        padding: "20px",
        zIndex: "2147483647",
        maxWidth: "90vw",
        minWidth: "300px",
        maxHeight: "80vh",
        boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
        borderRadius: "15px",
        fontFamily: "SF Pro Rounded, Arial, sans-serif",
        fontSize: "16px",
        top: `${window.innerHeight / 2}px`,
        left: `${window.innerWidth / 2}px`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      },
      button: {
        position: "fixed",
        border: "none",
        borderRadius: "8px",
        padding: "5px 10px",
        cursor: "pointer",
        zIndex: "2147483647",
        fontSize: "14px",
      },
      dragHandle: {
        padding: "10px",
        borderBottom: "1px solid",
        cursor: "move",
        userSelect: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "15px",
        zIndex: "2147483647",
      },
    },
  };
  const DEFAULT_SETTINGS = {
    theme: CONFIG.THEME.mode,
    apiProvider: CONFIG.API.currentProvider,
    apiKey: {
      gemini: [""],
      openai: [""],
    },
    currentKeyIndex: {
      gemini: 0,
      openai: 0,
    },
    geminiOptions: {
      modelType: "fast", // 'fast', 'pro', 'vision', 'custom'
      fastModel: "gemini-2.0-flash-lite",
      proModel: "gemini-2.0-pro-exp-02-05",
      visionModel: "gemini-2.0-flash-thinking-exp-01-21",
      customModel: "",
    },
    contextMenu: {
      enabled: true,
    },
    promptSettings: {
      enabled: true,
      customPrompts: {
        normal: "",
        advanced: "",
        chinese: "",
        ocr: "",
        media: "",
        page: "",
      },
      useCustom: false,
    },
    inputTranslation: {
      enabled: true,
      excludeSelectors: [], // Selectors để loại trừ
    },
    pageTranslation: {
      enabled: true,
      autoTranslate: true,
      showInitialButton: true, // Hiện nút dịch ban đầu
      buttonTimeout: 10000, // Thời gian hiển thị nút (10 giây)
      useCustomSelectors: false,
      customSelectors: [],
      defaultSelectors: [
        "script",
        "code",
        "style",
        "input",
        "button",
        "textarea",
        ".notranslate",
        ".translator-settings-container",
        ".translator-tools-container",
        ".translation-div",
        ".draggable",
        ".page-translate-button",
        ".translator-tools-dropdown",
        ".translator-notification",
        ".translator-content",
        ".translator-context-menu",
        ".translator-overlay",
        ".translator-guide",
        ".center-translate-status",
        ".no-translate",
        "[data-notranslate]",
        "[translate='no']",
        ".html5-player-chrome",
        ".html5-video-player",
      ],
      generation: {
        temperature: 0.2,
        topP: 0.9,
        topK: 40
      }
    },
    ocrOptions: {
      enabled: true,
      preferredProvider: CONFIG.API.currentProvider,
      displayType: "popup",
      maxFileSize: CONFIG.OCR.maxFileSize,
      temperature: CONFIG.OCR.generation.temperature,
      topP: CONFIG.OCR.generation.topP,
      topK: CONFIG.OCR.generation.topK,
    },
    mediaOptions: {
      enabled: true,
      temperature: CONFIG.MEDIA.generation.temperature,
      topP: CONFIG.MEDIA.generation.topP,
      topK: CONFIG.MEDIA.generation.topK,
      audio: {
        processingInterval: 2000, // 2 seconds
        bufferSize: 16384,
        format: {
          sampleRate: 44100,
          numChannels: 1,
          bitsPerSample: 16,
        },
      },
    },
    displayOptions: {
      fontSize: "16px",
      minPopupWidth: "300px",
      maxPopupWidth: "90vw",
      webImageTranslation: {
        fontSize: "9px", // Font size mặc định
        minFontSize: "8px",
        maxFontSize: "16px",
      },
      translationMode: "translation_only", // 'translation_only', 'parallel' hoặc 'language_learning'
      sourceLanguage: "auto", // 'auto' hoặc 'zh','en','vi',...
      targetLanguage: "vi", // 'vi', 'en', 'zh', 'ko', 'ja',...
      languageLearning: {
        showSource: true,
      },
    },
    shortcuts: {
      settingsEnabled: true,
      enabled: true,
      pageTranslate: { key: "f", altKey: true },
      inputTranslate: { key: "t", altKey: true },
      quickTranslate: { key: "q", altKey: true },
      popupTranslate: { key: "e", altKey: true },
      advancedTranslate: { key: "a", altKey: true },
    },
    clickOptions: {
      enabled: true,
      singleClick: { translateType: "popup" },
      doubleClick: { translateType: "quick" },
      hold: { translateType: "advanced" },
    },
    touchOptions: {
      enabled: true,
      sensitivity: 100,
      twoFingers: { translateType: "popup" },
      threeFingers: { translateType: "advanced" },
      fourFingers: { translateType: "quick" },
    },
    cacheOptions: {
      text: {
        enabled: true,
        maxSize: CONFIG.CACHE.text.maxSize,
        expirationTime: CONFIG.CACHE.text.expirationTime,
      },
      image: {
        enabled: true,
        maxSize: CONFIG.CACHE.image.maxSize,
        expirationTime: CONFIG.CACHE.image.expirationTime,
      },
      media: {
        enabled: true,
        maxSize: CONFIG.CACHE.media.maxSize,
        expirationTime: CONFIG.CACHE.media.expirationTime,
      },
    },
    rateLimit: {
      maxRequests: CONFIG.RATE_LIMIT.maxRequests,
      perMilliseconds: CONFIG.RATE_LIMIT.perMilliseconds,
    },
  };
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
        subtree: true,
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
        min-width: 195px;
        max-height: 60vh;
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
  // const bypassCSP = () => {
  //   const style = document.createElement("style");
  //   style.textContent = `
  //   .translator-tools-container {
  //     position: fixed;
  //     bottom: 40px;
  //     right: 25px;
  //     z-index: 2147483647;
  //     font-family: Arial, sans-serif;
  //     display: block;
  //     visibility: visible;
  //     opacity: 1;
  //   }
  // `;
  //   this.shadowRoot.appendChild(style);
  // };
  class UserSettings {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.loadSettings();
      this.isSettingsUIOpen = false;
    }
    createSettingsUI() {
      if (this.isSettingsUIOpen) {
        return;
      }
      this.isSettingsUIOpen = true;
      const container = document.createElement("div");
      const themeMode = this.settings.theme ? this.settings.theme : CONFIG.THEME.mode;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      const geminiModels = {
        fast: CONFIG.API.providers.gemini.models.fast || [],
        pro: CONFIG.API.providers.gemini.models.pro || [],
        vision: CONFIG.API.providers.gemini.models.vision || [],
      };
      const resetStyle = `
        * {
            all: revert;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        .settings-grid {
            display: grid;
            grid-template-columns: 47% 53%;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .settings-label {
            min-width: 100px;
            text-align: left;
            padding-right: 10px;
        }
        .settings-input {
            min-width: 100px;
            margin-left: 5px;
        }
        h2 {
            flex: 1;
            display: flex;
            font-family: Arial, sans-serif;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
            font-weight: bold;
            color: ${theme.title};
            grid-column: 1 / -1;
        }
        h3 {
            font-family: Arial, sans-serif;
            margin-bottom: 15px;
            font-weight: bold;
            color: ${theme.title};
            grid-column: 1 / -1;
        }
        h4 {
            color: ${theme.title};
        }
        input[type="radio"],
        input[type="checkbox"] {
            align-items: center;
            justify-content: center;
        }
        button {
            font-family: Arial, sans-serif;
            font-size: 14px;
            background-color: ${isDark ? "#444" : "#ddd"};
            color: ${isDark ? "#ddd" : "#000"};
            padding: 5px 15px;
            border-radius: 8px;
            cursor: pointer;
            border: none;
            margin: 5px;
        }
        #cancelSettings {
            background-color: ${isDark ? "#666" : "#ddd"};
            color: ${isDark ? "#ddd" : "#000"};
            padding: 5px 15px;
            border-radius: 8px;
            cursor: pointer;
            border: none;
            margin: 5px;
        }
        #cancelSettings:hover {
            background-color: ${isDark ? "#888" : "#aaa"};
        }
        #saveSettings {
            background-color: #007BFF;
            padding: 5px 15px;
            border-radius: 8px;
            cursor: pointer;
            border: none;
            margin: 5px;
        }
        #saveSettings:hover {
            background-color: #009ddd;
        }
        button {
          font-family: Arial, sans-serif;
          font-size: 14px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button:active {
          transform: translateY(0);
        }
        #exportSettings:hover {
          background-color: #218838;
        }
        #importSettings:hover {
          background-color: #138496;
        }
        #cancelSettings:hover {
          background-color: ${isDark ? "#777" : "#dae0e5"};
        }
        #saveSettings:hover {
          background-color: #0056b3;
        }
        @keyframes buttonPop {
          0% { transform: scale(1); }
          50% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        button:active {
          animation: buttonPop 0.2s ease;
        }
        .radio-group {
            display: flex;
            gap: 15px;
        }
        .radio-group label {
            flex: 1;
            display: flex;
            color: ${isDark ? "#ddd" : "#000"};
            align-items: center;
            justify-content: center;
            padding: 5px;
        }
        .radio-group input[type="radio"] {
            margin-right: 5px;
        }
        .shortcut-container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .shortcut-prefix {
            white-space: nowrap;
            color: ${isDark ? "#aaa" : "#555"};
            font-size: 14px;
            min-width: 45px;
        }
        .shortcut-input {
            flex: 1;
            min-width: 60px;
            max-width: 100px;
        }
        .prompt-textarea {
          width: 100%;
          min-height: 100px;
          margin: 5px 0;
          padding: 8px;
          background-color: ${isDark ? "#444" : "#fff"};
          color: ${isDark ? "#fff" : "#000"};
          border: 1px solid ${isDark ? "#666" : "#ccc"};
          border-radius: 8px;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
        }
    `;
      const styleElement = document.createElement("style");
      styleElement.textContent = resetStyle;
      container.appendChild(styleElement);
      container.innerHTML += `
<h2>Cài đặt King Translator AI</h2>
<div style="margin-bottom: 15px;">
  <h3>GIAO DIỆN</h3>
  <div class="radio-group">
    <label>
      <input type="radio" name="theme" value="light" ${!isDark ? "checked" : ""
        }>
      <span class="settings-label">Sáng</span>
    </label>
    <label>
      <input type="radio" name="theme" value="dark" ${isDark ? "checked" : ""}>
      <span class="settings-label">Tối</span>
    </label>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>API PROVIDER</h3>
  <div class="radio-group">
    <label>
      <input type="radio" name="apiProvider" value="gemini" ${this.settings.apiProvider === "gemini" ? "checked" : ""
        }>
      <span class="settings-label">Gemini</span>
    </label>
    <label>
      <input type="radio" name="apiProvider" value="openai" disabled>
      <span class="settings-label">OpenAI</span>
    </label>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>API KEYS</h3>
  <div id="geminiKeys" style="margin-bottom: 10px;">
    <h4 class="settings-label" style="margin-bottom: 5px;">Gemini API Keys</h4>
    <div class="api-keys-container">
      ${this.settings.apiKey.gemini
          .map(
            (key) => `
        <div class="api-key-entry" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" class="gemini-key" value="${key}" style="flex: 1; width: 100%; border-radius: 6px !important; margin-left: 5px;">
          <button class="remove-key" data-provider="gemini" data-index="${this.settings.apiKey.gemini.indexOf(
              key
            )}" style="background-color: #ff4444;">×</button>
        </div>
      `
          )
          .join("")}
    </div>
    <button id="addGeminiKey" class="settings-label" style="background-color: #28a745; margin-top: 5px;">+ Add Gemini Key</button>
  </div>
  <div id="openaiKeys" style="margin-bottom: 10px;">
    <h4 class="settings-label" style="margin-bottom: 5px;">OpenAI API Keys</h4>
    <div class="api-keys-container">
      ${this.settings.apiKey.openai
          .map(
            (key) => `
        <div class="api-key-entry" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" class="openai-key" value="${key}" style="flex: 1; width: 100%; border-radius: 6px !important; margin-left: 5px;">
          <button class="remove-key" data-provider="openai" data-index="${this.settings.apiKey.openai.indexOf(
              key
            )}" style="background-color: #ff4444;">×</button>
        </div>
      `
          )
          .join("")}
    </div>
    <button id="addOpenaiKey" class="settings-label" style="background-color: #28a745; margin-top: 5px;">+ Add OpenAI Key</button>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>MODEL GEMINI</h3>
  <div class="settings-grid">
    <span class="settings-label">Sử dụng loại model:</span>
    <select id="geminiModelType" class="settings-input">
      <option value="fast" ${this.settings.geminiOptions?.modelType === "fast" ? "selected" : ""
        }>Nhanh</option>
      <option value="pro" ${this.settings.geminiOptions?.modelType === "pro" ? "selected" : ""
        }>Pro</option>
      <option value="vision" ${this.settings.geminiOptions?.modelType === "vision" ? "selected" : ""
        }>Suy luận</option>
      <option value="custom" ${this.settings.geminiOptions?.modelType === "custom" ? "selected" : ""
        }>Tùy chỉnh</option>
    </select>
  </div>
  <div id="fastModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "fast"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Nhanh:</span>
    <select id="fastModel" class="settings-input">
      ${geminiModels.fast
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.fastModel === model ? "selected" : ""
              }>${model}</option>
      `
          )
          .join("")}
    </select>
  </div>
  <div id="proModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "pro"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Chuyên nghiệp:</span>
    <select id="proModel" class="settings-input">
      ${geminiModels.pro
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.proModel === model ? "selected" : ""
              }>${model}</option>
      `
          )
          .join("")}
    </select>
  </div>
  <div id="visionModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "vision"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model Suy luận:</span>
    <select id="visionModel" class="settings-input">
      ${geminiModels.vision
          .map(
            (model) => `
      <option value="${model}" ${this.settings.geminiOptions?.visionModel === model ? "selected" : ""
              }>${model}</option>
      `
          )
          .join("")}
    </select>
  </div>
  <div id="customModelContainer" class="settings-grid" ${this.settings.geminiOptions?.modelType !== "custom"
          ? 'style="display: none;"'
          : ""
        }>
    <span class="settings-label">Model tùy chỉnh:</span>
    <input type="text" id="customModel" class="settings-input" value="${this.settings.geminiOptions?.customModel || ""
        }"
      placeholder="Nhập tên model">
  </div>
</div>
<div style="margin-bottom: 15px;">
    <h3>DỊCH KHI VIẾT</h3>
    <div class="settings-grid">
        <span class="settings-label">Bật tính năng:</span>
        <input type="checkbox" id="inputTranslationEnabled"
            ${this.settings.inputTranslation?.enabled ? "checked" : ""}>
    </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>TOOLS DỊCH</h3>
  <div class="settings-grid">
    <span class="settings-label">Hiển thị Tools ⚙️</span>
    <input type="checkbox" id="showTranslatorTools"
      ${localStorage.getItem("translatorToolsEnabled") === "true"
          ? "checked"
          : ""
        }>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH TOÀN TRANG</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật tính năng dịch trang:</span>
    <input type="checkbox" id="pageTranslationEnabled" ${this.settings.pageTranslation?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Hiện nút dịch 10s đầu:</span>
    <input type="checkbox" id="showInitialButton" ${this.settings.pageTranslation?.showInitialButton ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Tự động dịch trang:</span>
    <input type="checkbox" id="autoTranslatePage" ${this.settings.pageTranslation?.autoTranslate ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Tùy chỉnh Selectors loại trừ:</span>
    <input type="checkbox" id="useCustomSelectors" ${this.settings.pageTranslation?.useCustomSelectors ? "checked" : ""
        }>
  </div>
  <div id="selectorsSettings" style="display: ${this.settings.pageTranslation?.useCustomSelectors ? "block" : "none"
        }">
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Selectors loại trừ:</span>
      <div style="flex: 1;">
        <textarea id="customSelectors"
          style="width: 100%; min-height: 100px; margin: 5px 0; padding: 8px;
          background-color: ${isDark ? "#444" : "#fff"};
          color: ${isDark ? "#fff" : "#000"};
          border: 1px solid ${isDark ? "#666" : "#ccc"};
          border-radius: 8px;
          font-family: monospace;
          font-size: 13px;"
        >${this.settings.pageTranslation?.customSelectors?.join("\n") || ""
        }</textarea>
        <div style="font-size: 12px; color: ${isDark ? "#999" : "#666"
        }; margin-top: 4px;">
          Hãy nhập mỗi selector một dòng!
        </div>
      </div>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Selectors mặc định:</span>
      <div style="flex: 1;">
        <textarea id="defaultSelectors" readonly
          style="width: 100%; min-height: 100px; margin: 5px 0; padding: 8px;
          background-color: ${isDark ? "#333" : "#f5f5f5"};
          color: ${isDark ? "#999" : "#666"};
          border: 1px solid ${isDark ? "#555" : "#ddd"};
          border-radius: 8px;
          font-family: monospace;
          font-size: 13px;"
        >${this.settings.pageTranslation?.defaultSelectors?.join("\n") || ""
        }</textarea>
        <div style="font-size: 12px; color: ${isDark ? "#999" : "#666"
        }; margin-top: 4px;">
          Đây là danh sách selectors mặc định sẽ được sử dụng khi tắt tùy chỉnh.
        </div>
      </div>
    </div>
    <div class="settings-grid">
      <span class="settings-label">Kết hợp với mặc định:</span>
      <input type="checkbox" id="combineWithDefault" ${this.settings.pageTranslation?.combineWithDefault ? "checked" : ""
        }>
      <div style="font-size: 12px; color: ${isDark ? "#999" : "#666"
        }; margin-top: 4px; grid-column: 2;">
        Nếu bật, selectors tùy chỉnh sẽ được thêm vào danh sách mặc định thay vì thay thế hoàn toàn.
      </div>
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Temperature:</span>
    <input type="number" id="pageTranslationTemperature" class="settings-input"
      value="${this.settings.pageTranslation.generation.temperature}"
      min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top P:</span>
    <input type="number" id="pageTranslationTopP" class="settings-input"
      value="${this.settings.pageTranslation.generation.topP}"
      min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top K:</span>
    <input type="number" id="pageTranslationTopK" class="settings-input"
      value="${this.settings.pageTranslation.generation.topK}"
      min="1" max="100" step="1">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>TÙY CHỈNH PROMPT</h3>
  <div class="settings-grid">
    <span class="settings-label">Sử dụng prompt tùy chỉnh:</span>
    <input type="checkbox" id="useCustomPrompt" ${this.settings.promptSettings?.useCustom ? "checked" : ""
        }>
  </div>
  <div id="promptSettings" style="display: ${this.settings.promptSettings?.useCustom ? "block" : "none"
        }">
    <!-- Normal prompts -->
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch thường (nhanh + popup):</span>
      <textarea id="normalPrompt" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch thường..."
      >${this.settings.promptSettings?.customPrompts?.normal || ""}</textarea>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch thường (nhanh + popup)(Chinese):</span>
      <textarea id="normalPrompt_chinese" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch thường với pinyin..."
      >${this.settings.promptSettings?.customPrompts?.normal_chinese || ""
        }</textarea>
    </div>
    <!-- Advanced prompts -->
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch nâng cao:</span>
      <textarea id="advancedPrompt" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch nâng cao..."
      >${this.settings.promptSettings?.customPrompts?.advanced || ""}</textarea>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch nâng cao (Chinese):</span>
      <textarea id="advancedPrompt_chinese" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch nâng cao với pinyin..."
      >${this.settings.promptSettings?.customPrompts?.advanced_chinese || ""
        }</textarea>
    </div>
    <!-- OCR prompts -->
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt OCR:</span>
      <textarea id="ocrPrompt" class="prompt-textarea"
        placeholder="Nhập prompt cho OCR..."
      >${this.settings.promptSettings?.customPrompts?.ocr || ""}</textarea>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt OCR (Chinese):</span>
      <textarea id="ocrPrompt_chinese" class="prompt-textarea"
        placeholder="Nhập prompt cho OCR với pinyin..."
      >${this.settings.promptSettings?.customPrompts?.ocr_chinese || ""
        }</textarea>
    </div>
    <!-- Media prompts -->
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt Media:</span>
      <textarea id="mediaPrompt" class="prompt-textarea"
        placeholder="Nhập prompt cho media..."
      >${this.settings.promptSettings?.customPrompts?.media || ""}</textarea>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt Media (Chinese):</span>
      <textarea id="mediaPrompt_chinese" class="prompt-textarea"
        placeholder="Nhập prompt cho media với pinyin..."
      >${this.settings.promptSettings?.customPrompts?.media_chinese || ""
        }</textarea>
    </div>
    <!-- Page prompts -->
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch trang:</span>
      <textarea id="pagePrompt" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch trang..."
      >${this.settings.promptSettings?.customPrompts?.page || ""}</textarea>
    </div>
    <div class="settings-grid" style="align-items: start !important;">
      <span class="settings-label">Prompt dịch trang (Chinese):</span>
      <textarea id="pagePrompt_chinese" class="prompt-textarea"
        placeholder="Nhập prompt cho dịch trang với pinyin..."
      >${this.settings.promptSettings?.customPrompts?.page_chinese || ""
        }</textarea>
    </div>
    <div style="margin-top: 10px; font-size: 12px; color: ${isDark ? "#999" : "#666"
        };">
      Các biến có thể sử dụng trong prompt:
      <ul style="margin-left: 20px;">
        <li>{text} - Văn bản cần dịch</li>
        <li>{targetLang} - Ngôn ngữ đích</li>
        <li>{sourceLang} - Ngôn ngữ nguồn (nếu có)</li>
      </ul>
    </div>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH VĂN BẢN TRONG ẢNH</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật OCR dịch:</span>
    <input type="checkbox" id="ocrEnabled" ${this.settings.ocrOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Temperature:</span>
    <input type="number" id="ocrTemperature" class="settings-input" value="${this.settings.ocrOptions.temperature
        }"
      min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top P:</span>
    <input type="number" id="ocrTopP" class="settings-input" value="${this.settings.ocrOptions.topP
        }" min="0" max="1"
      step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top K:</span>
    <input type="number" id="ocrTopK" class="settings-input" value="${this.settings.ocrOptions.topK
        }" min="1"
      max="100" step="1">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>DỊCH MEDIA</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật dịch Media:</span>
    <input type="checkbox" id="mediaEnabled" ${this.settings.mediaOptions.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Temperature:</span>
    <input type="number" id="mediaTemperature" class="settings-input"
      value="${this.settings.mediaOptions.temperature
        }" min="0" max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top P:</span>
    <input type="number" id="mediaTopP" class="settings-input" value="${this.settings.mediaOptions.topP
        }" min="0"
      max="1" step="0.1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Top K:</span>
    <input type="number" id="mediaTopK" class="settings-input" value="${this.settings.mediaOptions.topK
        }" min="1"
      max="100" step="1">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>HIỂN THỊ</h3>
  <div class="settings-grid">
    <span class="settings-label">Chế độ hiển thị:</span>
    <select id="displayMode" class="settings-input">
      <option value="translation_only" ${this.settings.displayOptions.translationMode === "translation_only"
          ? "selected"
          : ""
        }>Chỉ hiện bản dịch</option>
      <option value="parallel" ${this.settings.displayOptions.translationMode === "parallel"
          ? "selected"
          : ""
        }>Song song văn bản gốc và bản dịch</option>
      <option value="language_learning" ${this.settings.displayOptions.translationMode === "language_learning"
          ? "selected"
          : ""
        }>Chế độ học ngôn ngữ</option>
    </select>
  </div>
  <div id="languageLearningOptions" style="display: ${this.settings.displayOptions.translationMode === "language_learning"
          ? "block"
          : "none"
        }">
    <div id="sourceOption" class="settings-grid">
      <span class="settings-label">Hiện bản gốc:</span>
      <input type="checkbox" id="showSource" ${this.settings.displayOptions.languageLearning.showSource
          ? "checked"
          : ""
        }>
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Ngôn ngữ nguồn:</span>
    <select id="sourceLanguage" class="settings-input">
      <option value="auto" ${this.settings.displayOptions.sourceLanguage === "auto" ? "selected" : ""
        }>Tự động nhận diện</option>
      <option value="en" ${this.settings.displayOptions.sourceLanguage === "en" ? "selected" : ""
        }>Tiếng Anh</option>
      <option value="zh" ${this.settings.displayOptions.sourceLanguage === "zh" ? "selected" : ""
        }>Tiếng Trung</option>
      <option value="ko" ${this.settings.displayOptions.sourceLanguage === "ko" ? "selected" : ""
        }>Tiếng Hàn</option>
      <option value="ja" ${this.settings.displayOptions.sourceLanguage === "ja" ? "selected" : ""
        }>Tiếng Nhật</option>
      <option value="fr" ${this.settings.displayOptions.sourceLanguage === "fr" ? "selected" : ""
        }>Tiếng Pháp</option>
      <option value="de" ${this.settings.displayOptions.sourceLanguage === "de" ? "selected" : ""
        }>Tiếng Đức</option>
      <option value="es" ${this.settings.displayOptions.sourceLanguage === "es" ? "selected" : ""
        }>Tiếng Tây Ban Nha</option>
      <option value="it" ${this.settings.displayOptions.sourceLanguage === "it" ? "selected" : ""
        }>Tiếng Ý</option>
      <option value="pt" ${this.settings.displayOptions.sourceLanguage === "pt" ? "selected" : ""
        }>Tiếng Bồ Đào Nha</option>
      <option value="ru" ${this.settings.displayOptions.sourceLanguage === "ru" ? "selected" : ""
        }>Tiếng Nga</option>
      <option value="ar" ${this.settings.displayOptions.sourceLanguage === "ar" ? "selected" : ""
        }>Tiếng Ả Rập</option>
      <option value="hi" ${this.settings.displayOptions.sourceLanguage === "hi" ? "selected" : ""
        }>Tiếng Hindi</option>
      <option value="bn" ${this.settings.displayOptions.sourceLanguage === "bn" ? "selected" : ""
        }>Tiếng Bengal</option>
      <option value="id" ${this.settings.displayOptions.sourceLanguage === "id" ? "selected" : ""
        }>Tiếng Indonesia</option>
      <option value="ms" ${this.settings.displayOptions.sourceLanguage === "ms" ? "selected" : ""
        }>Tiếng Malaysia</option>
      <option value="th" ${this.settings.displayOptions.sourceLanguage === "th" ? "selected" : ""
        }>Tiếng Thái</option>
      <option value="tr" ${this.settings.displayOptions.sourceLanguage === "tr" ? "selected" : ""
        }>Tiếng Thổ Nhĩ Kỳ</option>
      <option value="nl" ${this.settings.displayOptions.sourceLanguage === "nl" ? "selected" : ""
        }>Tiếng Hà Lan</option>
      <option value="pl" ${this.settings.displayOptions.sourceLanguage === "pl" ? "selected" : ""
        }>Tiếng Ba Lan</option>
      <option value="uk" ${this.settings.displayOptions.sourceLanguage === "uk" ? "selected" : ""
        }>Tiếng Ukraine</option>
      <option value="el" ${this.settings.displayOptions.sourceLanguage === "el" ? "selected" : ""
        }>Tiếng Hy Lạp</option>
      <option value="cs" ${this.settings.displayOptions.sourceLanguage === "cs" ? "selected" : ""
        }>Tiếng Séc</option>
      <option value="da" ${this.settings.displayOptions.sourceLanguage === "da" ? "selected" : ""
        }>Tiếng Đan Mạch</option>
      <option value="fi" ${this.settings.displayOptions.sourceLanguage === "fi" ? "selected" : ""
        }>Tiếng Phần Lan</option>
      <option value="he" ${this.settings.displayOptions.sourceLanguage === "he" ? "selected" : ""
        }>Tiếng Do Thái</option>
      <option value="hu" ${this.settings.displayOptions.sourceLanguage === "hu" ? "selected" : ""
        }>Tiếng Hungary</option>
      <option value="no" ${this.settings.displayOptions.sourceLanguage === "no" ? "selected" : ""
        }>Tiếng Na Uy</option>
      <option value="ro" ${this.settings.displayOptions.sourceLanguage === "ro" ? "selected" : ""
        }>Tiếng Romania</option>
      <option value="sv" ${this.settings.displayOptions.sourceLanguage === "sv" ? "selected" : ""
        }>Tiếng Thụy Điển</option>
      <option value="ur" ${this.settings.displayOptions.sourceLanguage === "ur" ? "selected" : ""
        }>Tiếng Urdu</option>
      <option value="vi" ${this.settings.displayOptions.sourceLanguage === "vi" ? "selected" : ""
        }>Tiếng Việt</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Ngôn ngữ đích:</span>
    <select id="targetLanguage" class="settings-input">
      <option value="vi" ${this.settings.displayOptions.targetLanguage === "vi" ? "selected" : ""
        }>Tiếng Việt</option>
      <option value="en" ${this.settings.displayOptions.targetLanguage === "en" ? "selected" : ""
        }>Tiếng Anh</option>
      <option value="zh" ${this.settings.displayOptions.targetLanguage === "zh" ? "selected" : ""
        }>Tiếng Trung</option>
      <option value="ko" ${this.settings.displayOptions.targetLanguage === "ko" ? "selected" : ""
        }>Tiếng Hàn</option>
      <option value="ja" ${this.settings.displayOptions.targetLanguage === "ja" ? "selected" : ""
        }>Tiếng Nhật</option>
      <option value="fr" ${this.settings.displayOptions.targetLanguage === "fr" ? "selected" : ""
        }>Tiếng Pháp</option>
      <option value="de" ${this.settings.displayOptions.targetLanguage === "de" ? "selected" : ""
        }>Tiếng Đức</option>
      <option value="es" ${this.settings.displayOptions.targetLanguage === "es" ? "selected" : ""
        }>Tiếng Tây Ban Nha</option>
      <option value="it" ${this.settings.displayOptions.targetLanguage === "it" ? "selected" : ""
        }>Tiếng Ý</option>
      <option value="pt" ${this.settings.displayOptions.targetLanguage === "pt" ? "selected" : ""
        }>Tiếng Bồ Đào Nha</option>
      <option value="ru" ${this.settings.displayOptions.targetLanguage === "ru" ? "selected" : ""
        }>Tiếng Nga</option>
      <option value="ar" ${this.settings.displayOptions.targetLanguage === "ar" ? "selected" : ""
        }>Tiếng Ả Rập</option>
      <option value="hi" ${this.settings.displayOptions.targetLanguage === "hi" ? "selected" : ""
        }>Tiếng Hindi</option>
      <option value="bn" ${this.settings.displayOptions.targetLanguage === "bn" ? "selected" : ""
        }>Tiếng Bengal</option>
      <option value="id" ${this.settings.displayOptions.targetLanguage === "id" ? "selected" : ""
        }>Tiếng Indonesia</option>
      <option value="ms" ${this.settings.displayOptions.targetLanguage === "ms" ? "selected" : ""
        }>Tiếng Malaysia</option>
      <option value="th" ${this.settings.displayOptions.targetLanguage === "th" ? "selected" : ""
        }>Tiếng Thái</option>
      <option value="tr" ${this.settings.displayOptions.targetLanguage === "tr" ? "selected" : ""
        }>Tiếng Thổ Nhĩ Kỳ</option>
      <option value="nl" ${this.settings.displayOptions.targetLanguage === "nl" ? "selected" : ""
        }>Tiếng Hà Lan</option>
      <option value="pl" ${this.settings.displayOptions.targetLanguage === "pl" ? "selected" : ""
        }>Tiếng Ba Lan</option>
      <option value="uk" ${this.settings.displayOptions.targetLanguage === "uk" ? "selected" : ""
        }>Tiếng Ukraine</option>
      <option value="el" ${this.settings.displayOptions.targetLanguage === "el" ? "selected" : ""
        }>Tiếng Hy Lạp</option>
      <option value="cs" ${this.settings.displayOptions.targetLanguage === "cs" ? "selected" : ""
        }>Tiếng Séc</option>
      <option value="da" ${this.settings.displayOptions.targetLanguage === "da" ? "selected" : ""
        }>Tiếng Đan Mạch</option>
      <option value="fi" ${this.settings.displayOptions.targetLanguage === "fi" ? "selected" : ""
        }>Tiếng Phần Lan</option>
      <option value="he" ${this.settings.displayOptions.targetLanguage === "he" ? "selected" : ""
        }>Tiếng Do Thái</option>
      <option value="hu" ${this.settings.displayOptions.targetLanguage === "hu" ? "selected" : ""
        }>Tiếng Hungary</option>
      <option value="no" ${this.settings.displayOptions.targetLanguage === "no" ? "selected" : ""
        }>Tiếng Na Uy</option>
      <option value="ro" ${this.settings.displayOptions.targetLanguage === "ro" ? "selected" : ""
        }>Tiếng Romania</option>
      <option value="sv" ${this.settings.displayOptions.targetLanguage === "sv" ? "selected" : ""
        }>Tiếng Thụy Điển</option>
      <option value="ur" ${this.settings.displayOptions.targetLanguage === "ur" ? "selected" : ""
        }>Tiếng Urdu</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Cỡ chữ dịch ảnh web:</span>
    <select id="webImageFontSize" class="settings-input">
      <option value="8px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "8px"
          ? "selected"
          : ""
        }>Rất nhỏ (8px)</option>
      <option value="9px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "9px"
          ? "selected"
          : ""
        }>Nhỏ (9px)</option>
      <option value="10px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "10px"
          ? "selected"
          : ""
        }>Vừa (10px)</option>
      <option value="12px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "12px"
          ? "selected"
          : ""
        }>Lớn (12px)</option>
      <option value="14px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "14px"
          ? "selected"
          : ""
        }>Rất lớn (14px)</option>
      <option value="16px" ${this.settings.displayOptions?.webImageTranslation?.fontSize === "16px"
          ? "selected"
          : ""
        }>Siêu lớn (16px)</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Cỡ chữ dịch popup:</span>
    <select id="fontSize" class="settings-input">
      <option value="12px" ${this.settings.displayOptions?.fontSize === "12px" ? "selected" : ""
        }>Nhỏ (12px)</option>
      <option value="14px" ${this.settings.displayOptions?.fontSize === "14px" ? "selected" : ""
        }>Hơi nhỏ (14px)
      </option>
      <option value="16px" ${this.settings.displayOptions?.fontSize === "16px" ? "selected" : ""
        }>Vừa (16px)</option>
      <option value="18px" ${this.settings.displayOptions?.fontSize === "18px" ? "selected" : ""
        }>Hơi lớn (18px)
      </option>
      <option value="20px" ${this.settings.displayOptions?.fontSize === "20px" ? "selected" : ""
        }>Lớn (20px)</option>
      <option value="22px" ${this.settings.displayOptions?.fontSize === "22px" ? "selected" : ""
        }>Cực lớn (22px)
      </option>
      <option value="24px" ${this.settings.displayOptions?.fontSize === "24px" ? "selected" : ""
        }>Siêu lớn (24px)
      </option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ rộng tối thiểu (popup):</span>
    <select id="minPopupWidth" class="settings-input">
      <option value="100px" ${this.settings.displayOptions?.minPopupWidth === "100px"
          ? "selected"
          : ""
        }>Rất nhỏ
        (100px)</option>
      <option value="200px" ${this.settings.displayOptions?.minPopupWidth === "200px"
          ? "selected"
          : ""
        }>Hơi nhỏ
        (200px)</option>
      <option value="300px" ${this.settings.displayOptions?.minPopupWidth === "300px"
          ? "selected"
          : ""
        }>Nhỏ (300px)
      </option>
      <option value="400px" ${this.settings.displayOptions?.minPopupWidth === "400px"
          ? "selected"
          : ""
        }>Vừa (400px)
      </option>
      <option value="500px" ${this.settings.displayOptions?.minPopupWidth === "500px"
          ? "selected"
          : ""
        }>Hơi lớn
        (500px)</option>
      <option value="600px" ${this.settings.displayOptions?.minPopupWidth === "600px"
          ? "selected"
          : ""
        }>Lớn (600px)
      </option>
      <option value="700px" ${this.settings.displayOptions?.minPopupWidth === "700px"
          ? "selected"
          : ""
        }>Cực lớn
        (700px)</option>
      <option value="800px" ${this.settings.displayOptions?.minPopupWidth === "800px"
          ? "selected"
          : ""
        }>Siêu lớn
        (800px)</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ rộng tối đa (popup):</span>
    <select id="maxPopupWidth" class="settings-input">
      <option value="30vw" ${this.settings.displayOptions?.maxPopupWidth === "30vw" ? "selected" : ""
        }>30% màn hình
      </option>
      <option value="40vw" ${this.settings.displayOptions?.maxPopupWidth === "40vw" ? "selected" : ""
        }>40% màn hình
      </option>
      <option value="50vw" ${this.settings.displayOptions?.maxPopupWidth === "50vw" ? "selected" : ""
        }>50% màn hình
      </option>
      <option value="60vw" ${this.settings.displayOptions?.maxPopupWidth === "60vw" ? "selected" : ""
        }>60% màn hình
      </option>
      <option value="70vw" ${this.settings.displayOptions?.maxPopupWidth === "70vw" ? "selected" : ""
        }>70% màn hình
      </option>
      <option value="80vw" ${this.settings.displayOptions?.maxPopupWidth === "80vw" ? "selected" : ""
        }>80% màn hình
      </option>
      <option value="90vw" ${this.settings.displayOptions?.maxPopupWidth === "90vw" ? "selected" : ""
        }>90% màn hình
      </option>
    </select>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CONTEXT MENU</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật Context Menu:</span>
    <input type="checkbox" id="contextMenuEnabled" ${this.settings.contextMenu?.enabled ? "checked" : ""
        }>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>PHÍM TẮT</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật phím tắt mở cài đặt:</span>
    <input type="checkbox" id="settingsShortcutEnabled" ${this.settings.shortcuts?.settingsEnabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Bật phím tắt dịch:</span>
    <input type="checkbox" id="shortcutsEnabled" ${this.settings.shortcuts?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch trang:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Cmd/Alt &nbsp+</span>
      <input type="text" id="pageTranslateKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.pageTranslate.key}">
    </div>
  </div>
  <div class="settings-grid">
      <span class="settings-label">Dịch text trong hộp nhập:</span>
      <div class="shortcut-container">
          <span class="shortcut-prefix">Cmd/Alt &nbsp+</span>
          <input type="text" id="inputTranslationKey" class="shortcut-input settings-input"
              value="${this.settings.shortcuts.inputTranslate.key}">
      </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch nhanh:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Cmd/Alt &nbsp+</span>
      <input type="text" id="quickKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.quickTranslate.key}">
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch popup:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Cmd/Alt &nbsp+</span>
      <input type="text" id="popupKey" class="shortcut-input settings-input"
        value="${this.settings.shortcuts.popupTranslate.key}">
    </div>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Dịch nâng cao:</span>
    <div class="shortcut-container">
      <span class="shortcut-prefix">Cmd/Alt &nbsp+</span>
      <input type="text" id="advancedKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.advancedTranslate.key
        }">
    </div>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>NÚT DỊCH</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật nút dịch:</span>
    <input type="checkbox" id="translationButtonEnabled" ${this.settings.clickOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Nhấp đơn:</span>
    <select id="singleClickSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.singleClick.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch
        nhanh</option>
      <option value="popup" ${this.settings.clickOptions.singleClick.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch
        popup</option>
      <option value="advanced" ${this.settings.clickOptions.singleClick.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Nhấp đúp:</span>
    <select id="doubleClickSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.doubleClick.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch
        nhanh</option>
      <option value="popup" ${this.settings.clickOptions.doubleClick.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch
        popup</option>
      <option value="advanced" ${this.settings.clickOptions.doubleClick.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Giữ nút:</span>
    <select id="holdSelect" class="settings-input">
      <option value="quick" ${this.settings.clickOptions.hold.translateType === "quick"
          ? "selected"
          : ""
        }>Dịch nhanh
      </option>
      <option value="popup" ${this.settings.clickOptions.hold.translateType === "popup"
          ? "selected"
          : ""
        }>Dịch popup
      </option>
      <option value="advanced" ${this.settings.clickOptions.hold.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch
        nâng cao</option>
    </select>
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CẢM ỨNG ĐA ĐIỂM</h3>
  <div class="settings-grid">
    <span class="settings-label">Bật cảm ứng:</span>
    <input type="checkbox" id="touchEnabled" ${this.settings.touchOptions?.enabled ? "checked" : ""
        }>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Hai ngón tay:</span>
    <select id="twoFingersSelect" class="settings-input">
      <option value="quick" ${this.settings.touchOptions?.twoFingers?.translateType === "quick"
          ? "selected"
          : ""
        }>
        Dịch nhanh</option>
      <option value="popup" ${this.settings.touchOptions?.twoFingers?.translateType === "popup"
          ? "selected"
          : ""
        }>
        Dịch popup</option>
      <option value="advanced" ${this.settings.touchOptions?.twoFingers?.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Ba ngón tay:</span>
    <select id="threeFingersSelect" class="settings-input">
      <option value="quick" ${this.settings.touchOptions?.threeFingers?.translateType === "quick"
          ? "selected"
          : ""
        }>
        Dịch nhanh</option>
      <option value="popup" ${this.settings.touchOptions?.threeFingers?.translateType === "popup"
          ? "selected"
          : ""
        }>
        Dịch popup</option>
      <option value="advanced" ${this.settings.touchOptions?.threeFingers?.translateType === "advanced"
          ? "selected"
          : ""
        }>Dịch nâng cao</option>
    </select>
  </div>
  <div class="settings-grid">
    <span class="settings-label">Độ nhạy (ms):</span>
    <input type="number" id="touchSensitivity" class="settings-input"
      value="${this.settings.touchOptions?.sensitivity || 100
        }" min="50" max="350" step="50">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>RATE LIMIT</h3>
  <div class="settings-grid">
    <span class="settings-label">Số yêu cầu tối đa:</span>
    <input type="number" id="maxRequests" class="settings-input" value="${this.settings.rateLimit?.maxRequests || CONFIG.RATE_LIMIT.maxRequests
        }" min="1" max="50" step="1">
  </div>
  <div class="settings-grid">
    <span class="settings-label">Thời gian chờ (ms):</span>
    <input type="number" id="perMilliseconds" class="settings-input" value="${this.settings.rateLimit?.perMilliseconds ||
        CONFIG.RATE_LIMIT.perMilliseconds
        }" min="1000" step="1000">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <h3>CACHE</h3>
  <div style="margin-bottom: 10px;">
    <h4 style="color: ${isDark ? "#678" : "#333"
        }; margin-bottom: 8px;">Text Cache</h4>
    <div class="settings-grid">
      <span class="settings-label">Bật cache text:</span>
      <input type="checkbox" id="textCacheEnabled" ${this.settings.cacheOptions?.text?.enabled ? "checked" : ""
        }>
    </div>
    <div class="settings-grid">
      <span class="settings-label">Kích thước cache text:</span>
      <input type="number" id="textCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.text?.maxSize || CONFIG.CACHE.text.maxSize
        }" min="10" max="1000">
    </div>
    <div class="settings-grid">
      <span class="settings-label">Thời gian cache text (ms):</span>
      <input type="number" id="textCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.text?.expirationTime ||
        CONFIG.CACHE.text.expirationTime
        }" min="60000" step="60000">
    </div>
    <div style="margin-bottom: 10px;">
      <h4 style="color: ${isDark ? "#678" : "#333"
        }; margin-bottom: 8px;">Image Cache</h4>
      <div class="settings-grid">
        <span class="settings-label">Bật cache ảnh:</span>
        <input type="checkbox" id="imageCacheEnabled" ${this.settings.cacheOptions?.image?.enabled ? "checked" : ""
        }>
      </div>
      <div class="settings-grid">
        <span class="settings-label">Kích thước cache ảnh:</span>
        <input type="number" id="imageCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.image?.maxSize ||
        CONFIG.CACHE.image.maxSize
        }" min="10" max="100">
      </div>
      <div class="settings-grid">
        <span class="settings-label">Thời gian cache ảnh (ms):</span>
        <input type="number" id="imageCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.image?.expirationTime ||
        CONFIG.CACHE.image.expirationTime
        }" min="60000" step="60000">
      </div>
    </div>
    <div style="margin-bottom: 10px;">
      <h4 style="color: ${isDark ? "#678" : "#333"
        }; margin-bottom: 8px;">Media Cache</h4>
      <div class="settings-grid">
        <span class="settings-label">Bật cache media:</span>
        <input type="checkbox" id="mediaCacheEnabled" ${this.settings.cacheOptions.media?.enabled ? "checked" : ""
        }>
      </div>
      <div class="settings-grid">
        <span class="settings-label">Media cache entries:</span>
        <input type="number" id="mediaCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions.media?.maxSize ||
        CONFIG.CACHE.media.maxSize
        }" min="5" max="100">
      </div>
      <div class="settings-grid">
        <span class="settings-label">Thời gian expire (giây):</span>
        <input type="number" id="mediaCacheExpirationTime" class="settings-input" value="${this.settings.cacheOptions.media?.expirationTime / 1000 ||
        CONFIG.CACHE.media.expirationTime / 1000
        }" min="60000" step="60000">
      </div>
    </div>
  </div>
</div>
<div style="border-top: 1px solid ${isDark ? "#444" : "#ddd"
        }; margin-top: 20px; padding-top: 20px;">
  <h3>SAO LƯU CÀI ĐẶT</h3>
  <div style="display: flex; gap: 10px; margin-bottom: 15px;">
    <button id="exportSettings" style="flex: 1; background-color: #28a745 !important; min-width: 140px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Xuất cài đặt
    </button>
    <input type="file" id="importInput" accept=".json" style="display: none;">
    <button id="importSettings" style="flex: 1; background-color: #17a2b8 !important; min-width: 140px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Nhập cài đặt
    </button>
  </div>
</div>
<div style="border-top: 1px solid ${isDark ? "#444" : "#ddd"
        }; margin-top: 20px; padding-top: 20px;">
  <div style="display: flex; gap: 10px; justify-content: flex-end;">
    <button id="cancelSettings" style="min-width: 100px; height: 36px; background-color: ${isDark ? "#666" : "#e9ecef"
        } !important; color: ${isDark ? "#fff" : "#333"} !important;">
      Hủy
    </button>
    <button id="saveSettings" style="min-width: 100px; height: 36px; background-color: #007bff !important; color: white !important;">
      Lưu
    </button>
  </div>
</div>
      `;
      container.className = "translator-settings-container";
      const addGeminiKey = container.querySelector("#addGeminiKey");
      const addOpenaiKey = container.querySelector("#addOpenaiKey");
      const geminiContainer = container.querySelector(
        "#geminiKeys .api-keys-container"
      );
      const openaiContainer = container.querySelector(
        "#openaiKeys .api-keys-container"
      );
      addGeminiKey.addEventListener("click", () => {
        const newEntry = document.createElement("div");
        newEntry.className = "api-key-entry";
        newEntry.style.cssText =
          "display: flex; gap: 10px; margin-bottom: 5px;";
        const currentKeysCount = geminiContainer.children.length;
        newEntry.innerHTML = `
    <input type="text" class="gemini-key" value="" style="flex: 1; width: 100%; border-radius: 6px !important; margin-left: 5px;">
    <button class="remove-key" data-provider="gemini" data-index="${currentKeysCount}" style="background-color: #ff4444;">×</button>
  `;
        geminiContainer.appendChild(newEntry);
      });
      addOpenaiKey.addEventListener("click", () => {
        const newEntry = document.createElement("div");
        newEntry.className = "api-key-entry";
        newEntry.style.cssText =
          "display: flex; gap: 10px; margin-bottom: 5px;";
        const currentKeysCount = openaiContainer.children.length;
        newEntry.innerHTML = `
    <input type="text" class="openai-key" value="" style="flex: 1; width: 100%; border-radius: 6px !important; margin-left: 5px;">
    <button class="remove-key" data-provider="openai" data-index="${currentKeysCount}" style="background-color: #ff4444;">×</button>
  `;
        openaiContainer.appendChild(newEntry);
      });
      container.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-key")) {
          const provider = e.target.dataset.provider;
          e.target.parentElement.remove();
          const container = this.$(
            `#${provider}Keys .api-keys-container`
          );
          Array.from(container.querySelectorAll(".remove-key")).forEach(
            (btn, i) => {
              btn.dataset.index = i;
            }
          );
        }
      });
      const modelTypeSelect = container.querySelector("#geminiModelType");
      const fastContainer = container.querySelector("#fastModelContainer");
      const proContainer = container.querySelector("#proModelContainer");
      const visionContainer = container.querySelector("#visionModelContainer");
      const customContainer = container.querySelector("#customModelContainer");
      modelTypeSelect.addEventListener("change", (e) => {
        const selectedType = e.target.value;
        fastContainer.style.display = selectedType === "fast" ? "" : "none";
        proContainer.style.display = selectedType === "pro" ? "" : "none";
        visionContainer.style.display = selectedType === "vision" ? "" : "none";
        customContainer.style.display = selectedType === "custom" ? "" : "none";
      });
      const useCustomSelectors = container.querySelector("#useCustomSelectors");
      const selectorsSettings = container.querySelector("#selectorsSettings");
      useCustomSelectors.addEventListener("change", (e) => {
        selectorsSettings.style.display = e.target.checked ? "block" : "none";
      });
      const useCustomPrompt = container.querySelector("#useCustomPrompt");
      const promptSettings = container.querySelector("#promptSettings");
      useCustomPrompt.addEventListener("change", (e) => {
        promptSettings.style.display = e.target.checked ? "block" : "none";
      });
      const displayModeSelect = container.querySelector("#displayMode");
      displayModeSelect.addEventListener("change", (e) => {
        const languageLearningOptions = container.querySelector(
          "#languageLearningOptions"
        );
        languageLearningOptions.style.display =
          e.target.value === "language_learning" ? "block" : "none";
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", handleEscape);
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      };
      document.addEventListener("keydown", handleEscape);
      const exportBtn = container.querySelector("#exportSettings");
      const importBtn = container.querySelector("#importSettings");
      const importInput = container.querySelector("#importInput");
      exportBtn.addEventListener("click", () => {
        try {
          this.exportSettings();
          this.showNotification("Export settings thành công");
        } catch (error) {
          this.showNotification("Lỗi export settings", "error");
        }
      });
      importBtn.addEventListener("click", () => {
        importInput.click();
      });
      importInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await this.importSettings(file);
          this.showNotification("Import settings thành công");
          setTimeout(() => location.reload(), 1500);
        } catch (error) {
          this.showNotification(error.message, "error");
        }
      });
      const cancelButton = container.querySelector("#cancelSettings");
      cancelButton.addEventListener("click", () => {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
      const saveButton = container.querySelector("#saveSettings");
      saveButton.addEventListener("click", () => {
        this.saveSettings(container);
        container.remove();
        location.reload();
      });
      return container;
    }
    exportSettings() {
      const settings = this.settings;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `king1x32-translator-settings-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    async importSettings(file) {
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Không thể đọc file"));
          reader.readAsText(file);
        });
        const importedSettings = JSON.parse(content);
        if (!this.validateImportedSettings(importedSettings)) {
          throw new Error("File settings không hợp lệ");
        }
        const mergedSettings = this.mergeWithDefaults(importedSettings);
        GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
        return true;
      } catch (error) {
        console.error("Import error:", error);
        throw new Error(`Lỗi import: ${error.message}`);
      }
    }
    validateImportedSettings(settings) {
      const requiredFields = [
        "theme",
        "apiProvider",
        "apiKey",
        "geminiOptions",
        "ocrOptions",
        "mediaOptions",
        "displayOptions",
        "shortcuts",
        "clickOptions",
        "touchOptions",
        "cacheOptions",
        "rateLimit",
      ];
      return requiredFields.every((field) => settings.hasOwnProperty(field));
    }
    showNotification(message, type = "info") {
      const notification = document.createElement("div");
      notification.className = "translator-notification";
      const colors = {
        info: "#4a90e2",
        success: "#28a745",
        warning: "#ffc107",
        error: "#dc3545",
      };
      const backgroundColor = colors[type] || colors.info;
      const textColor = type === "warning" ? "#000" : "#fff";
      Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        left: `${window.innerWidth / 2}px`,
        transform: "translateX(-50%)",
        backgroundColor,
        color: textColor,
        padding: "10px 20px",
        borderRadius: "8px",
        zIndex: "2147483647",
        animation: "fadeInOut 2s ease",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      });
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    loadSettings() {
      const savedSettings = GM_getValue("translatorSettings");
      return savedSettings
        ? this.mergeWithDefaults(JSON.parse(savedSettings))
        : DEFAULT_SETTINGS;
    }
    mergeWithDefaults(savedSettings) {
      return {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        geminiOptions: {
          ...DEFAULT_SETTINGS.geminiOptions,
          ...(savedSettings?.geminiOptions || {}),
        },
        apiKey: {
          gemini: [
            ...(savedSettings?.apiKey?.gemini ||
              DEFAULT_SETTINGS.apiKey.gemini),
          ],
          openai: [
            ...(savedSettings?.apiKey?.openai ||
              DEFAULT_SETTINGS.apiKey.openai),
          ],
        },
        currentKeyIndex: {
          ...DEFAULT_SETTINGS.currentKeyIndex,
          ...(savedSettings?.currentKeyIndex || {}),
        },
        contextMenu: {
          ...DEFAULT_SETTINGS.contextMenu,
          ...(savedSettings?.contextMenu || {}),
        },
        promptSettings: {
          ...DEFAULT_SETTINGS.promptSettings,
          ...(savedSettings?.promptSettings || {}),
        },
        inputTranslation: {
          ...DEFAULT_SETTINGS.inputTranslation,
          ...(savedSettings?.inputTranslation || {}),
        },
        pageTranslation: {
          ...DEFAULT_SETTINGS.pageTranslation,
          ...(savedSettings?.pageTranslation || {}),
        },
        ocrOptions: {
          ...DEFAULT_SETTINGS.ocrOptions,
          ...(savedSettings?.ocrOptions || {}),
        },
        displayOptions: {
          ...DEFAULT_SETTINGS.displayOptions,
          ...(savedSettings?.displayOptions || {}),
        },
        shortcuts: {
          ...DEFAULT_SETTINGS.shortcuts,
          ...(savedSettings?.shortcuts || {}),
        },
        clickOptions: {
          ...DEFAULT_SETTINGS.clickOptions,
          ...(savedSettings?.clickOptions || {}),
        },
        touchOptions: {
          ...DEFAULT_SETTINGS.touchOptions,
          ...(savedSettings?.touchOptions || {}),
        },
        cacheOptions: {
          text: {
            ...DEFAULT_SETTINGS.cacheOptions.text,
            ...(savedSettings?.cacheOptions?.text || {}),
          },
          image: {
            ...DEFAULT_SETTINGS.cacheOptions.image,
            ...(savedSettings?.cacheOptions?.image || {}),
          },
          media: {
            ...DEFAULT_SETTINGS.cacheOptions.media,
            ...(savedSettings?.cacheOptions?.media || {}),
          },
          page: {
            ...DEFAULT_SETTINGS.cacheOptions.page,
            ...(savedSettings?.cacheOptions?.page || {}),
          },
        },
        rateLimit: {
          ...DEFAULT_SETTINGS.rateLimit,
          ...(savedSettings?.rateLimit || {}),
        },
      };
    }
    saveSettings(settingsUI) {
      const geminiKeys = Array.from(settingsUI.querySelectorAll(".gemini-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const openaiKeys = Array.from(settingsUI.querySelectorAll(".openai-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const useCustomSelectors = settingsUI.querySelector(
        "#useCustomSelectors"
      ).checked;
      const customSelectors = settingsUI
        .querySelector("#customSelectors")
        .value.split("\n")
        .map((s) => s.trim())
        .filter((s) => s && s.length > 0);
      const combineWithDefault = settingsUI.querySelector(
        "#combineWithDefault"
      ).checked;
      const maxWidthVw = settingsUI.querySelector("#maxPopupWidth").value;
      const maxWidthPx = (window.innerWidth * parseInt(maxWidthVw)) / 100;
      const minWidthPx = parseInt(
        settingsUI.querySelector("#minPopupWidth").value
      );
      const finalMinWidth =
        minWidthPx > maxWidthPx
          ? maxWidthVw
          : settingsUI.querySelector("#minPopupWidth").value;
      const newSettings = {
        theme: settingsUI.querySelector('input[name="theme"]:checked').value,
        apiProvider: settingsUI.querySelector(
          'input[name="apiProvider"]:checked'
        ).value,
        apiKey: {
          gemini:
            geminiKeys.length > 0
              ? geminiKeys
              : [DEFAULT_SETTINGS.apiKey.gemini[0]],
          openai:
            openaiKeys.length > 0
              ? openaiKeys
              : [DEFAULT_SETTINGS.apiKey.openai[0]],
        },
        currentKeyIndex: {
          gemini: 0,
          openai: 0,
        },
        geminiOptions: {
          modelType: settingsUI.querySelector("#geminiModelType").value,
          fastModel: settingsUI.querySelector("#fastModel").value,
          proModel: settingsUI.querySelector("#proModel").value,
          visionModel: settingsUI.querySelector("#visionModel").value,
          customModel: settingsUI.querySelector("#customModel").value,
        },
        contextMenu: {
          enabled: settingsUI.querySelector("#contextMenuEnabled").checked,
        },
        inputTranslation: {
          enabled: settingsUI.querySelector("#inputTranslationEnabled").checked,
        },
        promptSettings: {
          enabled: true,
          useCustom: settingsUI.querySelector("#useCustomPrompt").checked,
          customPrompts: {
            normal: settingsUI.querySelector("#normalPrompt").value.trim(),
            normal_chinese: settingsUI
              .querySelector("#normalPrompt_chinese")
              .value.trim(),
            advanced: settingsUI.querySelector("#advancedPrompt").value.trim(),
            advanced_chinese: settingsUI
              .querySelector("#advancedPrompt_chinese")
              .value.trim(),
            ocr: settingsUI.querySelector("#ocrPrompt").value.trim(),
            ocr_chinese: settingsUI
              .querySelector("#ocrPrompt_chinese")
              .value.trim(),
            media: settingsUI.querySelector("#mediaPrompt").value.trim(),
            media_chinese: settingsUI
              .querySelector("#mediaPrompt_chinese")
              .value.trim(),
            page: settingsUI.querySelector("#pagePrompt").value.trim(),
            page_chinese: settingsUI
              .querySelector("#pagePrompt_chinese")
              .value.trim(),
          },
        },
        pageTranslation: {
          enabled: settingsUI.querySelector("#pageTranslationEnabled").checked,
          autoTranslate: settingsUI.querySelector("#autoTranslatePage").checked,
          showInitialButton:
            settingsUI.querySelector("#showInitialButton").checked,
          buttonTimeout: DEFAULT_SETTINGS.pageTranslation.buttonTimeout,
          useCustomSelectors,
          customSelectors,
          combineWithDefault,
          defaultSelectors: DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
          excludeSelectors: useCustomSelectors
            ? combineWithDefault
              ? [
                ...new Set([
                  ...DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
                  ...customSelectors,
                ]),
              ]
              : customSelectors
            : DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
          generation: {
            temperature: parseFloat(settingsUI.querySelector("#pageTranslationTemperature").value),
            topP: parseFloat(settingsUI.querySelector("#pageTranslationTopP").value),
            topK: parseInt(settingsUI.querySelector("#pageTranslationTopK").value)
          }
        },
        ocrOptions: {
          enabled: settingsUI.querySelector("#ocrEnabled").checked,
          preferredProvider: settingsUI.querySelector(
            'input[name="apiProvider"]:checked'
          ).value,
          displayType: "popup",
          maxFileSize: CONFIG.OCR.maxFileSize,
          temperature: parseFloat(
            settingsUI.querySelector("#ocrTemperature").value
          ),
          topP: parseFloat(settingsUI.querySelector("#ocrTopP").value),
          topK: parseInt(settingsUI.querySelector("#ocrTopK").value),
        },
        mediaOptions: {
          enabled: settingsUI.querySelector("#mediaEnabled").checked,
          temperature: parseFloat(
            settingsUI.querySelector("#mediaTemperature").value
          ),
          topP: parseFloat(settingsUI.querySelector("#mediaTopP").value),
          topK: parseInt(settingsUI.querySelector("#mediaTopK").value),
        },
        displayOptions: {
          fontSize: settingsUI.querySelector("#fontSize").value,
          minPopupWidth: finalMinWidth,
          maxPopupWidth: maxWidthVw,
          webImageTranslation: {
            fontSize: settingsUI.querySelector("#webImageFontSize").value,
          },
          translationMode: settingsUI.querySelector("#displayMode").value,
          targetLanguage: settingsUI.querySelector("#targetLanguage").value,
          sourceLanguage: settingsUI.querySelector("#sourceLanguage").value,
          languageLearning: {
            enabled:
              settingsUI.querySelector("#displayMode").value ===
              "language_learning",
            showSource: settingsUI.querySelector("#showSource").checked,
          },
        },
        shortcuts: {
          settingsEnabled: settingsUI.querySelector("#settingsShortcutEnabled")
            .checked,
          enabled: settingsUI.querySelector("#shortcutsEnabled").checked,
          pageTranslate: {
            key: settingsUI.querySelector("#pageTranslateKey").value,
            altKey: true,
          },
          inputTranslate: {
            key: settingsUI.querySelector("#inputTranslationKey").value,
            altKey: true,
          },
          quickTranslate: {
            key: settingsUI.querySelector("#quickKey").value,
            altKey: true,
          },
          popupTranslate: {
            key: settingsUI.querySelector("#popupKey").value,
            altKey: true,
          },
          advancedTranslate: {
            key: settingsUI.querySelector("#advancedKey").value,
            altKey: true,
          },
        },
        clickOptions: {
          enabled: settingsUI.querySelector("#translationButtonEnabled")
            .checked,
          singleClick: {
            translateType: settingsUI.querySelector("#singleClickSelect").value,
          },
          doubleClick: {
            translateType: settingsUI.querySelector("#doubleClickSelect").value,
          },
          hold: {
            translateType: settingsUI.querySelector("#holdSelect").value,
          },
        },
        touchOptions: {
          enabled: settingsUI.querySelector("#touchEnabled").checked,
          sensitivity: parseInt(
            settingsUI.querySelector("#touchSensitivity").value
          ),
          twoFingers: {
            translateType: settingsUI.querySelector("#twoFingersSelect").value,
          },
          threeFingers: {
            translateType: settingsUI.querySelector("#threeFingersSelect")
              .value,
          },
        },
        cacheOptions: {
          text: {
            enabled: settingsUI.querySelector("#textCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#textCacheMaxSize").value
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#textCacheExpiration").value
            ),
          },
          image: {
            enabled: settingsUI.querySelector("#imageCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#imageCacheMaxSize").value
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#imageCacheExpiration").value
            ),
          },
          media: {
            enabled: settingsUI.querySelector("#mediaCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#mediaCacheMaxSize").value
            ),
            expirationTime:
              parseInt(
                settingsUI.querySelector("#mediaCacheExpirationTime").value
              ) * 1000,
          },
        },
        rateLimit: {
          maxRequests: parseInt(settingsUI.querySelector("#maxRequests").value),
          perMilliseconds: parseInt(
            settingsUI.querySelector("#perMilliseconds").value
          ),
        },
      };
      const isToolsEnabled = settingsUI.querySelector(
        "#showTranslatorTools"
      ).checked;
      const currentState =
        localStorage.getItem("translatorToolsEnabled") === "true";
      if (isToolsEnabled !== currentState) {
        localStorage.setItem(
          "translatorToolsEnabled",
          isToolsEnabled.toString()
        );
        this.translator.ui.removeToolsContainer();
        this.translator.ui.resetState();
        const overlays = this.$$(".translator-overlay");
        overlays.forEach((overlay) => overlay.remove());
        if (isToolsEnabled) {
          this.translator.ui.setupTranslatorTools();
        }
      }
      const mergedSettings = this.mergeWithDefaults(newSettings);
      GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
      this.settings = mergedSettings;
      const event = new CustomEvent("settingsChanged", {
        detail: mergedSettings,
      });
      document.dispatchEvent(event);
      return mergedSettings;
    }
    getSetting(path) {
      return path.split(".").reduce((obj, key) => obj?.[key], this.settings);
    }
  }
  class APIKeyManager {
    constructor(settings) {
      this.settings = settings;
      this.failedKeys = new Map();
      this.activeKeys = new Map();
      this.keyStats = new Map();
      this.rateLimitedKeys = new Map();
      this.keyRotationInterval = 10000; // 10s
      this.maxConcurrentRequests = 5;
      this.retryDelays = [1000, 2000, 4000];
      this.successRateThreshold = 0.7;
      this.setupKeyRotation();
    }
    markKeyAsRateLimited(key) {
      const now = Date.now();
      this.rateLimitedKeys.set(key, {
        timestamp: now,
        retryAfter: now + this.settings.rateLimit.perMilliseconds
      });
    }
    getAvailableKeys(provider) {
      const allKeys = this.settings.apiKey[provider];
      if (!allKeys || allKeys.length === 0) {
        throw new Error("Không có API key nào được cấu hình");
      }
      const now = Date.now();
      return allKeys.filter(key => {
        if (!key) return false;
        const failedInfo = this.failedKeys.get(key);
        const activeInfo = this.activeKeys.get(key);
        const rateLimitInfo = this.rateLimitedKeys.get(key);
        const stats = this.keyStats.get(key);
        const isFailed = failedInfo && (now - failedInfo.timestamp < 60000);
        const isBusy = activeInfo && (activeInfo.requests >= this.maxConcurrentRequests);
        const isRateLimited = rateLimitInfo && (now < rateLimitInfo.retryAfter);
        const hasLowSuccessRate = stats &&
          stats.total > 10 &&
          (stats.success / stats.total) < this.successRateThreshold;
        return !isFailed && !isBusy && !isRateLimited && !hasLowSuccessRate;
      });
    }
    async executeWithMultipleKeys(promiseGenerator, provider, maxConcurrent = 3) {
      const availableKeys = this.getAvailableKeys(provider);
      if (!availableKeys || availableKeys.length === 0) {
        throw new Error("Không có API key khả dụng");
      }
      const promises = [];
      let currentKeyIndex = 0;
      const processRequest = async () => {
        if (currentKeyIndex >= availableKeys.length) return null;
        const key = availableKeys[currentKeyIndex++];
        try {
          const result = await this.useKey(key, () => promiseGenerator(key));
          if (result) {
            this.updateKeyStats(key, true);
            return { status: "fulfilled", value: result };
          }
        } catch (error) {
          this.updateKeyStats(key, false);
          if (error.message.includes("API key not valid")) {
            this.markKeyAsFailed(key);
          } else if (error.message.includes("rate limit")) {
            this.markKeyAsRateLimited(key);
          }
          return { status: "rejected", reason: error };
        }
      };
      for (let i = 0; i < Math.min(maxConcurrent, availableKeys.length); i++) {
        promises.push(processRequest());
      }
      const results = await Promise.all(promises);
      const successResults = results
        .filter(r => r && r.status === "fulfilled")
        .map(r => r.value);
      if (successResults.length > 0) {
        return successResults;
      }
      throw new Error("Tất cả API key đều thất bại");
    }
    async useKey(key, action) {
      let activeInfo = this.activeKeys.get(key) || {
        requests: 0,
        timestamp: Date.now()
      };
      activeInfo.requests++;
      this.activeKeys.set(key, activeInfo);
      try {
        const result = await action();
        return result;
      } catch (error) {
        if (error.message.includes("API key not valid") ||
          error.message.includes("rate limit") ||
          error.status === 400 ||
          error.status === 429) {
          this.markKeyAsFailed(key);
        }
        throw error;
      } finally {
        activeInfo = this.activeKeys.get(key);
        if (activeInfo) {
          activeInfo.requests--;
          if (activeInfo.requests <= 0) {
            this.activeKeys.delete(key);
          } else {
            this.activeKeys.set(key, activeInfo);
          }
        }
      }
    }
    markKeyAsFailed(key) {
      if (!key) return;
      const failInfo = this.failedKeys.get(key) || { failures: 0 };
      failInfo.failures++;
      failInfo.timestamp = Date.now();
      this.failedKeys.set(key, failInfo);
      if (this.activeKeys.has(key)) {
        this.activeKeys.delete(key);
      }
      this.updateKeyStats(key, false);
      console.log(`Marked key as failed: ${key.slice(0, 8)}... (${failInfo.failures} failures)`);
    }
    updateKeyStats(key, success) {
      const stats = this.keyStats.get(key) || {
        success: 0,
        fails: 0,
        total: 0,
        lastUsed: 0,
        avgResponseTime: 0
      };
      stats.total++;
      if (success) {
        stats.success++;
      } else {
        stats.fails++;
      }
      stats.lastUsed = Date.now();
      this.keyStats.set(key, stats);
    }
    setupKeyRotation() {
      setInterval(() => {
        const now = Date.now();
        for (const [key, info] of this.rateLimitedKeys.entries()) {
          if (now >= info.retryAfter) {
            this.rateLimitedKeys.delete(key);
          }
        }
        for (const [key, info] of this.failedKeys.entries()) {
          if (now - info.timestamp >= 60000) {
            this.failedKeys.delete(key);
          }
        }
        for (const [key, info] of this.activeKeys.entries()) {
          if (now - info.timestamp >= 30000) {
            info.requests = 0;
            this.activeKeys.set(key, info);
          }
        }
        for (const [key, stats] of this.keyStats.entries()) {
          if (now - stats.lastUsed > 3600000) {
            stats.success = Math.floor(stats.success * 0.9);
            stats.total = Math.floor(stats.total * 0.9);
            this.keyStats.set(key, stats);
          }
        }
      }, this.keyRotationInterval);
    }
  }
  class APIManager {
    constructor(config, getSettings) {
      this.config = config;
      this.getSettings = getSettings;
      this.keyManager = new APIKeyManager(getSettings());
      this.currentProvider = getSettings().apiProvider;
      this.keyRateLimits = new Map();
    }
    getGenerationConfig(useCase) {
      const settings = this.getSettings();
      switch (useCase) {
        case 'ocr':
          return {
            temperature: settings.ocrOptions.temperature,
            topP: settings.ocrOptions.topP,
            topK: settings.ocrOptions.topK
          };
        case 'media':
          return {
            temperature: settings.mediaOptions.temperature,
            topP: settings.mediaOptions.topP,
            topK: settings.mediaOptions.topK
          };
        case 'page':
          return {
            temperature: settings.pageTranslation.generation.temperature,
            topP: settings.pageTranslation.generation.topP,
            topK: settings.pageTranslation.generation.topK
          };
        default:
          return {
            temperature: settings.pageTranslation.generation.temperature,
            topP: settings.pageTranslation.generation.topP,
            topK: settings.pageTranslation.generation.topK
          };
      }
    }
    async checkRateLimit(apiKey) {
      const now = Date.now();
      const settings = this.getSettings();
      const { maxRequests, perMilliseconds } = settings.rateLimit;
      if (!this.keyRateLimits.has(apiKey)) {
        this.keyRateLimits.set(apiKey, {
          queue: [],
          lastRequestTime: 0
        });
      }
      const rateLimitInfo = this.keyRateLimits.get(apiKey);
      rateLimitInfo.queue = rateLimitInfo.queue.filter(
        time => now - time < perMilliseconds
      );
      if (rateLimitInfo.queue.length >= maxRequests) {
        const oldestRequest = rateLimitInfo.queue[0];
        const waitTime = perMilliseconds - (now - oldestRequest);
        if (waitTime > 0) {
          return false;
        }
        rateLimitInfo.queue.shift();
      }
      rateLimitInfo.queue.push(now);
      rateLimitInfo.lastRequestTime = now;
      return true;
    }
    async request(prompt, useCase = 'normal') {
      const provider = this.config.providers[this.currentProvider];
      if (!provider) {
        throw new Error(`Provider ${this.currentProvider} not found`);
      }
      try {
        const responses = await this.keyManager.executeWithMultipleKeys(
          async (key) => {
            const canUseKey = await this.checkRateLimit(key);
            if (!canUseKey) {
              this.keyManager.markKeyAsRateLimited(key);
              throw new Error("Rate limit exceeded for this key");
            }
            const selectedModel = this.getGeminiModel();
            const generationConfig = this.getGenerationConfig(useCase);
            return await this.makeApiRequest(key, selectedModel, prompt, generationConfig);
          },
          this.currentProvider
        );
        if (responses && responses.length > 0) {
          return provider.responseParser(responses[0]);
        }
        throw new Error("Failed to get translation after all retries");
      } catch (error) {
        console.error("Request failed:", error);
        throw error;
      }
    }
    async makeApiRequest(key, model, prompt, generationConfig) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig
          }),
          onload: (response) => {
            if (response.status === 200) {
              try {
                const result = JSON.parse(response.responseText);
                if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                  resolve(result.candidates[0].content.parts[0].text);
                } else {
                  reject(new Error("Invalid response format"));
                }
              } catch (error) {
                reject(new Error("Failed to parse response"));
              }
            } else {
              if (response.status === 429 || response.status === 403) {
                this.keyManager.markKeyAsFailed(key);
                reject(new Error("API key rate limit exceeded"));
              } else {
                reject(new Error(`API Error: ${response.status}`));
              }
            }
          },
          onerror: (error) => reject(error)
        });
      });
    }
    getGeminiModel() {
      const settings = this.getSettings();
      const geminiOptions = settings.geminiOptions;
      switch (geminiOptions.modelType) {
        case 'fast':
          return geminiOptions.fastModel;
        case 'pro':
          return geminiOptions.proModel;
        case 'vision':
          return geminiOptions.visionModel;
        case 'custom':
          return geminiOptions.customModel || "gemini-2.0-flash-lite";
        default:
          return "gemini-2.0-flash-lite";
      }
    }
  }
  class InputTranslator {
    constructor(translator) {
      this.translator = translator;
      this.isSelectOpen = false;
      this.isTranslating = false;
      this.activeButtons = new Map();
      this.page = new PageTranslator(translator);
      this.ui = new UIManager(translator);
      this.setupObservers();
      this.setupEventListeners();
      this.initializeExistingEditors();
    }
    setupObservers() {
      const settings = this.translator.userSettings.settings;
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
        subtree: true,
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
        'input[type="text"]',
      ].join(",");
    }
    isValidEditor(element) {
      const settings = this.translator.userSettings.settings;
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
      const settings = this.translator.userSettings.settings;
      if (!settings.inputTranslation?.enabled) return;
      document.addEventListener("focusin", (e) => {
        const editor = this.findParentEditor(e.target);
        if (editor) {
          this.addTranslateButton(editor);
          this.updateButtonVisibility(editor);
        }
      });
      document.addEventListener("focusout", (e) => {
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
      });
      document.addEventListener("input", (e) => {
        const editor = this.findParentEditor(e.target);
        if (editor) {
          if (!this.activeButtons.has(editor)) {
            this.addTranslateButton(editor);
          }
          this.updateButtonVisibility(editor);
        }
      });
    }
    updateButtonVisibility(editor) {
      const container = this.activeButtons.get(editor);
      if (container) {
        const hasContent = this.getEditorContent(editor);
        container.style.display = hasContent ? "" : "none";
      }
    }
    getEditorContent(editor) {
      const settings = this.translator.userSettings.settings;
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
            background-color: rgba(255,255,255,0.05);
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
    background-color: rgba(0,74,153,0.1);
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
      const settings = this.translator.userSettings.settings.displayOptions;
      const sourceRow = document.createElement("div");
      sourceRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 5px;
    `;
      const sourceButton = this.createButton("🌐", "Dịch sang ngôn ngữ nguồn");
      const sourceSelect = document.createElement("select");
      const theme = this.getCurrentTheme();
      sourceSelect.style.cssText = `
  background-color: rgba(255,255,255,0.05);
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
        auto: "Tự động",
        vi: "Tiếng Việt",
        en: "Tiếng Anh",
        zh: "Tiếng Trung",
        ko: "Tiếng Hàn",
        ja: "Tiếng Nhật",
        fr: "Tiếng Pháp",
        de: "Tiếng Đức",
        es: "Tiếng Tây Ban Nha",
        it: "Tiếng Ý",
        pt: "Tiếng Bồ Đào Nha",
        ru: "Tiếng Nga",
        ar: "Tiếng Ả Rập",
        hi: "Tiếng Hindi",
        bn: "Tiếng Bengal",
        id: "Tiếng Indonesia",
        ms: "Tiếng Malaysia",
        th: "Tiếng Thái",
        tr: "Tiếng Thổ Nhĩ Kỳ",
        nl: "Tiếng Hà Lan",
        pl: "Tiếng Ba Lan",
        uk: "Tiếng Ukraine",
        el: "Tiếng Hy Lạp",
        cs: "Tiếng Séc",
        da: "Tiếng Đan Mạch",
        fi: "Tiếng Phần Lan",
        he: "Tiếng Do Thái",
        hu: "Tiếng Hungary",
        no: "Tiếng Na Uy",
        ro: "Tiếng Romania",
        sv: "Tiếng Thụy Điển",
        ur: "Tiếng Urdu"
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
      const targetButton = this.createButton("🔄", "Dịch sang ngôn ngữ đích");
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
      this.ui.shadowRoot.appendChild(container);
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
        button.innerHTML = "⌛";
        button.style.opacity = "0.7";
        const sourceLang = isSource && selectedLang === "auto" ?
          this.page.languageCode : selectedLang;
        const translation = await this.translator.translate(
          text,
          null,
          false,
          false,
          sourceLang
        );
        this.setEditorContent(editor, translation);
      } catch (error) {
        console.error("Translation error:", error);
        this.translator.ui.showNotification("Lỗi dịch: " + error.message, "error");
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
      const themeMode = this.translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === 'dark';
      return {
        backgroundColor: theme.background,
        text: theme.text,
        border: theme.border,
        hoverBg: isDark ? "#555" : "#eee",
        hoverText: isDark ? "#eee" : "#555",
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
        container.remove();
        this.activeButtons.delete(editor);
        this.resizeObserver.unobserve(editor);
      }
    }
    initializeExistingEditors() {
      const settings = this.translator.userSettings.settings;
      if (!settings.inputTranslation?.enabled) return;
      document.querySelectorAll(this.getEditorSelectors()).forEach((editor) => {
        if (this.isValidEditor(editor) && this.getEditorContent(editor)) {
          this.addTranslateButton(editor);
        }
      });
    }
    cleanup() {
      this.mutationObserver.disconnect();
      this.resizeObserver.disconnect();
      this.activeButtons.forEach((_container, editor) => {
        this.removeTranslateButton(editor);
      });
    }
  }
  class OCRManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required for OCRManager");
      }
      this.translator = translator;
      this.isProcessing = false;
      this.imageCache = new FileCache(
        CONFIG.CACHE.image.maxSize,
        CONFIG.CACHE.image.expirationTime
      );
    }
    async captureScreen() {
      try {
        this.translator.ui.showProcessingStatus(
          "Đang chuẩn bị chụp màn hình..."
        );
        const elements = this.$$(
          ".translator-tools-container, .translator-notification, .center-translate-status"
        );
        elements.forEach((el) => {
          if (el) el.style.visibility = "hidden";
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        const options = {
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          scale: window.devicePixelRatio || 1,
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
          x: window.pageXOffset,
          y: window.pageYOffset,
          onclone: function(clonedDoc) {
            const elements = clonedDoc.querySelectorAll(
              ".translator-tools-container, .translator-notification, .center-translate-status"
            );
            elements.forEach((el) => {
              if (el) el.style.display = "none";
            });
          },
        };
        this.translator.ui.updateProcessingStatus("Đang chụp màn hình...", 30);
        const canvas = await html2canvas(document.documentElement, options);
        this.translator.ui.updateProcessingStatus("Đang xử lý ảnh...", 60);
        const blob = await new Promise((resolve, reject) => {
          try {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error("Failed to create blob from canvas"));
                }
              },
              "image/png",
              1.0
            );
          } catch (error) {
            reject(error);
          }
        });
        elements.forEach((el) => {
          if (el) el.style.visibility = "";
        });
        this.translator.ui.updateProcessingStatus("Đang chuẩn bị OCR...", 80);
        const file = new File([blob], "king1x32_screenshot.png", {
          type: "image/png",
        });
        return file;
      } catch (error) {
        console.error("Screen capture error:", error);
        const elements = this.$$(
          ".translator-tools-container, .translator-notification, .center-translate-status"
        );
        elements.forEach((el) => {
          if (el) el.style.visibility = "";
        });
        throw new Error(`Không thể chụp màn hình: ${error.message}`);
      }
    }
    async processImage(file) {
      try {
        this.isProcessing = true;
        this.translator.ui.showProcessingStatus("Đang xử lý ảnh...");
        const base64Image = await this.fileToBase64(file);
        this.translator.ui.updateProcessingStatus("Đang kiểm tra cache...", 20);
        if (
          this.imageCache &&
          this.translator.userSettings.settings.cacheOptions.image.enabled
        ) {
          const cachedResult = await this.imageCache.get(base64Image);
          if (cachedResult) {
            this.translator.ui.updateProcessingStatus(
              "Đã tìm thấy trong cache",
              100
            );
            return cachedResult;
          }
        }
        this.translator.ui.updateProcessingStatus("Đang nhận diện text...", 40);
        const settings = this.translator.userSettings.settings;
        const selectedModel = this.translator.api.getGeminiModel();
        const prompt = this.translator.createPrompt("ocr", "ocr");
        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: settings.ocrOptions.temperature,
            topP: settings.ocrOptions.topP,
            topK: settings.ocrOptions.topK,
          },
        };
        this.translator.ui.updateProcessingStatus("Đang xử lý OCR...", 60);
        const results = await this.translator.api.keyManager.executeWithMultipleKeys(
          async (key) => {
            const response = await new Promise((resolve, reject) => {
              GM_xmlhttpRequest({
                method: "POST",
                url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(requestBody),
                onload: (response) => {
                  if (response.status === 200) {
                    try {
                      const result = JSON.parse(response.responseText);
                      if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        resolve(result.candidates[0].content.parts[0].text);
                      } else {
                        reject(new Error("Invalid response format"));
                      }
                    } catch (error) {
                      reject(new Error("Failed to parse response"));
                    }
                  } else {
                    if (response.status === 429 || response.status === 403) {
                      reject(new Error("API key rate limit exceeded"));
                    } else {
                      reject(new Error(`API Error: ${response.status}`));
                    }
                  }
                },
                onerror: (error) => reject(new Error(`Connection error: ${error}`))
              });
            });
            return response;
          },
          settings.apiProvider
        );
        this.translator.ui.updateProcessingStatus("Đang hoàn thiện...", 80);
        if (!results || results.length === 0) {
          throw new Error("Không thể trích xuất text từ ảnh");
        }
        const finalResult = results[0];
        if (this.imageCache && settings.cacheOptions.image.enabled) {
          await this.imageCache.set(base64Image, finalResult);
        }
        this.translator.ui.updateProcessingStatus("Hoàn thành", 100);
        return finalResult;
      } catch (error) {
        console.error("OCR processing error:", error);
        throw error;
      } finally {
        this.isProcessing = false;
        setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
      }
    }
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Không thể đọc file"));
        reader.readAsDataURL(file);
      });
    }
  }
  class MediaManager {
    constructor(translator) {
      this.translator = translator;
      this.isProcessing = false;
      this.mediaCache = new FileCache(
        CONFIG.CACHE.media.maxSize,
        CONFIG.CACHE.media.expirationTime
      );
    }
    async processMediaFile(file) {
      try {
        if (!this.isValidFormat(file)) {
          throw new Error("Định dạng file không được hỗ trợ");
        }
        if (!this.isValidSize(file)) {
          throw new Error(
            `File quá lớn. Kích thước tối đa: ${this.getMaxSizeInMB(file)}MB`
          );
        }
        this.isProcessing = true;
        this.translator.ui.showProcessingStatus("Đang xử lý media...");
        const base64Media = await this.fileToBase64(file);
        this.translator.ui.updateProcessingStatus("Đang kiểm tra cache...", 20);
        const cacheEnabled =
          this.translator.userSettings.settings.cacheOptions.media?.enabled;
        if (cacheEnabled && this.mediaCache) {
          const cachedResult = await this.mediaCache.get(base64Media);
          if (cachedResult) {
            this.translator.ui.updateProcessingStatus(
              "Đã tìm thấy trong cache",
              100
            );
            this.translator.ui.displayPopup(cachedResult, null, "Bản dịch");
            return;
          }
        }
        this.translator.ui.updateProcessingStatus(
          "Đang xử lý audio/video...",
          40
        );
        const settings = this.translator.userSettings.settings;
        const mediaSettings = settings.mediaOptions;
        const selectedModel = this.translator.api.getGeminiModel();
        const prompt = this.translator.createPrompt("media", "media");
        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Media,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: mediaSettings.temperature,
            topP: mediaSettings.topP,
            topK: mediaSettings.topK,
          },
        };
        this.translator.ui.updateProcessingStatus("Đang dịch...", 60);
        const results = await this.translator.api.keyManager.executeWithMultipleKeys(
          async (key) => {
            const response = await new Promise((resolve, reject) => {
              GM_xmlhttpRequest({
                method: "POST",
                url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(requestBody),
                onload: (response) => {
                  if (response.status === 200) {
                    try {
                      const result = JSON.parse(response.responseText);
                      if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        resolve(result.candidates[0].content.parts[0].text);
                      } else {
                        reject(new Error("Invalid response format"));
                      }
                    } catch (error) {
                      reject(new Error("Failed to parse response"));
                    }
                  } else {
                    if (response.status === 429 || response.status === 403) {
                      reject(new Error("API key rate limit exceeded"));
                    } else {
                      reject(new Error(`API Error: ${response.status}`));
                    }
                  }
                },
                onerror: (error) => reject(new Error(`Connection error: ${error}`))
              });
            });
            return response;
          },
          settings.apiProvider
        );
        this.translator.ui.updateProcessingStatus("Đang hoàn thiện...", 80);
        if (!results || results.length === 0) {
          throw new Error("Không thể xử lý media");
        }
        const finalResult = results[0];
        if (cacheEnabled && this.mediaCache) {
          await this.mediaCache.set(base64Media, finalResult);
        }
        this.translator.ui.updateProcessingStatus("Hoàn thành", 100);
        this.translator.ui.displayPopup(finalResult, null, "Bản dịch");
      } catch (error) {
        console.error("Media processing error:", error);
        throw new Error(`Không thể xử lý file: ${error.message}`);
      } finally {
        this.isProcessing = false;
        setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
      }
    }
    isValidFormat(file) {
      const extension = file.name.split(".").pop().toLowerCase();
      const mimeMapping = {
        mp3: "audio/mp3",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/m4a",
        aac: "audio/aac",
        flac: "audio/flac",
        wma: "audio/wma",
        opus: "audio/opus",
        amr: "audio/amr",
        midi: "audio/midi",
        mid: "audio/midi",
        mp4: "video/mp4",
        webm: "video/webm",
        ogv: "video/ogg",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        wmv: "video/x-ms-wmv",
        flv: "video/x-flv",
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
        mkv: "video/x-matroska",
      };
      const mimeType = mimeMapping[extension];
      if (mimeType?.startsWith("audio/")) {
        return CONFIG.MEDIA.audio.supportedFormats.includes(mimeType);
      } else if (mimeType?.startsWith("video/")) {
        return CONFIG.MEDIA.video.supportedFormats.includes(mimeType);
      }
      return false;
    }
    isValidSize(file) {
      const maxSize = file.type.startsWith("audio/")
        ? CONFIG.MEDIA.audio.maxSize
        : CONFIG.MEDIA.video.maxSize;
      return file.size <= maxSize;
    }
    getMaxSizeInMB(file) {
      const maxSize = file.type.startsWith("audio/")
        ? CONFIG.MEDIA.audio.maxSize
        : CONFIG.MEDIA.video.maxSize;
      return Math.floor(maxSize / (1024 * 1024));
    }
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Không thể đọc file"));
        reader.readAsDataURL(file);
      });
    }
    cleanup() {
      try {
        if (this.audioCtx) {
          this.audioCtx.close();
          this.audioCtx = null;
        }
        if (this.processor) {
          this.processor.disconnect();
          this.processor = null;
        }
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
        this.mediaElement = null;
        this.audioBuffer = null;
      } catch (error) {
        console.error("Error during cleanup:", error);
      }
    }
  }
  class PageTranslator {
    constructor(translator) {
      this.translator = translator;
      this.MIN_TEXT_LENGTH = 100;
      this.originalTexts = new Map();
      this.isTranslated = false;
      this.languageCode = this.detectLanguage().languageCode;
      this.pageCache = new Map();
      this.pdfLoaded = true;
    }
    getExcludeSelectors() {
      const settings = this.translator.userSettings.settings.pageTranslation;
      if (!settings.useCustomSelectors) {
        return settings.defaultSelectors;
      }
      return settings.combineWithDefault
        ? [
          ...new Set([
            ...settings.defaultSelectors,
            ...settings.customSelectors,
          ]),
        ]
        : settings.customSelectors;
    }
    async detectLanguage() {
      try {
        let text = "";
        if (document.body.innerText) {
          text = document.body.innerText;
        }
        if (!text) {
          const paragraphs = document.querySelectorAll("p");
          paragraphs.forEach((p) => {
            text += p.textContent + " ";
          });
        }
        if (!text) {
          const headings = document.querySelectorAll("h1, h2, h3");
          headings.forEach((h) => {
            text += h.textContent + " ";
          });
        }
        if (!text) {
          text = document.title;
        }
        text = text.slice(0, 1000).trim();
        if (!text.trim()) {
          throw new Error("Không tìm thấy nội dung để phát hiện ngôn ngữ");
        }
        const prompt =
          "Detect language of this text and return only ISO code (e.g. 'en', 'vi'): " +
          text;
        if (!this.translator.api) {
          throw new Error("API không khả dụng");
        }
        const response = await this.translator.api.request(prompt, "page");
        this.languageCode = response.trim().toLowerCase();
        const targetLanguage =
          this.translator.userSettings.settings.displayOptions.targetLanguage;
        if (this.languageCode === targetLanguage) {
          return {
            isVietnamese: true,
            message: `Trang web đã ở ngôn ngữ ${targetLanguage}`,
          };
        }
        return {
          isVietnamese: false,
          message: `Đã phát hiện ngôn ngữ: ${this.languageCode}`,
        };
      } catch (error) {
        console.error("Language detection error:", error);
        throw new Error("Không thể phát hiện ngôn ngữ: " + error.message);
      }
    }
    async checkAndTranslate() {
      try {
        const settings = this.translator.userSettings.settings;
        if (!settings.pageTranslation.autoTranslate) {
          return {
            success: false,
            message: "Tự động dịch đang tắt",
          };
        }
        const languageCheck = await this.detectLanguage();
        if (languageCheck.isVietnamese) {
          return {
            success: false,
            message: languageCheck.message,
          };
        }
        const result = await this.translatePage();
        if (result.success) {
          const toolsContainer = this.$(
            ".translator-tools-container"
          );
          if (toolsContainer) {
            const menuItem = toolsContainer.querySelector(
              '[data-type="pageTranslate"]'
            );
            if (menuItem) {
              const itemText = menuItem.querySelector(".item-text");
              if (itemText) {
                itemText.textContent = this.isTranslated
                  ? "Bản gốc"
                  : "Dịch trang";
              }
            }
          }
          const floatingButton = this.$(
            ".page-translate-button"
          );
          if (floatingButton) {
            floatingButton.innerHTML = this.isTranslated
              ? "📄 Bản gốc"
              : "📄 Dịch trang";
          }
          this.translator.ui.showNotification(result.message, "success");
        } else {
          this.translator.ui.showNotification(result.message, "warning");
        }
        return result;
      } catch (error) {
        console.error("Translation check error:", error);
        return {
          success: false,
          message: error.message,
        };
      }
    }
    async translatePage() {
      try {
        if (!this.domObserver) {
          this.setupDOMObserver();
        }
        if (this.isTranslated) {
          await Promise.all(
            Array.from(this.originalTexts.entries()).map(async ([node, originalText]) => {
              if (node && node.parentNode) {
                node.textContent = originalText;
              }
            })
          );
          this.originalTexts.clear();
          this.isTranslated = false;
          return {
            success: true,
            message: "Đã chuyển về văn bản gốc"
          };
        }
        const textNodes = this.collectTextNodes();
        if (textNodes.length === 0) {
          return {
            success: false,
            message: "Không tìm thấy nội dung cần dịch"
          };
        }
        const chunks = this.createChunks(textNodes, 2000);
        const nodeStatus = new Map();
        await Promise.all(
          textNodes.map(async node => {
            nodeStatus.set(node, {
              translated: false,
              text: node.textContent
            });
          })
        );
        const results = await Promise.all(
          chunks.map(async chunk => {
            try {
              const textsToTranslate = chunk
                .map(node => node.textContent.trim())
                .filter(text => text.length > 0)
                .join('\n');
              if (!textsToTranslate) return;
              const prompt = this.translator.createPrompt(textsToTranslate, "page");
              const translatedText = await this.translator.api.request(prompt, 'page');
              if (!translatedText) return;
              const translations = translatedText.split('\n');
              await Promise.all(
                chunk.map(async (node, index) => {
                  if (index >= translations.length) return;
                  const text = node.textContent.trim();
                  if (text.length > 0 && node.parentNode && document.contains(node)) {
                    try {
                      this.originalTexts.set(node, node.textContent);
                      const translated = translations[index];
                      const mode = this.translator.userSettings.settings.displayOptions.translationMode;
                      let output = this.formatTranslation(
                        text,
                        translated,
                        mode,
                        this.translator.userSettings.settings.displayOptions
                      );
                      if (await this.updateNode(node, output)) {
                        nodeStatus.set(node, {
                          translated: true,
                          text: node.textContent
                        });
                      }
                    } catch (error) {
                      console.error("Node update error:", error);
                      nodeStatus.set(node, {
                        translated: false,
                        error: "Update failed"
                      });
                    }
                  }
                })
              );
            } catch (error) {
              console.error("Chunk processing error:", error);
              await Promise.all(
                chunk.map(async node => {
                  nodeStatus.set(node, {
                    translated: false,
                    error: error.message
                  });
                })
              );
            }
          })
        );
        const processedResults = await Promise.all(
          results.map(async result => {
            if (!result) {
              return {
                failed: true,
                error: "Translation failed"
              };
            }
            return {
              failed: false
            };
          })
        );
        const failedCount = processedResults.filter(r => r.failed).length;
        this.isTranslated = true;
        if (failedCount > 0) {
          return {
            success: true,
            message: `Đã dịch trang (${failedCount} phần bị lỗi)`
          };
        }
        return {
          success: true,
          message: "Đã dịch xong trang"
        };
      } catch (error) {
        console.error("Page translation error:", error);
        return {
          success: false,
          message: error.message
        };
      }
    }
    async updateNode(node, translation) {
      if (!node || !node.parentNode || !document.contains(node)) {
        return false;
      }
      try {
        node.textContent = translation;
        return true;
      } catch (error) {
        console.error("Node update failed:", error);
        return false;
      }
    }
    createChunks(nodes, maxChunkSize = 2000) {
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const isSentenceEnd = text => /[.!?。！？]$/.test(text.trim());
      const isPunctuationBreak = text => /[,;，；、]$/.test(text.trim());
      const isParagraphBreak = node => {
        const parentTag = node.parentElement?.tagName?.toLowerCase();
        return ['p', 'div', 'h1', 'h2', 'h3', 'li'].includes(parentTag);
      };
      for (const node of nodes) {
        const text = node.textContent.trim();
        if ((currentLength + text.length > maxChunkSize) && currentChunk.length > 0) {
          let splitIndex = currentChunk.length - 1;
          while (splitIndex > 0) {
            if (isParagraphBreak(currentChunk[splitIndex])) break;
            splitIndex--;
          }
          if (splitIndex === 0) {
            splitIndex = currentChunk.length - 1;
            while (splitIndex > 0) {
              if (isSentenceEnd(currentChunk[splitIndex].textContent)) break;
              splitIndex--;
            }
          }
          if (splitIndex === 0) {
            splitIndex = currentChunk.length - 1;
            while (splitIndex > 0) {
              if (isPunctuationBreak(currentChunk[splitIndex].textContent)) break;
              splitIndex--;
            }
          }
          const newChunk = currentChunk.splice(splitIndex + 1);
          chunks.push(currentChunk);
          currentChunk = newChunk;
          currentLength = currentChunk.reduce((len, n) => len + n.textContent.trim().length, 0);
        }
        currentChunk.push(node);
        currentLength += text.length;
        const isLastNode = nodes.indexOf(node) === nodes.length - 1;
        const isEndOfParagraph = isParagraphBreak(node);
        if ((isLastNode || isEndOfParagraph) && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      const finalChunks = [];
      let previousChunk = null;
      for (const chunk of chunks) {
        const chunkLength = chunk.reduce((len, node) => len + node.textContent.trim().length, 0);
        if (chunkLength < maxChunkSize * 0.3 && previousChunk) {
          const combinedLength = previousChunk.reduce((len, node) => len + node.textContent.trim().length, 0) + chunkLength;
          if (combinedLength <= maxChunkSize) {
            previousChunk.push(...chunk);
            continue;
          }
        }
        finalChunks.push(chunk);
        previousChunk = chunk;
      }
      return finalChunks;
    }
    async detectContext(text) {
      const prompt = `Analyze the context and writing style of this text and return JSON format with these properties:
    - style: formal/informal/technical/casual
    - tone: professional/friendly/neutral/academic
    - domain: general/technical/business/academic/other
    Text: "${text}"`;
      try {
        const analysis = await this.translator.api.request(prompt, "page");
        const result = JSON.parse(analysis);
        return {
          style: result.style,
          tone: result.tone,
          domain: result.domain,
        };
      } catch (error) {
        console.error("Context detection failed:", error);
        return {
          style: "neutral",
          tone: "neutral",
          domain: "general",
        };
      }
    }
    async translateHTML(htmlContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const scripts = doc.getElementsByTagName("script");
        const styles = doc.getElementsByTagName("style");
        [...scripts, ...styles].forEach(element => element.remove());
        const translatableNodes = this.getTranslatableHTMLNodes(doc.body);
        const chunks = this.createChunks(translatableNodes, 2000);
        this.translator.ui.showTranslatingStatus();
        await Promise.all(
          chunks.map(async chunk => {
            try {
              const textsToTranslate = await Promise.all(
                chunk.map(node => node.textContent.trim())
              );
              const validTexts = textsToTranslate.filter(text => text.length > 0);
              if (validTexts.length === 0) return;
              const textToTranslate = validTexts.join("\n");
              const prompt = this.translator.createPrompt(textToTranslate, "page");
              const translatedText = await this.translator.api.request(prompt, 'page');
              if (!translatedText) return;
              const translations = translatedText.split("\n");
              await Promise.all(
                chunk.map(async (node, index) => {
                  if (index >= translations.length) return;
                  const text = node.textContent.trim();
                  if (text.length > 0 && node.parentNode && document.contains(node)) {
                    try {
                      if (node.isAttribute) {
                        node.ownerElement.setAttribute(node.attributeName, translations[index].trim());
                      } else {
                        node.textContent = translations[index].trim();
                      }
                    } catch (error) {
                      console.error("DOM update error:", error);
                    }
                  }
                })
              );
            } catch (error) {
              console.error("Chunk translation error:", error);
            }
          })
        );
        return doc.documentElement.outerHTML;
      } catch (error) {
        console.error("HTML translation error:", error);
        throw error;
      } finally {
        this.translator.ui.removeTranslatingStatus();
      }
    }
    getTranslatableHTMLNodes(element) {
      const translatableNodes = [];
      const excludeSelectors = this.getExcludeSelectors();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (excludeSelectors.some((selector) => parent.matches?.(selector))) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      let node;
      while ((node = walker.nextNode())) {
        translatableNodes.push(node);
      }
      const elements = element.getElementsByTagName("*");
      const translatableAttributes = ["title", "alt", "placeholder"];
      for (const el of elements) {
        for (const attr of translatableAttributes) {
          if (el.hasAttribute(attr)) {
            const value = el.getAttribute(attr);
            if (value && value.trim()) {
              const node = document.createTextNode(value);
              node.isAttribute = true;
              node.attributeName = attr;
              node.ownerElement = el;
              translatableNodes.push(node);
            }
          }
        }
      }
      return translatableNodes;
    }
    async loadPDFJS() {
      if (!this.pdfLoaded) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        this.pdfLoaded = true;
      }
    }
    async translatePDF(file) {
      try {
        await this.loadPDFJS();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let translatedContent = [];
        const totalPages = pdf.numPages;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const { translationMode: mode } = this.translator.userSettings.settings.displayOptions;
        const showSource = mode === "language_learning" &&
          this.translator.userSettings.settings.displayOptions.languageLearning.showSource;
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise;
          const imageBlob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png")
          );
          const imageFile = new File([imageBlob], "page.png", {
            type: "image/png",
          });
          try {
            const ocrResult = await this.translator.ocr.processImage(imageFile);
            const processedTranslations = ocrResult.split('\n').map((trans) => {
              switch (mode) {
                case "translation_only":
                  return `${trans.split("<|>")[0]?.trim() || ''}   `;
                case "parallel":
                  return `[GỐC]: ${trans.split("<|>")[0]?.trim() || ''}  [DỊCH]: ${trans.split("<|>")[2]?.trim() || ''}   `;
                case "language_learning":
                  let parts = [];
                  if (showSource) {
                    parts.push(`[GỐC]: ${trans.split("<|>")[0]?.trim() || ''}`);
                  }
                  const pinyin = trans.split("<|>")[1]?.trim();
                  if (pinyin) {
                    parts.push(`[PINYIN]: ${pinyin}`);
                  }
                  const translation = trans.split("<|>")[2]?.trim() || trans;
                  parts.push(`[DỊCH]: ${translation}   `);
                  return parts.join("  ");
                default:
                  return trans;
              }
            });
            translatedContent.push({
              pageNum,
              original: ocrResult,
              translations: processedTranslations,
              displayMode: mode,
              showSource
            });
          } catch (error) {
            console.error(`Error processing page ${pageNum}:`, error);
            translatedContent.push({
              pageNum,
              original: `[Error on page ${pageNum}: ${error.message}]`,
              translations: [{
                original: "",
                translation: `[Translation Error: ${error.message}]`
              }],
              displayMode: mode,
              showSource
            });
          }
          this.translator.ui.updateProgress(
            "Đang xử lý PDF",
            Math.round((pageNum / totalPages) * 100)
          );
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.remove();
        return this.generateEnhancedTranslatedPDF(translatedContent);
      } catch (error) {
        console.error("PDF translation error:", error);
        throw error;
      }
    }
    generateEnhancedTranslatedPDF(translatedContent) {
      const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
        .page {
          margin-bottom: 40px;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          page-break-after: always;
        }
        .page-number {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 20px;
          color: #666;
        }
        .content {
          margin-bottom: 20px;
        }
        .section {
          margin-bottom: 15px;
          padding: 15px;
          background-color: #fff;
          border: 1px solid #eee;
          border-radius: 8px;
          white-space: pre-wrap;
        }
        .section-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
        }
        .section-content {
          white-space: pre-wrap;
          line-height: 1.5;
        }
        h3 {
          color: #333;
          margin: 10px 0;
        }
        @media print {
          .page {
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      ${translatedContent.map(page => `
        <div class="page">
          <div class="page-number">Trang ${page.pageNum}</div>
          <div class="content">
            ${page.displayMode === "translation_only" ? `
              <div class="section">
                <div class="section-title">Bản dịch:</div>
                <div class="section-content">${this.formatTranslationContent(page.translations.join('\n'))}</div>
              </div>
            ` : page.displayMode === "parallel" ? `
              <div class="section">
                <div class="section-content">${this.formatTranslationContent(page.translations.join('\n'))}</div>
              </div>
            ` : `
              ${page.showSource ? `
                <div class="section">
                  <div class="section-title">Bản gốc:</div>
                  <div class="section-content">${this.formatTranslationContent(page.original)}</div>
                </div>
              ` : ''}
              ${page.translations.some(t => t.includes("[PINYIN]:")) ? `
                <div class="section">
                  <div class="section-title">Phiên âm:</div>
                  <div class="section-content">${this.formatTranslationContent(
        page.translations
          .map(t => t.split("[PINYIN]:")[1]?.split("[DỊCH]:")[0]?.trim())
          .filter(Boolean)
          .join('\n')
      )}</div>
                </div>
              ` : ''}
              <div class="section">
                <div class="section-title">Bản dịch:</div>
                <div class="section-content">${this.formatTranslationContent(
        page.translations
          .map(t => t.split("[DỊCH]:")[1]?.trim())
          .filter(Boolean)
          .join('\n')
      )}</div>
              </div>
            `}
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
      return new Blob([htmlContent], { type: "text/html" });
    }
    formatTranslationContent(content) {
      if (!content) return '';
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    }
    groupIntoParagraphs(textItems) {
      let paragraphs = [];
      let currentParagraph = {
        text: "",
        format: {},
        type: "text",
      };
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        const nextItem = textItems[i + 1];
        if (item.fontSize > 20) {
          currentParagraph.type = "heading";
        } else if (item.text.match(/^\d+\./)) {
          currentParagraph.type = "list-item";
        }
        currentParagraph.text += item.text;
        currentParagraph.format = {
          fontSize: item.fontSize,
          fontFamily: item.fontFamily,
          isAnnotation: item.type === "annotation",
        };
        const shouldEndParagraph =
          !nextItem ||
          Math.abs(nextItem.y - item.y) > 1.5 * item.fontSize || // Khoảng cách dọc lớn
          (nextItem.fontSize > 20 && item.fontSize <= 20) || // Chuyển từ text thường sang heading
          item.text.endsWith(".") || // Kết thúc câu
          item.text.endsWith("?") ||
          item.text.endsWith("!");
        if (shouldEndParagraph) {
          if (currentParagraph.text.trim()) {
            paragraphs.push({ ...currentParagraph });
          }
          currentParagraph = {
            text: "",
            format: {},
            type: "text",
          };
        } else {
          currentParagraph.text += " ";
        }
      }
      return paragraphs;
    }
    splitIntoChunks(text, maxLength = 1000) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let currentChunk = "";
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      return chunks;
    }
    updateUI(menuText, buttonText) {
      const toolsContainer = this.$(
        ".translator-tools-container"
      );
      if (toolsContainer) {
        const menuItem = toolsContainer.querySelector(
          '[data-type="pageTranslate"]'
        );
        if (menuItem) {
          const itemText = menuItem.querySelector(".item-text");
          if (itemText) {
            itemText.textContent = menuText;
          }
        }
      }
      const floatingButton = this.$(".page-translate-button");
      if (floatingButton) {
        floatingButton.innerHTML = buttonText;
      }
    }
    async getPageCache(url) {
      const settings = this.translator.userSettings.settings;
      if (!settings.cacheOptions.page.enabled) return null;
      const cacheData = this.pageCache.get(url);
      if (
        cacheData &&
        Date.now() - cacheData.timestamp <
        settings.cacheOptions.page.expirationTime
      ) {
        return cacheData;
      }
      return null;
    }
    async setPageCache(translation, url) {
      const settings = this.translator.userSettings.settings;
      if (!settings.cacheOptions.page.enabled) return;
      if (this.pageCache.size >= settings.cacheOptions.page.maxSize) {
        const oldestKey = this.pageCache.keys().next().value;
        this.pageCache.delete(oldestKey);
      }
      this.pageCache.set(url, { translation, timestamp: Date.now() });
    }
    restoreOriginalText() {
      for (const [node, originalText] of this.originalTexts) {
        node.textContent = originalText;
      }
      this.originalTexts.clear();
    }
    applyTranslation(translation) {
      const lines = translation.split("\n");
      this.collectTextNodes().forEach((node, index) => {
        node.textContent = lines[index] || "";
      });
    }
    collectTextNodes() {
      const excludeSelectors = this.getExcludeSelectors();
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!node.parentNode) {
              return NodeFilter.FILTER_REJECT;
            }
            let parent = node.parentElement;
            while (parent) {
              for (const selector of excludeSelectors) {
                try {
                  if (parent.matches && parent.matches(selector)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                } catch (e) {
                  console.warn(`Invalid selector: ${selector}`, e);
                }
              }
              if (
                parent.getAttribute("translate") === "no" ||
                parent.getAttribute("class")?.includes("notranslate") ||
                parent.getAttribute("class")?.includes("no-translate")
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        nodes.push(node);
      }
      return nodes;
    }
    setupDOMObserver() {
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }
      this.domObserver = new MutationObserver((mutations) => {
        const newTextNodes = [];
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            const nodes = this.getTextNodesFromNodeList(mutation.addedNodes);
            if (nodes.length > 0) {
              newTextNodes.push(...nodes);
            }
          }
        }
        if (newTextNodes.length > 0) {
          const chunks = this.createChunks(newTextNodes);
          Promise.all(
            chunks.map((chunk) =>
              this.translateChunkParallel(chunk).catch((error) => {
                console.error("Translation error for chunk:", error);
              })
            )
          );
        }
      });
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    getTextNodesFromNodeList(nodeList) {
      const excludeSelectors = this.getExcludeSelectors();
      const textNodes = [];
      const shouldExclude = (node) => {
        if (!node) return true;
        let current = node;
        while (current) {
          if (
            current.getAttribute &&
            (current.getAttribute("translate") === "no" ||
              current.getAttribute("data-notranslate") ||
              current.classList?.contains("notranslate") ||
              current.classList?.contains("no-translate"))
          ) {
            return true;
          }
          for (const selector of excludeSelectors) {
            try {
              if (current.matches && current.matches(selector)) {
                return true;
              }
            } catch (e) {
              console.warn(`Invalid selector: ${selector}`, e);
            }
          }
          current = current.parentElement;
        }
        return false;
      };
      nodeList.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.trim() && !shouldExclude(node.parentElement)) {
            textNodes.push(node);
          }
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          !shouldExclude(node)
        ) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: (textNode) => {
              if (
                textNode.textContent.trim() &&
                !shouldExclude(textNode.parentElement)
              ) {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_REJECT;
            },
          });
          let textNode;
          while ((textNode = walker.nextNode())) {
            textNodes.push(textNode);
          }
        }
      });
      return textNodes;
    }
    async translateChunkParallel(chunk) {
      try {
        const textsToTranslate = chunk
          .map((node) => node.textContent.trim())
          .filter((text) => text.length > 0)
          .join("\n");
        if (!textsToTranslate) return;
        const prompt = this.translator.createPrompt(textsToTranslate, "page");
        const translatedText = await this.translator.api.request(prompt, 'page');
        if (translatedText) {
          const translations = translatedText.split("\n");
          let translationIndex = 0;
          await Promise.all(chunk.map(async (node, _index) => {
            const text = node.textContent.trim();
            if (text.length > 0 && node.parentNode && document.contains(node)) {
              try {
                this.originalTexts.set(node, node.textContent);
                if (translationIndex < translations.length) {
                  const translated = translations[translationIndex++];
                  const mode = this.translator.userSettings.settings.displayOptions.translationMode;
                  let output = this.formatTranslation(text, translated, mode, this.translator.userSettings.settings.displayOptions);
                  node.textContent = output;
                }
              } catch (error) {
                console.error("DOM update error:", error);
              }
            }
          }));
        }
      } catch (error) {
        console.error("Chunk translation error:", error);
        throw error;
      }
    }
    formatTranslation(originalText, translatedText, mode, settings) {
      const showSource = settings.languageLearning.showSource;
      switch (mode) {
        case "translation_only":
          return translatedText;
        case "parallel":
          return `[GỐC]: ${originalText}  [DỊCH]: ${translatedText.split("<|>")[2]?.trim() || translatedText}   `;
        case "language_learning":
          let parts = [];
          if (showSource) {
            parts.push(`[GỐC]: ${originalText}`);
          }
          const pinyin = translatedText.split("<|>")[1]?.trim();
          if (pinyin) {
            parts.push(`[PINYIN]: ${pinyin}`);
          }
          const translation =
            translatedText.split("<|>")[2]?.trim() || translatedText;
          parts.push(`[DỊCH]: ${translation}   `);
          return parts.join("  ");
        default:
          return translatedText;
      }
    }
  }
  class FileCache {
    constructor(maxSize, expirationTime) {
      this.maxSize = maxSize;
      this.expirationTime = expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
    }
    async generateKey(fileData) {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(fileData)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    async set(fileData, result) {
      const key = await this.generateKey(fileData);
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
        this.accessOrder.push(key);
      }
      const compressedData = LZString.compressToUTF16(JSON.stringify({
        result,
        timestamp: Date.now()
      }));
      this.cache.set(key, compressedData);
    }
    async get(fileData) {
      const key = await this.generateKey(fileData);
      const compressedData = this.cache.get(key);
      if (!compressedData) return null;
      const data = JSON.parse(LZString.decompressFromUTF16(compressedData));
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return data.result;
    }
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }
  }
  class TranslationCache {
    constructor(maxSize, expirationTime) {
      this.maxSize = maxSize;
      this.expirationTime = expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
    }
    generateKey(text, isAdvanced, targetLanguage) {
      return `${text}_${isAdvanced}_${targetLanguage}`;
    }
    set(text, translation, isAdvanced, targetLanguage) {
      const key = this.generateKey(text, isAdvanced, targetLanguage);
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
        this.accessOrder.push(key);
      }
      const compressedData = LZString.compressToUTF16(JSON.stringify({
        translation,
        timestamp: Date.now()
      }));
      this.cache.set(key, compressedData);
      this.saveToIndexedDB(key, compressedData);
    }
    get(text, isAdvanced, targetLanguage) {
      const key = this.generateKey(text, isAdvanced, targetLanguage);
      const compressedData = this.cache.get(key);
      if (!compressedData) return null;
      const data = JSON.parse(LZString.decompressFromUTF16(compressedData));
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        this.accessOrder.splice(index, 1);
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return data.translation;
    }
    async saveToIndexedDB(key, value) {
      try {
        const db = await this.initDB();
        const tx = db.transaction('translations', 'readwrite');
        const store = tx.objectStore('translations');
        await store.put({
          key: key,
          value: value,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error saving to IndexedDB:', error);
      }
    }
    async loadFromIndexedDB() {
      try {
        const db = await this.initDB();
        const tx = db.transaction('translations', 'readonly');
        const store = tx.objectStore('translations');
        const items = await store.getAll();
        items.forEach(item => {
          if (Date.now() - item.timestamp <= this.expirationTime) {
            this.cache.set(item.key, item.value);
            this.accessOrder.push(item.key);
          }
        });
      } catch (error) {
        console.error('Error loading from IndexedDB:', error);
      }
    }
    clear() {
      this.cache.clear();
      this.accessOrder = [];
    }
    optimizeStorage() {
      if (this.cache.size > this.maxSize * 0.9) {
        const itemsToKeep = Math.floor(this.maxSize * 0.7);
        const sortedItems = [...this.accessOrder].slice(-itemsToKeep);
        const tempCache = new Map();
        sortedItems.forEach((key) => {
          if (this.cache.has(key)) {
            tempCache.set(key, this.cache.get(key));
          }
        });
        this.cache = tempCache;
        this.accessOrder = sortedItems;
      }
    }
    async initDB() {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported");
        return;
      }
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("translatorCache", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("translations")) {
            db.createObjectStore("translations", { keyPath: "id" });
          }
        };
      });
    }
    async saveToIndexedDB(key, value) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["translations"], "readwrite");
        const store = transaction.objectStore("translations");
        const request = store.put({ id: key, value, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    async loadFromIndexedDB(key) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["translations"], "readonly");
        const store = transaction.objectStore("translations");
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value);
        request.onerror = () => reject(request.error);
      });
    }
  }
  const RELIABLE_FORMATS = {
    text: {
      maxSize: 10 * 1024 * 1024, // 10MB
      formats: [
        { ext: 'txt', mime: 'text/plain' }, // Văn bản thuần
        { ext: 'srt', mime: 'application/x-subrip' }, // Phụ đề
        { ext: 'vtt', mime: 'text/vtt' }, // Phụ đề web
        { ext: 'html', mime: 'text/html' }, // HTML
        { ext: 'md', mime: 'text/markdown' }, // Markdown
        { ext: 'json', mime: 'application/json' }, // JSON
      ]
    }
  };
  class FileManager {
    constructor(translator) {
      this.translator = translator;
      this.supportedFormats = RELIABLE_FORMATS;
    }
    isValidFormat(file) {
      const extension = file.name.split('.').pop().toLowerCase();
      const mimeType = file.type;
      return RELIABLE_FORMATS.text.formats.some(format =>
        format.ext === extension || format.mime === mimeType
      );
    }
    isValidSize(file) {
      return file.size <= RELIABLE_FORMATS.text.maxSize;
    }
    async processFile(file) {
      try {
        const content = await this.readFileContent(file);
        const extension = file.name.split('.').pop().toLowerCase();
        switch (extension) {
          case 'txt':
          case 'md':
            return await this.translator.translate(content);
          case 'json':
            return await this.processJSON(content);
          case 'html':
            return await this.translator.page.translateHTML(content);
          case 'srt':
          case 'vtt':
            return await this.processSubtitle(content);
          default:
            throw new Error('Định dạng không được hỗ trợ');
        }
      } catch (error) {
        throw new Error(`Lỗi xử lý file: ${error.message}`);
      }
    }
    async processJSON(content) {
      try {
        const json = JSON.parse(content);
        const translated = await this.translateObject(json);
        return JSON.stringify(translated, null, 2);
      } catch (error) {
        throw new Error('Lỗi xử lý JSON');
      }
    }
    async processSubtitle(content) {
      try {
        const parts = content.split('\n\n');
        const translated = [];
        for (const part of parts) {
          const lines = part.split('\n');
          if (lines.length >= 3) {
            const [index, timing, ...text] = lines;
            const translatedText = await this.translator.translate(text.join(' '));
            translated.push([index, timing, translatedText].join('\n'));
          }
        }
        return translated.join('\n\n');
      } catch (error) {
        throw new Error('Lỗi xử lý phụ đề');
      }
    }
    async translateObject(obj) {
      const translated = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          translated[key] = await this.translator.translate(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          translated[key] = await this.translateObject(obj[key]);
        } else {
          translated[key] = obj[key];
        }
      }
      return translated;
    }
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không thể đọc file'));
        reader.readAsText(file);
      });
    }
  }
  class UIManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required");
      }
      this.translator = translator;
      this.isTranslating = false;
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
      if (localStorage.getItem("translatorToolsEnabled") === null) {
        localStorage.setItem("translatorToolsEnabled", "true");
      }
      const themeMode = this.translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      this.container = document.createElement('div');
      this.container.id = 'king-translator-root';
      this.container.style.cssText = `z-index: 2147483647;`;
      this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
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
    font-family: Arial, sans-serif;
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
    flex: 1;
    display: flex;
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
    margin: 5px 53% 5px 47%;
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
  .translator-settings-container .api-key-entry input[type="text"].gemini-key,
  .translator-settings-container .api-key-entry input[type="text"].openai-key {
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
    font-family: Arial, sans-serif;
    text-align: left;
    vertical-align: middle;
    background-color: ${isDark ? "#202020" : "#eeeeee"};
    color: ${theme.text};
  }
  .translator-settings-container .api-key-entry input[type="text"].gemini-key:focus,
  .translator-settings-container .api-key-entry input[type="text"].openai-key:focus {
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
    right: 25px;
    color: ${theme.text};
    border-radius: 10px;
    z-index: 2147483647;
    display: block;
    visibility: visible;
    opacity: 1;
  }
  .translator-tools-container * {
    font-family: Arial, sans-serif;
    box-sizing: border-box;
  }
  .translator-tools-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 9px;
    background-color: rgba(74,144,226,0.4);
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
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 15px 12px 9px 12px;
    min-width: 205px;
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
    font-family: Arial, sans-serif;
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
  .translation-div p {
    margin: 5px 0;
  }
  .translation-div strong {
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
    font-family: Arial, sans-serif;
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
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
  .tts-button {
    position: absolute;
    right: 10px;
    bottom: 10px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
    z-index: 2147483647;
  }
  .tts-button:hover {
    transform: scale(1.1);
  }
  /* Styles cho web image OCR */
  .translator-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.3);
    z-index: 2147483647;
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
      this.mobileOptimizer = new MobileOptimizer(this);
      this.ocr = new OCRManager(translator);
      this.media = new MediaManager(translator);
      this.page = new PageTranslator(translator);
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
      this.translationButtonEnabled = true;
      this.translationTapEnabled = true;
      this.mediaElement = null;
      this.setupEventListeners();
      if (document.readyState === "complete") {
        if (
          this.translator.userSettings.settings.pageTranslation.autoTranslate
        ) {
          this.page.checkAndTranslate();
        }
        if (
          this.translator.userSettings.settings.pageTranslation
            .showInitialButton
        ) {
          this.setupQuickTranslateButton();
        }
      } else {
        window.addEventListener("load", () => {
          if (
            this.translator.userSettings.settings.pageTranslation.autoTranslate
          ) {
            this.page.checkAndTranslate();
          }
          if (
            this.translator.userSettings.settings.pageTranslation
              .showInitialButton
          ) {
            this.setupQuickTranslateButton();
          }
        });
      }
      document.addEventListener("DOMContentLoaded", () => {
        const isEnabled =
          localStorage.getItem("translatorToolsEnabled") === "true";
        if (isEnabled) {
          this.setupTranslatorTools();
        }
      });
      setTimeout(() => {
        if (!this.$(".translator-tools-container")) {
          const isEnabled =
            localStorage.getItem("translatorToolsEnabled") === "true";
          if (isEnabled) {
            this.setupTranslatorTools();
          }
        }
      }, 1000);
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
    createCloseButton() {
      const button = document.createElement("span");
      button.textContent = "x";
      Object.assign(button.style, {
        position: "absolute",
        top: "0px" /* Đẩy lên trên một chút */,
        right: "0px" /* Đẩy sang phải một chút */,
        cursor: "pointer",
        color: "black",
        fontSize: "14px",
        fontWeight: "bold",
        padding: "4px 8px" /* Tăng kích thước */,
        lineHeight: "14px",
      });
      button.onclick = () => button.parentElement.remove();
      return button;
    }
    showTranslationBelow(translatedText, targetElement, text) {
      if (
        targetElement.nextElementSibling?.classList.contains(
          "translation-div"
        )
      ) {
        return;
      }
      const settings = this.translator.userSettings.settings.displayOptions;
      const mode = settings.translationMode;
      const showSource = settings.languageLearning.showSource;
      let formattedTranslation = "";
      if (mode === "translation_only") {
        formattedTranslation = translatedText;
      } else if (mode === "parallel") {
        formattedTranslation = `<div style="margin-bottom: 8px">Gốc: ${text}</div>
<div>Dịch: ${translatedText.split("<|>")[2] || translatedText}</div>`;
      } else if (mode === "language_learning") {
        let sourceHTML = "";
        if (showSource) {
          sourceHTML = `<div style="margin-bottom: 8px">[Gốc]: ${text}</div>`;
        }
        formattedTranslation = `${sourceHTML}
<div>[Pinyin]: ${translatedText.split("<|>")[1] || ""}</div>
<div>[Dịch]: ${translatedText.split("<|>")[2] || translatedText}</div>`;
      }
      const translationDiv = document.createElement("div");
      translationDiv.classList.add("translation-div");
      Object.assign(translationDiv.style, {
        ...CONFIG.STYLES.translation,
        fontSize: settings.fontSize,
      });
      translationDiv.innerHTML = formattedTranslation;
      const themeMode = this.translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      translationDiv.appendChild(this.createCloseButton());
      targetElement.insertAdjacentElement('afterend', translationDiv);
      translationDiv.style.cssText = `
        display: block; /* Giữ cho phần dịch không bị kéo dài hết chiều ngang */
        max-width: fit-content; /* Giới hạn chiều rộng */
        width: auto; /* Để nó co giãn theo nội dung */
        min-width: 150px;
        color: ${theme.text};
        background-color: ${theme.background};
        padding: 10px 20px 10px 10px;
        margin-top: 10px;
        border-radius: 8px;
        position: relative;
        z-index: 2147483647;
        border: 1px solid ${theme.border};
        white-space: normal; /* Cho phép xuống dòng nếu quá dài */
        overflow-wrap: break-word; /* Ngắt từ nếu quá dài */
      `;
    }
    displayPopup(
      translatedText,
      originalText,
      title = "Bản dịch",
      pinyin = ""
    ) {
      this.removeTranslateButton();
      const settings = this.translator.userSettings.settings;
      const themeMode = settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      const displayOptions = settings.displayOptions;
      const popup = document.createElement("div");
      popup.classList.add("draggable");
      const popupStyle = {
        ...CONFIG.STYLES.popup,
        backgroundColor: theme.background,
        borderColor: theme.border,
        color: theme.text,
        minWidth: displayOptions.minPopupWidth,
        maxWidth: displayOptions.maxPopupWidth,
        fontSize: displayOptions.fontSize,
        padding: "0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      };
      Object.assign(popup.style, popupStyle);
      const dragHandle = document.createElement("div");
      Object.assign(dragHandle.style, {
        ...CONFIG.STYLES.dragHandle,
        backgroundColor: "#2c3e50",
        borderColor: "transparent",
        color: "#ffffff",
        padding: "12px 15px",
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "15px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      });
      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      Object.assign(titleSpan.style, {
        fontWeight: "bold",
        color: "#ffffff",
        fontSize: "15px",
      });
      const closeButton = document.createElement("span");
      closeButton.innerHTML = "×";
      Object.assign(closeButton.style, {
        cursor: "pointer",
        fontSize: "22px",
        color: "#ffffff",
        padding: "0 10px",
        opacity: "0.8",
        transition: "all 0.2s ease",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "30px",
        height: "30px",
        borderRadius: "50%",
      });
      closeButton.onmouseover = () => {
        Object.assign(closeButton.style, {
          opacity: "1",
          backgroundColor: "#ff4444",
        });
      };
      closeButton.onmouseout = () => {
        Object.assign(closeButton.style, {
          opacity: "0.8",
          backgroundColor: "transparent",
        });
      };
      closeButton.onclick = () => {
        speechSynthesis.cancel();
        popup.remove();
      };
      dragHandle.appendChild(titleSpan);
      dragHandle.appendChild(closeButton);
      const contentContainer = document.createElement("div");
      Object.assign(contentContainer.style, {
        padding: "15px 20px",
        maxHeight: "70vh",
        overflowY: "auto",
        overflowX: "hidden",
      });
      const scrollbarStyle = document.createElement("style");
      scrollbarStyle.textContent = `
    .translator-content::-webkit-scrollbar {
      width: 8px;
    }
    .translator-content::-webkit-scrollbar-track {
      background-color: ${isDark ? "#202020" : "#eeeeee"};
      border-radius: 8px;
    }
    .translator-content::-webkit-scrollbar-thumb {
      background-color: ${isDark ? "#666" : "#888"};
      border-radius: 8px;
    }
    .translator-content::-webkit-scrollbar-thumb:hover {
      background-color: ${isDark ? "#888" : "#555"};
    }
  `;
      this.shadowRoot.appendChild(scrollbarStyle);
      contentContainer.classList.add("translator-content");
      const cleanedText = translatedText.replace(/(\*\*)(.*?)\1/g, `<b style="color: ${theme.text};">$2</b>`);
      const textContainer = document.createElement("div");
      Object.assign(textContainer.style, {
        display: "flex",
        flexDirection: "column",
        zIndex: "2147483647",
        gap: "15px"
      });
      const createTTSButton = (text, lang) => {
        const button = document.createElement("button");
        let isPlaying = false;
        const updateButtonState = () => {
          button.innerHTML = isPlaying ? "🔈" : "🔊";
          button.title = isPlaying ? "Dừng đọc" : "Đọc văn bản";
        };
        Object.assign(button.style, {
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
          marginLeft: '5px'
        });
        button.onmouseover = () => {
          button.style.transform = 'scale(1.1)';
        };
        button.onmouseout = () => {
          button.style.transform = 'scale(1)';
        };
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.onend = () => {
          isPlaying = false;
          updateButtonState();
        };
        utterance.oncancel = () => {
          isPlaying = false;
          updateButtonState();
        };
        button.onclick = () => {
          if (isPlaying) {
            speechSynthesis.cancel();
            isPlaying = false;
          } else {
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
            isPlaying = true;
          }
          updateButtonState();
        };
        updateButtonState();
        return button;
      };
      if (
        (displayOptions.translationMode == "parallel" || (displayOptions.translationMode == "language_learning" && displayOptions.languageLearning.showSource === true)) && originalText
      ) {
        const originalContainer = document.createElement("div");
        Object.assign(originalContainer.style, {
          color: theme.text,
          padding: "10px 15px",
          backgroundColor: `${theme.backgroundShadow}`,
          borderRadius: "8px",
          border: `1px solid ${theme.border}`,
          wordBreak: "break-word",
          zIndex: "2147483647",
        });
        const originalHeader = document.createElement("div");
        originalHeader.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 5px;
  `;
        const originalTitle = document.createElement("div");
        originalTitle.style.cssText = `
    font-weight: 500;
    color: ${theme.title};
  `;
        originalTitle.textContent = "Bản gốc:";
        originalHeader.appendChild(originalTitle);
        originalHeader.appendChild(createTTSButton(originalText, settings.displayOptions.sourceLanguage));
        const originalContent = document.createElement("div");
        originalContent.style.cssText = `
    line-height: 1.5;
    color: ${theme.text};
    margin-left: 20px;
  `;
        originalContent.textContent = originalText;
        originalContainer.appendChild(originalHeader);
        originalContainer.appendChild(originalContent);
        textContainer.appendChild(originalContainer);
      }
      if (
        displayOptions.translationMode == "language_learning" &&
        pinyin
      ) {
        const pinyinContainer = document.createElement("div");
        Object.assign(pinyinContainer.style, {
          color: theme.text,
          padding: "10px 15px",
          backgroundColor: `${theme.backgroundShadow}`,
          borderRadius: "8px",
          border: `1px solid ${theme.border}`,
          wordBreak: "break-word",
          zIndex: "2147483647",
        });
        const pinyinHeader = document.createElement("div");
        pinyinHeader.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 5px;
  `;
        const pinyinTitle = document.createElement("div");
        pinyinTitle.style.cssText = `
    font-weight: 500;
    color: ${theme.title};
  `;
        pinyinTitle.textContent = "Pinyin:";
        pinyinHeader.appendChild(pinyinTitle);
        pinyinHeader.appendChild(createTTSButton(pinyin, settings.displayOptions.sourceLanguage));
        const pinyinContent = document.createElement("div");
        pinyinContent.style.cssText = `
    line-height: 1.5;
    color: ${theme.text};
    margin-left: 20px;
  `;
        pinyinContent.textContent = pinyin;
        pinyinContainer.appendChild(pinyinHeader);
        pinyinContainer.appendChild(pinyinContent);
        textContainer.appendChild(pinyinContainer);
      }
      const translationContainer = document.createElement("div");
      Object.assign(translationContainer.style, {
        color: theme.text,
        padding: "10px 15px",
        backgroundColor: `${theme.backgroundShadow}`,
        borderRadius: "8px",
        border: `1px solid ${theme.border}`,
        wordBreak: "break-word",
        zIndex: "2147483647",
      });
      const translationHeader = document.createElement("div");
      translationHeader.style.cssText = `
  display: flex;
  align-items: center;
  margin-bottom: 5px;
`;
      const translationTitle = document.createElement("div");
      translationTitle.style.cssText = `
  font-weight: 500;
  color: ${theme.title};
`;
      translationTitle.textContent = "Bản dịch:";
      translationHeader.appendChild(translationTitle);
      translationHeader.appendChild(createTTSButton(
        translatedText.split("<|>")[2]?.trim() || translatedText,
        settings.displayOptions.targetLanguage
      ));
      const translationContent = document.createElement("div");
      translationContent.style.cssText = `
  line-height: 1.5;
  color: ${theme.text};
  margin-left: 20px;
`;
      translationContent.innerHTML = this.formatTranslation(cleanedText, theme);
      translationContainer.appendChild(translationHeader);
      translationContainer.appendChild(translationContent);
      textContainer.appendChild(translationContainer);
      contentContainer.appendChild(textContainer);
      popup.appendChild(dragHandle);
      popup.appendChild(contentContainer);
      this.makeDraggable(popup, dragHandle);
      this.shadowRoot.appendChild(popup);
      this.handleClickOutside = (e) => {
        if (!popup.contains(e.target)) {
          document.removeEventListener("click", this.handleClickOutside);
          speechSynthesis.cancel();
          popup.remove();
        }
      };
      popup.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      document.addEventListener("click", this.handleClickOutside);
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", handleEscape);
          speechSynthesis.cancel();
          popup.remove();
        }
      };
      document.addEventListener("keydown", handleEscape);
    }
    makeDraggable(element, handle) {
      let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
      handle.onmousedown = dragMouseDown;
      function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }
      function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = element.offsetTop - pos2 + "px";
        element.style.left = element.offsetLeft - pos1 + "px";
      }
      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    }
    formatTranslation(text, theme) {
      return text
        .split("<br>")
        .map((line) => {
          if (line.startsWith(`<b style="color: ${theme.text};">KEYWORD</b>:`)) {
            return `<h4 style="margin-bottom: 5px; color: ${theme.text};">${line}</h4>`;
          }
          return `<p style="margin-bottom: 10px; white-space: pre-wrap; word-wrap: break-word; text-align: justify; color: ${theme.text};">${line}</p>`;
        })
        .join("");
    }
    setupSelectionHandlers() {
      if (this.isTranslating) return;
      if (this.ignoreNextSelectionChange || this.isTranslating) {
        this.ignoreNextSelectionChange = false;
        return;
      }
      if (!this.translationButtonEnabled) return;
      document.addEventListener('mousedown', (e) => {
        if (!e.target.classList.contains('translator-button')) {
          this.isSelecting = true;
          this.removeTranslateButton();
        }
      });
      document.addEventListener('mousemove', (e) => {
        if (this.isSelecting) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText) {
            this.removeTranslateButton();
            this.debouncedCreateButton(selection, e.clientX, e.clientY);
          }
        }
      });
      document.addEventListener('mouseup', (e) => {
        if (!e.target.classList.contains('translator-button')) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText) {
            this.removeTranslateButton();
            this.createTranslateButton(selection, e.clientX, e.clientY);
          }
        }
        this.isSelecting = false;
      });
      document.addEventListener('touchend', (e) => {
        if (!e.target.classList.contains('translator-button')) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText && e.changedTouches?.[0]) {
            const touch = e.changedTouches[0];
            this.createTranslateButton(selection, touch.clientX, touch.clientY);
          }
        }
      });
    }
    createTranslateButton(selection, x, y) {
      this.removeTranslateButton();
      const button = document.createElement('button');
      button.className = 'translator-button';
      button.textContent = 'Dịch';
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonWidth = 60;
      const buttonHeight = 30;
      const padding = 10;
      let left = Math.min(x + padding, viewportWidth - buttonWidth - padding);
      let top = Math.min(y + 30, viewportHeight - buttonHeight - 30);
      left = Math.max(padding, left);
      top = Math.max(30, top);
      const themeMode = this.translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      Object.assign(button.style, {
        ...CONFIG.STYLES.button,
        backgroundColor: theme.button.translate.background,
        color: theme.button.translate.text,
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: '2147483647',
        userSelect: 'none'
      });
      this.shadowRoot.appendChild(button);
      this.currentTranslateButton = button;
      this.setupClickHandlers(selection);
    }
    handleTranslateButtonClick = async (selection, translateType) => {
      try {
        const selectedText = selection.toString().trim();
        if (!selectedText) {
          console.log("No text selected");
          return;
        }
        const targetElement = selection.anchorNode?.parentElement;
        if (!targetElement) {
          console.log("No target element found");
          return;
        }
        this.removeTranslateButton();
        this.showTranslatingStatus();
        console.log("Starting translation with type:", translateType);
        if (!this.translator) {
          throw new Error("Translator instance not found");
        }
        switch (translateType) {
          case "quick":
            await this.translator.translate(selectedText, targetElement);
            break;
          case "popup":
            await this.translator.translate(
              selectedText,
              targetElement,
              false,
              true
            );
            break;
          case "advanced":
            await this.translator.translate(selectedText, targetElement, true);
            break;
          default:
            console.log("Unknown translation type:", translateType);
        }
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        if (this.isDouble) {
          const newSelection = window.getSelection();
          if (newSelection.toString().trim()) {
            this.resetState();
            this.setupSelectionHandlers();
          }
        } else {
          this.resetState();
          return;
        }
      }
    };
    debug(message) {
      console.log(`[UIManager] ${message}`);
    }
    showTranslatingStatus() {
      this.debug("Showing translating status");
      if (!this.shadowRoot.getElementById("translator-animation-style")) {
        const style = document.createElement("style");
        style.id = "translator-animation-style";
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
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
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #ddd;
            animation: spin 1s ease-in-out infinite;
          }
        `;
        this.shadowRoot.appendChild(style);
      }
      this.removeTranslatingStatus();
      const status = document.createElement("div");
      status.className = "center-translate-status";
      status.innerHTML = `
      <div class="spinner" style="color: white"></div>
      <span style="color: white">Đang dịch...</span>
    `;
      this.shadowRoot.appendChild(status);
      this.translatingStatus = status;
      this.debug("Translation status shown");
    }
    setupClickHandlers(selection) {
      this.pressTimer = null;
      this.isLongPress = false;
      this.isDown = false;
      this.isDouble = false;
      this.lastTime = 0;
      this.count = 0;
      this.timer = 0;
      const handleStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ignoreNextSelectionChange = true;
        this.isDown = true;
        this.isLongPress = false;
        const currentTime = Date.now();
        if (currentTime - this.lastTime < 400) {
          this.count++;
          clearTimeout(this.pressTimer);
          clearTimeout(this.timer);
        } else {
          this.count = 1;
        }
        this.lastTime = currentTime;
        this.pressTimer = setTimeout(() => {
          if (!this.isDown) return;
          this.isLongPress = true;
          this.count = 0;
          const holdType =
            this.translator.userSettings.settings.clickOptions.hold
              .translateType;
          this.handleTranslateButtonClick(selection, holdType);
        }, 500);
      };
      const handleEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isDown) return;
        clearTimeout(this.pressTimer);
        if (this.isLongPress) return;
        if (this.count === 1) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            if (this.count !== 1) return;
            const singleClickType =
              this.translator.userSettings.settings.clickOptions.singleClick
                .translateType;
            this.handleTranslateButtonClick(selection, singleClickType);
          }, 400);
        } else if (this.count >= 2) {
          this.isDouble = true;
          const doubleClickType =
            this.translator.userSettings.settings.clickOptions.doubleClick
              .translateType;
          this.handleTranslateButtonClick(selection, doubleClickType);
        }
        this.isDown = false;
      };
      this.currentTranslateButton.addEventListener("mousedown", handleStart);
      this.currentTranslateButton.addEventListener("mouseup", handleEnd);
      this.currentTranslateButton.addEventListener("mouseleave", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
      this.currentTranslateButton.addEventListener("touchstart", handleStart);
      this.currentTranslateButton.addEventListener("touchend", handleEnd);
      this.currentTranslateButton.addEventListener("touchcancel", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
    }
    setupDocumentTapHandler() {
      let touchCount = 0;
      let touchTimer = null;
      let isProcessingTouch = false;
      const handleTouchStart = async (e) => {
        if (this.isTranslating) return;
        const touchOptions = this.translator.userSettings.settings.touchOptions;
        if (!touchOptions?.enabled) return;
        const target = e.target;
        if (
          target.closest(".translation-div") ||
          target.closest(".draggable")
        ) {
          return;
        }
        if (touchTimer) {
          clearTimeout(touchTimer);
        }
        touchCount = e.touches.length;
        touchTimer = setTimeout(async () => {
          if (isProcessingTouch) return;
          switch (touchCount) {
            case 2:
              const twoFingersType = touchOptions.twoFingers?.translateType;
              if (twoFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    twoFingersType
                  );
                }
              }
              break;
            case 3:
              const threeFingersType = touchOptions.threeFingers?.translateType;
              if (threeFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    threeFingersType
                  );
                }
              }
              break;
            case 4:
              e.preventDefault();
              const settingsUI =
                this.translator.userSettings.createSettingsUI();
              this.shadowRoot.appendChild(settingsUI);
              break;
            case 5:
              e.preventDefault();
              isProcessingTouch = true;
              this.toggleTranslatorTools();
              setTimeout(() => {
                isProcessingTouch = false;
              }, 350);
              break;
          }
          touchCount = 0;
          touchTimer = null;
        }, touchOptions.sensitivity || 100);
      };
      const handleTouch = () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        touchCount = 0;
      };
      document.addEventListener("touchstart", handleTouchStart.bind(this), {
        passive: false,
      });
      document.addEventListener("touchend", handleTouch.bind(this));
      document.addEventListener("touchcancel", handleTouch.bind(this));
    }
    toggleTranslatorTools() {
      if (this.isTogglingTools) return;
      this.isTogglingTools = true;
      try {
        const currentState =
          localStorage.getItem("translatorToolsEnabled") === "true";
        const newState = !currentState;
        localStorage.setItem("translatorToolsEnabled", newState.toString());
        const settings = this.translator.userSettings.settings;
        settings.showTranslatorTools.enabled = newState;
        this.translator.userSettings.saveSettings();
        this.removeToolsContainer();
        this.resetState();
        const overlays = this.$$(".translator-overlay");
        overlays.forEach((overlay) => overlay.remove());
        if (newState) {
          this.setupTranslatorTools();
        }
        this.showNotification(
          newState ? "Đã bật Translator Tools" : "Đã tắt Translator Tools"
        );
      } finally {
        setTimeout(() => {
          this.isTogglingTools = false;
        }, 350);
      }
    }
    removeToolsContainer() {
      const container = this.$('.translator-tools-container');
      if (container) {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
          input.removeEventListener('change', this.handleOCRInput);
          input.removeEventListener('change', this.handleMediaInput);
        });
        container.remove();
      }
    }
    async handlePageTranslation() {
      const settings = this.translator.userSettings.settings;
      if (!settings.pageTranslation?.enabled && !settings.shortcuts?.enabled) {
        this.showNotification("Tính năng dịch trang đang bị tắt", "warning");
        return;
      }
      try {
        this.showTranslatingStatus();
        const result = await this.page.translatePage();
        if (result.success) {
          const toolsContainer = this.$(
            ".translator-tools-container"
          );
          if (toolsContainer) {
            const menuItem = toolsContainer.querySelector(
              '[data-type="pageTranslate"]'
            );
            if (menuItem) {
              const itemText = menuItem.querySelector(".item-text");
              if (itemText) {
                itemText.textContent = this.page.isTranslated
                  ? "Bản gốc"
                  : "Dịch trang";
              }
            }
          }
          const floatingButton = this.$(
            ".page-translate-button"
          );
          if (floatingButton) {
            floatingButton.innerHTML = this.page.isTranslated
              ? "📄 Bản gốc"
              : "📄 Dịch trang";
          }
          this.showNotification(result.message, "success");
        } else {
          this.showNotification(result.message, "warning");
        }
      } catch (error) {
        console.error("Page translation error:", error);
        this.showNotification(error.message, "error");
      } finally {
        this.removeTranslatingStatus();
      }
    }
    setupQuickTranslateButton() {
      const settings = this.translator.userSettings.settings;
      if (!settings.pageTranslation?.enabled && !settings.shortcuts?.enabled) {
        this.showNotification("Tính năng dịch trang đang bị tắt", "warning");
        return;
      }
      const style = document.createElement("style");
      style.textContent = `
    .page-translate-button {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 2147483647;
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    }
    .page-translate-button:hover {
        background-color: #45a049;
        transform: translateY(-2px);
    }
  `;
      this.shadowRoot.appendChild(style);
      const button = document.createElement("button");
      button.className = "page-translate-button";
      button.innerHTML = this.page.isTranslated
        ? "📄 Bản gốc"
        : "📄 Dịch trang";
      button.onclick = async () => {
        try {
          this.showTranslatingStatus();
          const result = await this.page.translatePage();
          if (result.success) {
            button.innerHTML = this.page.isTranslated
              ? "📄 Bản gốc"
              : "📄 Dịch trang";
            const toolsContainer = this.$(
              ".translator-tools-container"
            );
            if (toolsContainer) {
              const menuItem = toolsContainer.querySelector(
                '[data-type="pageTranslate"]'
              );
              if (menuItem && menuItem.querySelector(".item-text")) {
                menuItem.querySelector(".item-text").textContent = this.page
                  .isTranslated
                  ? "Bản gốc"
                  : "Dịch trang";
              }
            }
            this.showNotification(result.message, "success");
          } else {
            this.showNotification(result.message, "warning");
          }
        } catch (error) {
          console.error("Page translation error:", error);
          this.showNotification(error.message, "error");
        } finally {
          this.removeTranslatingStatus();
        }
      };
      this.shadowRoot.appendChild(button);
      setTimeout(() => {
        if (button && button.parentNode) {
          button.parentNode.removeChild(button);
        }
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 10000);
    }
    setupTranslatorTools() {
      const isEnabled =
        localStorage.getItem("translatorToolsEnabled") === "true";
      if (!isEnabled) return;
      if (this.$(".translator-tools-container")) {
        return;
      }
      this.removeToolsContainer();
      // bypassCSP();
      const observer = new MutationObserver(() => {
        const container = this.$(".translator-tools-container");
        if (
          !container ||
          container.style.display === "none" ||
          container.style.visibility === "hidden"
        ) {
          this.createToolsContainer();
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      this.createToolsContainer();
    }
    createToolsContainer() {
      this.removeToolsContainer();
      const container = document.createElement("div");
      container.className = "translator-tools-container";
      container.setAttribute("data-permanent", "true");
      container.setAttribute("data-translator-tool", "true");
      this.handleOCRInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          const result = await this.ocr.processImage(file);
          this.displayPopup(result, null, "OCR Result");
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          e.target.value = "";
          this.removeTranslatingStatus();
        }
      };
      this.handleMediaInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          await this.media.processMediaFile(file);
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          e.target.value = "";
          this.removeTranslatingStatus();
        }
      };
      const ocrInput = document.createElement("input");
      ocrInput.type = "file";
      ocrInput.accept = "image/*";
      ocrInput.style.display = "none";
      ocrInput.id = "translator-ocr-input";
      ocrInput.addEventListener("change", this.handleOCRInput);
      const mediaInput = document.createElement("input");
      mediaInput.type = "file";
      mediaInput.accept = "audio/*, video/*";
      mediaInput.style.display = "none";
      mediaInput.id = "translator-media-input";
      mediaInput.addEventListener("change", this.handleMediaInput);
      const mainButton = document.createElement("button");
      mainButton.className = "translator-tools-button";
      mainButton.innerHTML = `
        <span class="tools-icon">⚙️</span>
    `;
      const dropdown = document.createElement("div");
      dropdown.className = "translator-tools-dropdown";
      const menuItems = [];
      const settings = this.translator.userSettings.settings;
      if (settings.pageTranslation?.enabled) {
        menuItems.push({
          icon: "📄",
          text: this.page.isTranslated ? "Bản gốc" : "Dịch trang",
          "data-type": "pageTranslate",
          handler: async () => {
            try {
              dropdown.style.display = "none";
              this.showTranslatingStatus();
              const result = await this.page.translatePage();
              if (result.success) {
                const menuItem = dropdown.querySelector(
                  '[data-type="pageTranslate"]'
                );
                if (menuItem) {
                  const itemText = menuItem.querySelector(".item-text");
                  if (itemText) {
                    itemText.textContent = this.page.isTranslated
                      ? "Bản gốc"
                      : "Dịch trang";
                  }
                }
                this.showNotification(result.message, "success");
              } else {
                this.showNotification(result.message, "warning");
              }
            } catch (error) {
              console.error("Page translation error:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
            }
          },
        });
      }
      if (settings.ocrOptions?.enabled) {
        menuItems.push(
          {
            icon: "📷",
            text: "Dịch Ảnh",
            handler: () => ocrInput.click(),
          },
          {
            icon: "📸",
            text: "Dịch Màn hình",
            handler: async () => {
              try {
                dropdown.style.display = "none";
                await new Promise((resolve) => setTimeout(resolve, 100));
                console.log("Starting screen translation...");
                this.showTranslatingStatus();
                const screenshot = await this.ocr.captureScreen();
                if (!screenshot) {
                  throw new Error("Không thể tạo ảnh chụp màn hình");
                }
                const result = await this.ocr.processImage(screenshot);
                if (!result) {
                  throw new Error("Không thể xử lý ảnh chụp màn hình");
                }
                this.displayPopup(result, null, "OCR Màn hình");
              } catch (error) {
                console.error("Screen translation error:", error);
                this.showNotification(error.message, "error");
              } finally {
                this.removeTranslatingStatus();
              }
            },
          },
          {
            icon: "🖼️",
            text: "Dịch Ảnh Web",
            handler: () => {
              dropdown.style.display = "none";
              this.startWebImageOCR();
            },
          },
          {
            icon: "📚",
            text: "Dịch Manga",
            handler: () => {
              dropdown.style.display = "none";
              this.startMangaTranslation();
            },
          }
        );
      }
      if (settings.mediaOptions?.enabled) {
        menuItems.push({
          icon: "🎵",
          text: "Dịch Media",
          handler: () => mediaInput.click(),
        });
      }
      menuItems.push({
        icon: "📄",
        text: "Dịch File HTML",
        handler: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".html,.htm";
          input.style.display = "none";
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              this.showTranslatingStatus();
              const content = await this.readFileContent(file);
              const translatedHTML = await this.page.translateHTML(content);
              const blob = new Blob([translatedHTML], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `king1x32_translated_${file.name}`;
              a.click();
              URL.revokeObjectURL(url);
              this.showNotification("Dịch file HTML thành công", "success");
            } catch (error) {
              console.error("Lỗi dịch file HTML:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
              input.value = "";
            }
          };
          input.click();
        },
      },
        {
          icon: "📑",
          text: "Dịch File PDF",
          handler: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf";
            input.style.display = "none";
            input.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              try {
                this.showLoadingStatus("Đang xử lý PDF...");
                const translatedBlob = await this.page.translatePDF(file);
                const url = URL.createObjectURL(translatedBlob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `king1x32_translated_${file.name.replace(".pdf", ".html")}`;
                a.click();
                URL.revokeObjectURL(url);
                this.showNotification("Dịch PDF thành công", "success");
              } catch (error) {
                console.error("Lỗi dịch PDF:", error);
                this.showNotification(error.message, "error");
              } finally {
                this.removeLoadingStatus();
                input.value = "";
              }
            };
            input.click();
          },
        }, {
        icon: "📄",
        text: "Dịch File",
        handler: () => {
          dropdown.style.display = "none";
          const supportedFormats = RELIABLE_FORMATS.text.formats.map(f => `.${f.ext}`).join(',');
          const input = document.createElement("input");
          input.type = "file";
          input.accept = supportedFormats;
          input.style.display = "none";
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              this.showTranslatingStatus();
              const result = await this.translator.translateFile(file);
              const blob = new Blob([result], { type: file.type });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `king1x32_translated_${file.name}`;
              this.shadowRoot.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              a.remove();
              this.showNotification("Dịch file thành công", "success");
            } catch (error) {
              console.error("Lỗi dịch file:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
              input.value = "";
            }
          };
          input.click();
        }
      },
        {
          icon: "⚙️",
          text: "Cài đặt King AI",
          handler: () => {
            dropdown.style.display = "none";
            const settingsUI = this.translator.userSettings.createSettingsUI();
            this.shadowRoot.appendChild(settingsUI);
          }
        });
      menuItems.forEach((item) => {
        const menuItem = document.createElement("div");
        menuItem.className = "translator-tools-item";
        if (item["data-type"]) {
          menuItem.setAttribute("data-type", item["data-type"]);
        }
        menuItem.innerHTML = `
    <span class="item-icon">${item.icon}</span>
    <span class="item-text">${item.text}</span>
  `;
        menuItem.handler = item.handler;
        menuItem.addEventListener("click", item.handler);
        dropdown.appendChild(menuItem);
      });
      this.handleButtonClick = (e) => {
        e.stopPropagation();
        dropdown.style.display =
          dropdown.style.display === "none" ? "block" : "none";
      };
      mainButton.addEventListener("click", this.handleButtonClick);
      this.handleClickOutside = () => {
        dropdown.style.display = "none";
      };
      document.addEventListener("click", this.handleClickOutside);
      container.appendChild(mainButton);
      container.appendChild(dropdown);
      container.appendChild(ocrInput);
      container.appendChild(mediaInput);
      this.shadowRoot.appendChild(container);
      if (!this.shadowRoot.contains(container)) {
        this.shadowRoot.appendChild(container);
      }
      container.style.zIndex = "2147483647";
    }
    showProcessingStatus(message) {
      this.removeProcessingStatus();
      const status = document.createElement("div");
      status.className = "processing-status";
      status.innerHTML = `
            <div class="processing-spinner" style="color: white"></div>
            <div class="processing-message" style="color: white">${message}</div>
            <div class="processing-progress" style="color: white">0%</div>
        `;
      Object.assign(status.style, {
        position: "fixed",
        top: `${window.innerHeight / 2}px`,
        left: `${window.innerWidth / 2}px`,
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "20px",
        borderRadius: "8px",
        zIndex: "2147483647",
        textAlign: "center",
        minWidth: "200px",
      });
      this.shadowRoot.appendChild(status);
      this.processingStatus = status;
    }
    updateProcessingStatus(message, progress) {
      if (this.processingStatus) {
        const messageEl = this.processingStatus.querySelector(
          ".processing-message"
        );
        const progressEl = this.processingStatus.querySelector(
          ".processing-progress"
        );
        if (messageEl) messageEl.textContent = message;
        if (progressEl) progressEl.textContent = `${progress}%`;
      }
    }
    removeProcessingStatus() {
      if (this.processingStatus) {
        this.processingStatus.remove();
        this.processingStatus = null;
      }
      const status = this.$('.processing-status');
      if (status) status.remove();
    }
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Không thể đọc file"));
        reader.readAsText(file);
      });
    }
    showLoadingStatus(message) {
      const loading = document.createElement("div");
      loading.id = "pdf-loading-status";
      loading.style.cssText = `
            position: fixed;
            top: ${window.innerHeight / 2}px;
            left: ${window.innerWidth / 2}px;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 2147483647;
        `;
      loading.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="color: white"></div>
                <div style="color: white">${message}</div>
            </div>
        `;
      this.shadowRoot.appendChild(loading);
    }
    removeLoadingStatus() {
      const loading = this.shadowRoot.getElementById("pdf-loading-status");
      if (loading) loading.remove();
    }
    updateProgress(message, percent) {
      const loading = this.shadowRoot.getElementById("pdf-loading-status");
      if (loading) {
        loading.innerHTML = `
                <div style="text-align: center;">
                    <div class="spinner" style="color: white"></div>
                    <div style="color: white">${message}</div>
                    <div style="color: white">${percent}%</div>
                </div>
            `;
      }
    }
    startWebImageOCR() {
      console.log("Starting web image OCR");
      const style = document.createElement("style");
      style.textContent = `
    .translator-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.3);
      z-index: 2147483647;
      pointer-events: none;
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
      pointer-events: none;
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
      pointer-events: auto;
    }
    img {
      pointer-events: auto;
    }
    img.translator-image-highlight {
      outline: 3px solid #4a90e2;
      cursor: pointer;
      position: relative;
      z-index: 2147483647;
    }
  `;
      this.shadowRoot.appendChild(style);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = "Click vào ảnh để OCR";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      this.shadowRoot.appendChild(overlay);
      this.shadowRoot.appendChild(guide);
      this.shadowRoot.appendChild(cancelBtn);
      const handleHover = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.add("translator-image-highlight");
        }
      };
      const handleLeave = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.remove("translator-image-highlight");
        }
      };
      const handleClick = async (e) => {
        if (e.target.tagName === "IMG") {
          e.preventDefault();
          e.stopPropagation();
          try {
            this.showTranslatingStatus();
            const image = e.target;
            const imageUrl = new URL(image.src);
            const referer = window.location.href;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const loadImage = async (url) => {
              return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "GET",
                  url: url,
                  headers: {
                    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Referer": referer,
                    "Origin": imageUrl.origin,
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                    "User-Agent": navigator.userAgent
                  },
                  responseType: "blob",
                  anonymous: true,
                  onload: function(response) {
                    if (response.status === 200) {
                      const blob = response.response;
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        resolve();
                      };
                      img.onerror = () => reject(new Error("Không thể load ảnh"));
                      img.src = URL.createObjectURL(blob);
                    } else {
                      const img = new Image();
                      img.crossOrigin = "anonymous";
                      img.onload = () => {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        resolve();
                      };
                      img.onerror = () => reject(new Error("Không thể load ảnh"));
                      img.src = url;
                    }
                  },
                  onerror: function() {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;
                      ctx.drawImage(img, 0, 0);
                      resolve();
                    };
                    img.onerror = () => reject(new Error("Không thể load ảnh"));
                    img.src = url;
                  }
                });
              });
            };
            await loadImage(image.src);
            const blob = await new Promise((resolve, reject) => {
              try {
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error("Không thể tạo blob"));
                }, "image/png");
              } catch (err) {
                reject(new Error("Lỗi khi tạo blob"));
              }
            });
            const file = new File([blob], "web-image.png", { type: "image/png" });
            const showSource = this.translator.userSettings.settings.displayOptions.languageLearning.showSource;
            const result = await this.ocr.processImage(file);
            const translations = result.split("\n");
            let fullTranslation = "";
            let pinyin = "";
            let text = "";
            for (const trans of translations) {
              const parts = trans.split("<|>");
              if (showSource) {
                text += (parts[0]?.trim() || "") + "\n";
              }
              pinyin += (parts[1]?.trim() || "") + "\n";
              fullTranslation += (parts[2]?.trim() || trans) + "\n";
            }
            this.displayPopup(
              fullTranslation.trim(),
              text.trim(),
              "OCR Web Image",
              pinyin.trim()
            );
          } catch (error) {
            console.error("OCR error:", error);
            this.showNotification(error.message, "error");
          } finally {
            this.removeTranslatingStatus();
          }
        }
      };
      document.addEventListener("mouseover", handleHover, true);
      document.addEventListener("mouseout", handleLeave, true);
      document.addEventListener("click", handleClick, true);
      cancelBtn.addEventListener("click", () => {
        this.removeWebImageListeners();
      });
      this.webImageListeners = {
        hover: handleHover,
        leave: handleLeave,
        click: handleClick,
        overlay,
        guide,
        cancelBtn,
        style,
      };
    }
    startMangaTranslation() {
      const style = document.createElement("style");
      style.textContent = `
    .translator-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.3);
      z-index: 2147483647;
      pointer-events: none;
      transition: background 0.3s ease;
    }
    .translator-overlay.translating-done {
      background-color: transparent;
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
      z-index: 2147483647;
    }
    .manga-translation-container {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 2147483647;
    }
    .manga-translation-overlay {
      position: absolute;
      background-color: rgba(255, 255, 255, 0.95);
      padding: 4px 8px;
      border-radius: 8px;
      pointer-events: none;
      text-align: center;
      word-break: break-word;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      border: 2px solid rgba(74, 144, 226, 0.7);
    }
    img.translator-image-highlight {
      outline: 3px solid #4a90e2;
      cursor: pointer;
    }
  `;
      this.shadowRoot.appendChild(style);
      const overlayContainer = document.createElement("div");
      overlayContainer.className = "manga-translation-container";
      this.shadowRoot.appendChild(overlayContainer);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = "Click vào ảnh để dịch";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      this.shadowRoot.appendChild(overlay);
      this.shadowRoot.appendChild(guide);
      this.shadowRoot.appendChild(cancelBtn);
      let existingOverlays = [];
      const handleHover = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.add("translator-image-highlight");
        }
      };
      const handleLeave = (e) => {
        if (e.target.tagName === "IMG") {
          e.target.classList.remove("translator-image-highlight");
        }
      };
      const handleClick = async (e) => {
        if (e.target.tagName === "IMG") {
          e.preventDefault();
          e.stopPropagation();
          try {
            this.showTranslatingStatus();
            const image = e.target;
            const imageUrl = new URL(image.src);
            const referer = window.location.href;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const loadImage = async (url) => {
              return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "GET",
                  url: url,
                  headers: {
                    Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                    Referer: referer,
                    Origin: imageUrl.origin,
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                    "User-Agent": navigator.userAgent,
                  },
                  responseType: "blob",
                  anonymous: true,
                  onload: function(response) {
                    if (response.status === 200) {
                      const blob = response.response;
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        resolve();
                      };
                      img.onerror = () =>
                        reject(new Error("Không thể load ảnh"));
                      img.src = URL.createObjectURL(blob);
                    } else {
                      const img = new Image();
                      img.crossOrigin = "anonymous";
                      img.onload = () => {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        resolve();
                      };
                      img.onerror = () =>
                        reject(new Error("Không thể load ảnh"));
                      img.src = url;
                    }
                  },
                  onerror: function() {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                      canvas.width = img.naturalWidth;
                      canvas.height = img.naturalHeight;
                      ctx.drawImage(img, 0, 0);
                      resolve();
                    };
                    img.onerror = () => reject(new Error("Không thể load ảnh"));
                    img.src = url;
                  },
                });
              });
            };
            await loadImage(image.src);
            const blob = await new Promise((resolve, reject) => {
              try {
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error("Không thể tạo blob"));
                }, "image/png");
              } catch (err) {
                reject(new Error("Lỗi khi tạo blob"));
              }
            });
            const file = new File([blob], "manga.png", { type: "image/png" });
            const result = await this.detectTextPositions(file);
            overlayContainer.innerHTML = "";
            existingOverlays = [];
            if (result?.regions) {
              overlayContainer.innerHTML = "";
              existingOverlays = [];
              overlay.classList.add("translating-done");
              const sortedRegions = result.regions.sort((a, b) => {
                if (Math.abs(a.position.y - b.position.y) < 20) {
                  return b.position.x - a.position.x;
                }
                return a.position.y - b.position.y;
              });
              sortedRegions.forEach((region) => {
                const overlay = document.createElement("div");
                overlay.className = "manga-translation-overlay";
                const calculatePosition = () => {
                  const imageRect = image.getBoundingClientRect();
                  const x =
                    (imageRect.width * region.position.x) / 100 +
                    imageRect.left;
                  const y =
                    (imageRect.height * region.position.y) / 100 +
                    imageRect.top;
                  const width = (imageRect.width * region.position.width) / 100;
                  const height =
                    (imageRect.height * region.position.height) / 100;
                  return { x, y, width, height };
                };
                const pos = calculatePosition();
                const padding = 2;
                const themeMode = this.translator.userSettings.settings.theme;
                const theme = CONFIG.THEME[themeMode];
                Object.assign(overlay.style, {
                  position: "fixed",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  minWidth: `${pos.width - padding * 2}px`,
                  width: "auto",
                  maxWidth: `${pos.width * 1.4 - padding * 2}px`,
                  height: "auto",
                  // maxHeight: `${pos.height * 2}px`,
                  backgroundColor: `${theme.background}`,
                  color: `${theme.text}`,
                  padding: `${padding * 2}px ${padding * 4}px`,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  wordBreak: "keep-all",
                  wordWrap: "break-word",
                  // overflowWrap: "normal",
                  lineHeight: "1.2",
                  pointerEvents: "none",
                  zIndex: "2147483647",
                  fontSize:
                    this.translator.userSettings.settings.displayOptions
                      .webImageTranslation.fontSize || "9px",
                  fontWeight: "600",
                  margin: "0",
                  flexWrap: "wrap",
                  whiteSpace: "pre-wrap",
                  overflow: "visible",
                  boxSizing: "border-box",
                  transform: "none",
                  transformOrigin: "center center",
                });
                overlay.textContent = region.translation;
                overlayContainer.appendChild(overlay);
                const updatePosition = debounce(() => {
                  const newPos = calculatePosition();
                  overlay.style.left = `${newPos.x}px`;
                  overlay.style.top = `${newPos.y}px`;
                  overlay.style.minWidth = `${newPos.width - padding * 2}px`;
                  overlay.style.maxWidth = `${newPos.width * 1.4 - padding * 2
                    }px`;
                  // overlay.style.maxHeight = `${newPos.height * 2}px`;
                }, 16);
                window.addEventListener("scroll", updatePosition, {
                  passive: true,
                });
                window.addEventListener("resize", updatePosition, {
                  passive: true,
                });
              });
              overlayContainer.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2147483647;
`;
              this.shadowRoot.appendChild(style);
            }
          } catch (error) {
            console.error("Translation error:", error);
            this.showNotification(error.message, "error");
          } finally {
            this.removeTranslatingStatus();
          }
        }
      };
      document.addEventListener("mouseover", handleHover, true);
      document.addEventListener("mouseout", handleLeave, true);
      document.addEventListener("click", handleClick, true);
      cancelBtn.addEventListener("click", () => {
        if (this.updatePosition) {
          window.removeEventListener("scroll", this.updatePosition);
          window.removeEventListener("resize", this.updatePosition);
          this.updatePosition = null;
        }
        overlayContainer.innerHTML = "";
        overlayContainer.remove();
        document.removeEventListener("mouseover", handleHover, true);
        document.removeEventListener("mouseout", handleLeave, true);
        document.removeEventListener("click", handleClick, true);
        overlay.remove();
        guide.remove();
        cancelBtn.remove();
        style.remove();
        document
          .querySelectorAll(".translator-image-highlight")
          .forEach((el) => {
            el.classList.remove("translator-image-highlight");
          });
        document
          .querySelectorAll(".manga-translation-overlay")
          .forEach((el) => el.remove());
        overlay.classList.remove("translating-done");
        this.removeWebImageListeners();
      });
      this.webImageListeners = {
        hover: handleHover,
        leave: handleLeave,
        click: handleClick,
        overlay,
        guide,
        cancelBtn,
        style,
        container: overlayContainer,
      };
    }
    async detectTextPositions(file) {
      try {
        const base64Image = await this.ocr.fileToBase64(file);
        const settings = this.translator.userSettings.settings;
        const selectedModel = this.translator.api.getGeminiModel();
        const targetLanguage = settings.displayOptions.targetLanguage;
        const requestBody = {
          contents: [
            {
              parts: [
                {
                  text: `Analyze this image and extract all text regions. For each text region:
1. Extract the original text
2. Dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' với yêu cầu sau:
  Bạn là một người dịch truyện chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch một đoạn truyện sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn giữ nguyên ý nghĩa của câu gốc và phù hợp với văn phong của ngôn ngữ đích. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của câu chuyện để người đọc có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
    - Đảm bảo nghĩa của các câu không bị thay đổi khi dịch.
    - Sử dụng các từ lóng hoặc cụm từ thông dụng khi cần thiết để bản dịch gần gũi với người đọc.
    - Kiểm tra chính tả và ngữ pháp trong bản dịch.
    - Thêm các trợ từ ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' khi cần để câu văn hoàn chỉnh hơn.
    - Sử dụng đại từ nhân xưng ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' tự nhiên và hợp ngữ cảnh.
    - Tham khảo các trang web sau để lấy văn phong phù hợp cho các đoạn truyện liên quan đến sex: [https://truyensex.moe/, https://truyensexvn.org/, https://truyensex.vip/, https://truyensextv69.com/].
  Lưu ý:
    - Những từ tên riêng, địa điểm thì hãy dịch theo nghĩa Hán Việt ví dụ như: Diệp Trần, Lục Thiếu Du, Long kiếm, Long Sĩ Đầu, Thiên kiếp, ngõ Nê Bình, ... thì giữ theo nghĩa Hán Việt sẽ hay hơn là dịch hẳn sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'.
    - Chỉ trả về bản dịch ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', không giải thích thêm.
3. Determine PRECISE position and size:
   - x, y: exact percentage position relative to image (0-100)
   - width, height: exact percentage size relative to image (0-100)
   - text_length: character count of original text
   - text_lines: number of text lines
   - bubble_type: speech/thought/narration/sfx
Return ONLY a JSON object like:
{
  "regions": [{
    "text": "original text",
    "translation": "translated text",
    "position": {
      "x": 20.5,
      "y": 30.2,
      "width": 15.3,
      "height": 10.1,
      "text_length": 25,
      "text_lines": 2,
      "bubble_type": "speech"
    }
  }]
}`,
                },
                {
                  inline_data: {
                    mime_type: file.type,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: settings.ocrOptions.temperature,
            topP: settings.ocrOptions.topP,
            topK: settings.ocrOptions.topK,
          },
        };
        console.log("Sending API request...");
        const responses =
          await this.translator.api.keyManager.executeWithMultipleKeys(
            async (key) => {
              const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  method: "POST",
                  url: `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
                  headers: { "Content-Type": "application/json" },
                  data: JSON.stringify(requestBody),
                  onload: (response) => {
                    console.log("API Response:", response);
                    if (response.status === 200) {
                      try {
                        const result = JSON.parse(response.responseText);
                        const text =
                          result?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          const jsonMatch = text.match(/\{[\s\S]*\}/);
                          if (jsonMatch) {
                            const parsedJson = JSON.parse(jsonMatch[0]);
                            resolve(parsedJson);
                          } else {
                            reject(new Error("No JSON found in response"));
                          }
                        } else {
                          reject(new Error("Invalid response format"));
                        }
                      } catch (error) {
                        console.error("Parse error:", error);
                        reject(error);
                      }
                    } else {
                      reject(new Error(`API Error: ${response.status}`));
                    }
                  },
                  onerror: (error) => reject(error),
                });
              });
              return response;
            },
            settings.apiProvider
          );
        console.log("API responses:", responses);
        const response = responses.find((r) => r && r.regions);
        if (!response) {
          throw new Error("No valid response found");
        }
        return response;
      } catch (error) {
        console.error("Text detection error:", error);
        throw error;
      }
    }
    getBrowserContextMenuSize() {
      const browser = navigator.userAgent;
      const sizes = {
        firefox: {
          width: 275,
          height: 340,
          itemHeight: 34,
        },
        chrome: {
          width: 250,
          height: 320,
          itemHeight: 32,
        },
        safari: {
          width: 240,
          height: 300,
          itemHeight: 30,
        },
        edge: {
          width: 260,
          height: 330,
          itemHeight: 33,
        },
      };
      let size;
      if (browser.includes("Firefox")) {
        size = sizes.firefox;
      } else if (browser.includes("Safari") && !browser.includes("Chrome")) {
        size = sizes.safari;
      } else if (browser.includes("Edge")) {
        size = sizes.edge;
      } else {
        size = sizes.chrome;
      }
      const dpi = window.devicePixelRatio || 1;
      return {
        width: Math.round(size.width * dpi),
        height: Math.round(size.height * dpi),
        itemHeight: Math.round(size.itemHeight * dpi),
      };
    }
    setupContextMenu() {
      if (!this.translator.userSettings.settings.contextMenu?.enabled) return;
      let isSpeaking = false; // Thêm biến theo dõi trạng thái đọc
      document.addEventListener("contextmenu", (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText) {
          const oldMenus = this.$$(".translator-context-menu");
          oldMenus.forEach((menu) => menu.remove());
          const contextMenu = document.createElement("div");
          contextMenu.className = "translator-context-menu";
          const menuItems = [
            { text: "Dịch nhanh", action: "quick" },
            { text: "Dịch popup", action: "popup" },
            { text: "Dịch nâng cao", action: "advanced" },
            {
              text: "Đọc văn bản",
              action: "tts",
              getLabel: () => isSpeaking ? "Dừng đọc" : "Đọc văn bản" // Dynamic label
            }
          ];
          const range = selection.getRangeAt(0).cloneRange();
          menuItems.forEach((item) => {
            const menuItem = document.createElement("div");
            menuItem.className = "translator-context-menu-item";
            menuItem.textContent = item.getLabel ? item.getLabel() : item.text;
            menuItem.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const newSelection = window.getSelection();
              newSelection.removeAllRanges();
              newSelection.addRange(range);
              if (item.action === "tts") {
                if (isSpeaking) {
                  speechSynthesis.cancel();
                  isSpeaking = false;
                } else {
                  speechSynthesis.cancel(); // Dừng phát âm hiện tại nếu có
                  const utterance = new SpeechSynthesisUtterance(selectedText);
                  utterance.lang = this.translator.userSettings.settings.displayOptions.sourceLanguage;
                  utterance.onend = () => {
                    isSpeaking = false;
                    menuItem.textContent = "Đọc văn bản";
                  };
                  utterance.oncancel = () => {
                    isSpeaking = false;
                    menuItem.textContent = "Đọc văn bản";
                  };
                  speechSynthesis.speak(utterance);
                  isSpeaking = true;
                }
                menuItem.textContent = isSpeaking ? "Dừng đọc" : "Đọc văn bản";
              } else {
                this.handleTranslateButtonClick(newSelection, item.action);
                contextMenu.remove();
              }
            };
            contextMenu.appendChild(menuItem);
          });
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const menuWidth = 150;
          const menuHeight = (menuItems.length * 40);
          const browserMenu = this.getBrowserContextMenuSize();
          const browserMenuWidth = browserMenu.width;
          const browserMenuHeight = browserMenu.height;
          const spaceWidth = browserMenuWidth + menuWidth;
          const remainingWidth = viewportWidth - e.clientX;
          const rightEdge = viewportWidth - menuWidth;
          const bottomEdge = viewportHeight - menuHeight;
          const browserMenuWidthEdge = viewportWidth - browserMenuWidth;
          const browserMenuHeightEdge = viewportHeight - browserMenuHeight;
          let left, top;
          if (e.clientX < menuWidth && e.clientY < menuHeight) {
            left = e.clientX + browserMenuWidth + 10;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY < browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY - menuHeight;
          } else if (
            e.clientX < menuWidth &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX + browserMenuWidth + 10;
            top = e.clientY - menuHeight;
          } else if (e.clientY < menuHeight) {
            left = e.clientX - menuWidth;
            top = e.clientY;
          } else if (e.clientX > browserMenuWidthEdge) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (e.clientY > browserMenuHeightEdge - menuHeight / 2) {
            left = e.clientX - menuWidth;
            top = e.clientY - menuHeight;
          } else {
            left = e.clientX;
            top = e.clientY - menuHeight;
          }
          left = Math.max(5, Math.min(left, rightEdge - 5));
          top = Math.max(5, Math.min(top, bottomEdge - 5));
          contextMenu.style.left = `${left}px`;
          contextMenu.style.top = `${top}px`;
          this.shadowRoot.appendChild(contextMenu);
          const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
              speechSynthesis.cancel();
              contextMenu.remove();
              document.removeEventListener("click", closeMenu);
            }
          };
          document.addEventListener("click", closeMenu);
          const handleScroll = debounce(() => {
            speechSynthesis.cancel();
            contextMenu.remove();
            window.removeEventListener("scroll", handleScroll);
          }, 150);
          window.addEventListener("scroll", handleScroll, { passive: true }); // Thêm passive để tối ưu performance
        }
      });
    }
    removeWebImageListeners() {
      if (this.webImageListeners) {
        document.removeEventListener(
          "mouseover",
          this.webImageListeners.hover,
          true
        );
        document.removeEventListener(
          "mouseout",
          this.webImageListeners.leave,
          true
        );
        document.removeEventListener(
          "click",
          this.webImageListeners.click,
          true
        );
        this.webImageListeners.overlay?.remove();
        this.webImageListeners.guide?.remove();
        this.webImageListeners.cancelBtn?.remove();
        this.webImageListeners.style?.remove();
        document
          .querySelectorAll(".translator-image-highlight")
          .forEach((el) => {
            el.classList.remove("translator-image-highlight");
          });
        this.webImageListeners = null;
      }
    }
    handleSettingsShortcut(e) {
      if (!this.translator.userSettings.settings.shortcuts?.settingsEnabled)
        return;
      if ((e.altKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const settingsUI = this.translator.userSettings.createSettingsUI();
        this.shadowRoot.appendChild(settingsUI);
      }
    }
    async handleTranslationShortcuts(e) {
      if (!this.translator.userSettings.settings.shortcuts?.enabled) return;
      const shortcuts = this.translator.userSettings.settings.shortcuts;
      if (e.altKey || e.metaKey) {
        let translateType = null;
        if (e.key === shortcuts.pageTranslate.key) {
          e.preventDefault();
          await this.handlePageTranslation();
          return;
        } else if (e.key === shortcuts.inputTranslate.key) {
          e.preventDefault();
          const activeElement = document.activeElement;
          if (this.translator.input.isValidEditor(activeElement)) {
            const text = this.translator.input.getEditorContent(activeElement);
            if (text) {
              await this.translator.input.translateEditor(activeElement, true);
            }
          }
          return;
        }
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (!selectedText || this.isTranslating) return;
        const targetElement = selection.anchorNode?.parentElement;
        if (!targetElement) return;
        if (e.key === shortcuts.quickTranslate.key) {
          e.preventDefault();
          translateType = "quick";
        } else if (e.key === shortcuts.popupTranslate.key) {
          e.preventDefault();
          translateType = "popup";
        } else if (e.key === shortcuts.advancedTranslate.key) {
          e.preventDefault();
          translateType = "advanced";
        }
        if (translateType) {
          await this.handleTranslateButtonClick(selection, translateType);
        }
      }
    }
    updateSettingsListener(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.settingsShortcutListener);
      } else {
        document.removeEventListener("keydown", this.settingsShortcutListener);
      }
    }
    updateSettingsTranslationListeners(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.translationShortcutListener);
      } else {
        document.removeEventListener(
          "keydown",
          this.translationShortcutListener
        );
      }
    }
    updateSelectionListeners(enabled) {
      if (enabled) this.setupSelectionHandlers();
    }
    updateTapListeners(enabled) {
      if (enabled) this.setupDocumentTapHandler();
    }
    setupEventListeners() {
      const shortcuts = this.translator.userSettings.settings.shortcuts;
      const clickOptions = this.translator.userSettings.settings.clickOptions;
      const touchOptions = this.translator.userSettings.settings.touchOptions;
      if (this.translator.userSettings.settings.contextMenu?.enabled) {
        this.setupContextMenu();
      }
      if (shortcuts?.settingsEnabled) {
        this.updateSettingsListener(true);
      }
      if (shortcuts?.enabled) {
        this.updateSettingsTranslationListeners(true);
      }
      if (clickOptions?.enabled) {
        this.updateSelectionListeners(true);
        this.translationButtonEnabled = true;
      }
      if (touchOptions?.enabled) {
        this.updateTapListeners(true);
        this.translationTapEnabled = true;
      }
      const isEnabled =
        localStorage.getItem("translatorToolsEnabled") === "true";
      if (isEnabled) {
        this.setupTranslatorTools();
      }
      this.shadowRoot.addEventListener("settingsChanged", (e) => {
        this.removeToolsContainer();
        const newSettings = e.detail;
        if (newSettings.theme !== this.translator.userSettings.settings.theme) {
          this.updateAllButtonStyles();
        }
        this.updateSettingsListener(newSettings.shortcuts?.settingsEnabled);
        this.updateSettingsTranslationListeners(newSettings.shortcuts?.enabled);
        if (newSettings.clickOptions?.enabled !== undefined) {
          this.translationButtonEnabled = newSettings.clickOptions.enabled;
          this.updateSelectionListeners(newSettings.clickOptions.enabled);
          if (!newSettings.clickOptions.enabled) {
            this.removeTranslateButton();
          }
        }
        if (newSettings.touchOptions?.enabled !== undefined) {
          this.translationTapEnabled = newSettings.touchOptions.enabled;
          this.updateTapListeners(newSettings.touchOptions.enabled);
          if (!newSettings.touchOptions.enabled) {
            this.removeTranslateButton();
          }
        }
        this.cache = new TranslationCache(
          newSettings.cacheOptions.text.maxSize,
          newSettings.cacheOptions.text.expirationTime
        );
        this.cache.clear();
        if (this.ocr?.imageCache) {
          this.ocr.imageCache.clear();
        }
        const apiConfig = {
          providers: CONFIG.API.providers,
          currentProvider: newSettings.apiProvider,
          apiKey: newSettings.apiKey,
          maxRetries: CONFIG.API.maxRetries,
          retryDelay: CONFIG.API.retryDelay,
        };
        this.api = new APIManager(
          apiConfig,
          () => this.translator.userSettings.settings
        );
        const isEnabled =
          localStorage.getItem("translatorToolsEnabled") === "true";
        if (isEnabled) {
          this.setupTranslatorTools();
        }
      });
    }
    showNotification(message, type = "info") {
      const notification = document.createElement("div");
      notification.className = "translator-notification";
      const colors = {
        info: "#4a90e2",
        success: "#28a745",
        warning: "#ffc107",
        error: "#dc3545",
      };
      const backgroundColor = colors[type] || colors.info;
      const textColor = type === "warning" ? "#000" : "#fff";
      Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        left: `${window.innerWidth / 2}px`,
        transform: "translateX(-50%)",
        backgroundColor,
        color: textColor,
        padding: "10px 20px",
        borderRadius: "8px",
        zIndex: "2147483647",
        animation: "fadeInOut 2s ease",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      });
      notification.textContent = message;
      this.shadowRoot.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    resetState() {
      if (this.pressTimer) clearTimeout(this.pressTimer);
      if (this.timer) clearTimeout(this.timer);
      this.isLongPress = false;
      this.lastTime = 0;
      this.count = 0;
      this.isDown = false;
      this.isTranslating = false;
      this.ignoreNextSelectionChange = false;
      this.removeTranslateButton();
      this.removeTranslatingStatus();
    }
    removeTranslateButton() {
      if (this.currentTranslateButton) {
        const button = this.$('.translator-button');
        if (button) button.remove();
        this.currentTranslateButton = null;
      }
    }
    removeTranslatingStatus() {
      if (this.translatingStatus) {
        this.translatingStatus.remove();
        this.translatingStatus = null;
      }
      const status = this.$('.center-translate-status');
      if (status) status.remove();
    }
  }
  class Translator {
    constructor() {
      window.translator = this;
      this.userSettings = new UserSettings(this);
      const apiConfig = {
        ...CONFIG.API,
        currentProvider: this.userSettings.getSetting("apiProvider"),
        apiKey: this.userSettings.getSetting("apiKey"),
      };
      this.api = new APIManager(apiConfig, () => this.userSettings.settings);
      this.input = new InputTranslator(this);
      this.ocr = new OCRManager(this);
      this.media = new MediaManager(this);
      this.ui = new UIManager(this);
      this.cache = new TranslationCache(
        this.userSettings.settings.cacheOptions.text.maxSize,
        this.userSettings.settings.cacheOptions.text.expirationTime
      );
      this.page = new PageTranslator(this);
      this.fileManager = new FileManager(this);
      this.ui.setupEventListeners();
      this.cache.optimizeStorage();
      this.autoCorrectEnabled = true;
    }
    async translate(
      text,
      targetElement,
      isAdvanced = false,
      popup = false,
      targetLang = ""
    ) {
      try {
        if (!text) return null;
        const settings = this.userSettings.settings.displayOptions;
        const targetLanguage = targetLang || settings.targetLanguage;
        const promptType = isAdvanced ? "advanced" : "normal";
        const prompt = this.createPrompt(text, promptType, targetLanguage);
        let translatedText;
        const cacheEnabled =
          this.userSettings.settings.cacheOptions.text.enabled;
        if (cacheEnabled) {
          translatedText = this.cache.get(text, isAdvanced, targetLanguage);
        }
        if (!translatedText) {
          translatedText = await this.api.request(prompt, 'page');
          if (cacheEnabled && translatedText) {
            this.cache.set(text, translatedText, isAdvanced, targetLanguage);
          }
        }
        if (
          translatedText &&
          targetElement &&
          !targetElement.isPDFTranslation
        ) {
          if (isAdvanced || popup) {
            const translations = translatedText.split("\n");
            let fullTranslation = "";
            let pinyin = "";
            for (const trans of translations) {
              const parts = trans.split("<|>");
              pinyin += (parts[1]?.trim() || "") + "\n";
              fullTranslation += (parts[2]?.trim() || trans) + "\n";
            }
            this.ui.displayPopup(
              fullTranslation.trim(),
              text,
              "King1x32 <3",
              pinyin.trim()
            );
          } else {
            this.ui.showTranslationBelow(translatedText, targetElement, text);
          }
        }
        return translatedText;
      } catch (error) {
        console.error("Lỗi dịch:", error);
        this.ui.showNotification(error.message, "error");
      }
    }
    async translateFile(file) {
      try {
        if (!this.fileManager.isValidFormat(file)) {
          throw new Error('Định dạng file không được hỗ trợ. Chỉ hỗ trợ: txt, srt, vtt, html, md, json');
        }
        if (!this.fileManager.isValidSize(file)) {
          throw new Error('File quá lớn. Tối đa 10MB');
        }
        return await this.fileManager.processFile(file);
      } catch (error) {
        throw new Error(`Lỗi dịch file: ${error.message}`);
      }
    }
    async translateLongText(text, maxChunkSize = 1000) {
      const chunks = this.splitIntoChunks(text, maxChunkSize);
      const translations = await Promise.all(
        chunks.map((chunk) => this.translate(chunk))
      );
      return this.smartMerge(translations);
    }
    splitIntoChunks(text, maxChunkSize) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let currentChunk = "";
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      return chunks;
    }
    smartMerge(translations) {
      return translations.reduce((merged, current, index) => {
        if (index === 0) return current;
        const lastChar = merged.slice(-1);
        if (".!?".includes(lastChar)) {
          return `${merged} ${current}`;
        }
        return merged + current;
      }, "");
    }
    async autoCorrect(translation) {
      const targetLanguage =
        this.userSettings.settings.displayOptions.targetLanguage;
      const prompt = `Vui lòng kiểm tra và sửa chữa bất kỳ lỗi ngữ pháp hoặc vấn đề về ngữ cảnh trong bản dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' này: "${translation}". Không thêm hay bớt ý của bản gốc cũng như không thêm tiêu đề, không giải thích về các thay đổi đã thực hiện.`;
      try {
        const corrected = await this.api.request(prompt, 'page');
        return corrected.trim();
      } catch (error) {
        console.error("Auto-correction failed:", error);
        return translation;
      }
    }
    createPrompt(text, type = "normal", targetLang = "") {
      const settings = this.userSettings.settings;
      const targetLanguage =
        targetLang || settings.displayOptions.targetLanguage;
      const sourceLanguage = settings.displayOptions.sourceLanguage;
      const isPinyinMode =
        settings.displayOptions.translationMode !== "translation_only"
      if (
        settings.promptSettings?.enabled &&
        settings.promptSettings?.useCustom
      ) {
        const prompts = settings.promptSettings.customPrompts;
        const promptKey = isPinyinMode ? `${type}_chinese` : type;
        let promptTemplate = prompts[promptKey];
        if (promptTemplate) {
          return promptTemplate
            .replace(/\{text\}/g, text)
            .replace(/\{targetLang\}/g, targetLanguage)
            .replace(
              /\{sourceLang\}/g,
              sourceLanguage || this.page.languageCode
            );
        }
      }
      return this.createDefaultPrompt(text, type, isPinyinMode, targetLanguage);
    }
    createDefaultPrompt(
      text,
      type = "normal",
      isPinyinMode = false,
      targetLang = ""
    ) {
      const settings = this.userSettings.settings;
      const targetLanguage =
        targetLang || settings.displayOptions.targetLanguage;
      const share_normal = `
Hãy dịch văn bản cần xử lý sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' với các yêu cầu sau:
  - Dịch phải tuân thủ chặt chẽ bối cảnh và sắc thái ban đầu của văn bản.
  - Đảm bảo sự lưu loát và tự nhiên như người bản xứ.
  - Không thêm bất kỳ giải thích hay diễn giải nào ngoài bản dịch.
  - Bảo toàn các thuật ngữ và danh từ riêng với tỷ lệ 1:1.

Nếu bạn nhận thấy văn bản là truyện thì hãy dịch truyện theo yêu cầu sau:
  Bạn là một người dịch truyện chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch một đoạn truyện sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn giữ nguyên ý nghĩa của câu gốc và phù hợp với văn phong của ngôn ngữ đích. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của câu chuyện để người đọc có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
    - Đảm bảo nghĩa của các câu không bị thay đổi khi dịch.
    - Sử dụng các từ lóng hoặc cụm từ thông dụng khi cần thiết để bản dịch gần gũi với người đọc.
    - Kiểm tra chính tả và ngữ pháp trong bản dịch.
    - Thêm các trợ từ ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' khi cần để câu văn hoàn chỉnh hơn.
    - Sử dụng đại từ nhân xưng ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' tự nhiên và hợp ngữ cảnh.
    - Tham khảo các trang web sau để lấy văn phong phù hợp cho các đoạn truyện liên quan đến sex: [https://truyensex.moe/, https://truyensexvn.org/, https://truyensex.vip/, https://truyensextv69.com/].
`;
      const share_ocr = `
Bạn là một người dịch truyện chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch một đoạn truyện sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn giữ nguyên ý nghĩa của câu gốc và phù hợp với văn phong của ngôn ngữ đích. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của câu chuyện để người đọc có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
  - Đảm bảo nghĩa của các câu không bị thay đổi khi dịch.
  - Sử dụng các từ lóng hoặc cụm từ thông dụng khi cần thiết để bản dịch gần gũi với người đọc.
  - Kiểm tra chính tả và ngữ pháp trong bản dịch.
  - Thêm các trợ từ ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' khi cần để câu văn hoàn chỉnh hơn.
  - Sử dụng đại từ nhân xưng ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' tự nhiên và hợp ngữ cảnh.
  - Tham khảo các trang web sau để lấy văn phong phù hợp cho các đoạn truyện liên quan đến sex: [https://truyensex.moe/, https://truyensexvn.org/, https://truyensex.vip/, https://truyensextv69.com/].
`;
      const share_media = `
Bạn là một người dịch phụ đề phim chuyên nghiệp, chuyên tạo file SRT. Bạn cần dịch một đoạn hội thoại phim sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn chính xác và tự nhiên, giữ nguyên ý nghĩa của câu gốc. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của bộ phim để người xem có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
  - Đảm bảo nghĩa của các câu không bị thay đổi khi dịch.
  - Sử dụng các từ lóng hoặc cụm từ thông dụng khi cần thiết để bản dịch gần gũi với người đọc.
  - Kiểm tra chính tả và ngữ pháp trong bản dịch.
  - Thêm các trợ từ ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' khi cần để hội thoại hoàn chỉnh hơn.
  - Sử dụng đại từ nhân xưng ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' tự nhiên và hợp ngữ cảnh.
  - Tham khảo các trang web sau để lấy văn phong phù hợp cho các đoạn hội thoại liên quan đến sex: [https://truyensex.moe/, https://truyensexvn.org/, https://truyensex.vip/, https://truyensextv69.com/].
`;
      const share_pinyin = `
Hãy trả về theo format sau, mỗi phần cách nhau bằng dấu <|> và không có giải thích thêm:
  Văn bản gốc <|> phiên âm (Nếu văn bản gốc là tiếng Anh thì hãy trả về phiên âm của US) <|> bản dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'
  Ví dụ: Hello <|> heˈloʊ <|> Xin chào

Lưu ý:
  - Nếu có từ là tiếng Trung, hãy trả về giá trị phiên âm của từ đó chính là pinyin + số tone (1-4) của từ đó. Ví dụ: 你好 <|> Nǐ3 hǎo3 <|> Xin chào
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,...
  - Chỉ trả về bản dịch theo format trên, mỗi 1 cụm theo format sẽ ở 1 dòng, giữ nguyên định dạng phông chữ ban đầu và không giải thích thêm.
`;
      const basePrompts = {
        normal: `${share_normal}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,...
  - Hãy in ra bản dịch mà không có dấu ngoặc kép, giữ nguyên định dạng phông chữ ban đầu và không giải thích gì thêm.

Văn bản cần xử lý: "${text}"`,
        advanced: `Dịch và phân tích từ khóa: "${text}"`,
        ocr: `${share_ocr}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,..
  - Đọc hiểu thật kĩ và xử lý toàn bộ văn bản trong hình ảnh.
  - Không cần giải thích thêm.`,
        media: `${share_media}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,..
  - Định dạng bản dịch của bạn theo định dạng SRT và đảm bảo rằng mỗi đoạn hội thoại được đánh số thứ tự, có thời gian bắt đầu và kết thúc rõ ràng.
  - Không cần giải thích thêm.`,
        page: `${share_normal}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,...
  - Hãy in ra bản dịch mà không có dấu ngoặc kép, giữ nguyên định dạng phông chữ ban đầu và không giải thích gì thêm.

Văn bản cần xử lý: "${text}"`,
      };
      const pinyinPrompts = {
        normal: `${share_normal}
${share_pinyin}
Văn bản cần xử lý: "${text}"`,
        advanced: `Dịch và phân tích từ khóa: "${text}"`,
        ocr: `${share_ocr}
${share_pinyin}
Đọc hiểu thật kĩ và xử lý toàn bộ văn bản trong hình ảnh.`,
        media: `${share_media}
${share_pinyin}
  - Định dạng bản dịch của bạn theo định dạng SRT phải đảm bảo rằng mỗi đoạn hội thoại được đánh số thứ tự, có thời gian bắt đầu và kết thúc và có đủ 2 dòng là văn bản gốc nhận diện từ media và dòng văn bản dịch.
  - Không cần giải thích thêm.`,
        page: `${share_normal}
${share_pinyin}
Văn bản cần xử lý: "${text}"`,
      };
      return isPinyinMode ? pinyinPrompts[type] : basePrompts[type];
    }
    showSettingsUI() {
      const settingsUI = this.userSettings.createSettingsUI();
      this.ui.shadowRoot.appendChild(settingsUI);
    }
    handleError(error, targetElement) {
      console.error("Translation failed:", error);
      const message = error.message.includes("Rate limit")
        ? "Vui lòng chờ giữa các lần dịch"
        : error.message.includes("Gemini API")
          ? "Lỗi Gemini: " + error.message
          : error.message.includes("API Key")
            ? "Lỗi xác thực API"
            : "Lỗi dịch thuật: " + error.message;
      this.ui.showTranslationBelow(targetElement, message);
    }
  }
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  function createFileInput(accept, onFileSelected) {
    return new Promise((resolve) => {
      const translator = window.translator;
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
      font-family: Arial, sans-serif;
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
      title.textContent = 'Chọn file để dịch';
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
      cancelButton.textContent = 'Hủy';
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
      translateButton.textContent = 'Dịch';
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
            translateButton.textContent = 'Đang xử lý...';
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
      translator.ui.shadowRoot.appendChild(div);
      div.addEventListener('click', (e) => {
        if (e.target === div) cleanup();
      });
    });
  }
  GM_registerMenuCommand("📄 Dịch trang", async () => {
    const translator = window.translator;
    if (translator) {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.page.translatePage();
        if (result.success) {
          translator.ui.showNotification(result.message, "success");
        } else {
          translator.ui.showNotification(result.message, "warning");
        }
      } catch (error) {
        console.error("Page translation error:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    }
  });
  GM_registerMenuCommand("📷 Dịch Ảnh", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput("image/*", async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.ocr.processImage(file);
        translator.ui.displayPopup(result, null, "OCR Result");
      } catch (error) {
        translator.ui.showNotification(error.message);
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("📸 Dịch Màn hình", async () => {
    const translator = window.translator;
    if (translator) {
      try {
        translator.ui.showTranslatingStatus();
        const screenshot = await translator.ocr.captureScreen();
        if (!screenshot) {
          throw new Error("Không thể tạo ảnh chụp màn hình");
        }
        const result = await translator.ocr.processImage(screenshot);
        if (!result) {
          throw new Error("Không thể xử lý ảnh chụp màn hình");
        }
        translator.ui.displayPopup(result, null, "OCR Màn hình");
      } catch (error) {
        console.error("Screen translation error:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    }
  });
  GM_registerMenuCommand("🖼️ Dịch Ảnh Web", () => {
    const translator = window.translator;
    if (translator) {
      translator.ui.startWebImageOCR();
    }
  });
  GM_registerMenuCommand("📚 Dịch Manga", () => {
    const translator = window.translator;
    if (translator) {
      translator.ui.startMangaTranslation();
    }
  });
  GM_registerMenuCommand("🎵 Dịch Media", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput("audio/*, video/*", async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        await translator.media.processMediaFile(file);
      } catch (error) {
        translator.ui.showNotification(error.message);
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("📄 Dịch File HTML", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput(".html,.htm", async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        const content = await translator.ui.readFileContent(file);
        const translatedHTML = await translator.page.translateHTML(content);
        const blob = new Blob([translatedHTML], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `king1x32_translated_${file.name}`;
        translator.ui.shadowRoot.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        translator.ui.showNotification("Dịch file HTML thành công", "success");
      } catch (error) {
        console.error("Lỗi dịch file HTML:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("📑 Dịch File PDF", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput(".pdf", async (file) => {
      try {
        translator.ui.showLoadingStatus("Đang xử lý PDF...");
        const translatedBlob = await translator.page.translatePDF(file);
        const url = URL.createObjectURL(translatedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `king1x32_translated_${file.name.replace(".pdf", ".html")}`;
        translator.ui.shadowRoot.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        translator.ui.showNotification("Dịch PDF thành công", "success");
      } catch (error) {
        console.error("Lỗi dịch PDF:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeLoadingStatus();
      }
    });
  });
  GM_registerMenuCommand("📄 Dịch File (srt, vtt, md, json, txt, html)", async () => {
    const translator = window.translator;
    if (!translator) return;
    const supportedFormats = RELIABLE_FORMATS.text.formats
      .map(f => `.${f.ext}`)
      .join(',');
    await createFileInput(supportedFormats, async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.translateFile(file);
        const blob = new Blob([result], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `king1x32_translated_${file.name}`;
        translator.ui.shadowRoot.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        translator.ui.showNotification("Dịch file thành công", "success");
      } catch (error) {
        console.error("Lỗi dịch file:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("⚙️ Cài đặt King Translator AI", () => {
    const translator = window.translator;
    if (translator) {
      const settingsUI = translator.userSettings.createSettingsUI();
      translator.ui.shadowRoot.appendChild(settingsUI);
    }
  });
  new Translator();
})();
