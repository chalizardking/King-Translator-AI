// ==UserScript==
// @name         Manga Image Web Translator
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Translates manga/comic images using OCR and an AI provider (Gemini, OpenAI, Claude) with overlay display. Target language: English. Based on King Translator v2.
// @author       King Translator Team
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @require      https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js
// @run-at       document-end
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONSTANTS ====================
    const TARGET_LANGUAGE = 'en'; // Hardcoded to English
    const SCRIPT_VERSION = '2.0.0';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    const MAX_CACHE_SIZE = 1000;
    const OCR_CONFIDENCE_THRESHOLD = 60;
    const MANGA_BUBBLE_MIN_AREA = 100;
    const OVERLAY_Z_INDEX = 999999;

    // AI Provider configurations
    const AI_PROVIDERS = {
        openai: {
            name: 'OpenAI GPT',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo',
            headers: (apiKey) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            })
        },
        claude: {
            name: 'Anthropic Claude',
            endpoint: 'https://api.anthropic.com/v1/messages',
            model: 'claude-3-haiku-20240307',
            headers: (apiKey) => ({
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            })
        },
        gemini: {
            name: 'Google Gemini',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
            model: 'gemini-pro',
            headers: (apiKey) => ({
                'Content-Type': 'application/json'
            })
        }
    };

    // ==================== UTILITY CLASSES ====================

    class Logger {
        static log(message, level = 'info') {
            const timestamp = new Date().toISOString();
            console.log(`[King Translator v${SCRIPT_VERSION}] [${level.toUpperCase()}] ${timestamp}: ${message}`);
        }

        static error(message, error = null) {
            this.log(message, 'error');
            if (error) console.error(error);
        }

        static warn(message) {
            this.log(message, 'warn');
        }

        static debug(message) {
            this.log(message, 'debug');
        }
    }

    class Storage {
        static get(key, defaultValue = null) {
            try {
                const value = GM_getValue(key, defaultValue);
                return value;
            } catch (error) {
                Logger.error(`Failed to get storage value for key: ${key}`, error);
                return defaultValue;
            }
        }

        static set(key, value) {
            try {
                GM_setValue(key, value);
                return true;
            } catch (error) {
                Logger.error(`Failed to set storage value for key: ${key}`, error);
                return false;
            }
        }

        static delete(key) {
            try {
                GM_deleteValue(key);
                return true;
            } catch (error) {
                Logger.error(`Failed to delete storage value for key: ${key}`, error);
                return false;
            }
        }
    }

    class Cache {
        constructor() {
            this.cache = new Map();
            this.loadFromStorage();
        }

        loadFromStorage() {
            try {
                const cached = Storage.get('translation_cache', '{}');
                const data = JSON.parse(cached);

                Object.entries(data).forEach(([key, value]) => {
                    if (this.isValidCacheEntry(value)) {
                        this.cache.set(key, value);
                    }
                });

                this.cleanExpired();
            } catch (error) {
                Logger.error('Failed to load cache from storage', error);
            }
        }

        saveToStorage() {
            try {
                const data = Object.fromEntries(this.cache);
                Storage.set('translation_cache', JSON.stringify(data));
            } catch (error) {
                Logger.error('Failed to save cache to storage', error);
            }
        }

        isValidCacheEntry(entry) {
            return entry &&
                   entry.translation &&
                   entry.timestamp &&
                   (Date.now() - entry.timestamp) < CACHE_EXPIRY;
        }

        get(key) {
            const entry = this.cache.get(key);
            if (entry && this.isValidCacheEntry(entry)) {
                return entry.translation;
            }
            this.cache.delete(key);
            return null;
        }

        set(key, translation) {
            if (this.cache.size >= MAX_CACHE_SIZE) {
                this.cleanOldest();
            }

            this.cache.set(key, {
                translation,
                timestamp: Date.now()
            });

            this.saveToStorage();
        }

        cleanExpired() {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (!this.isValidCacheEntry(entry)) {
                    this.cache.delete(key);
                }
            }
        }

        cleanOldest() {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
            toDelete.forEach(([key]) => this.cache.delete(key));
        }

        clear() {
            this.cache.clear();
            Storage.delete('translation_cache');
        }
    }

    // ==================== CORE CLASSES ====================

    class AITranslator {
        constructor() {
            this.cache = new Cache();
            this.currentProvider = Storage.get('ai_provider', 'openai');
            this.apiKeys = this.loadApiKeys();
        }

        loadApiKeys() {
            return {
                openai: Storage.get('openai_api_key', ''),
                claude: Storage.get('claude_api_key', ''),
                gemini: Storage.get('gemini_api_key', '')
            };
        }

        setApiKey(provider, key) {
            this.apiKeys[provider] = key;
            Storage.set(`${provider}_api_key`, key);
        }

        setProvider(provider) {
            if (AI_PROVIDERS[provider]) {
                this.currentProvider = provider;
                Storage.set('ai_provider', provider);
                return true;
            }
            return false;
        }

        async translate(text, sourceLanguage = 'auto') {
            if (!text || text.trim().length === 0) {
                return '';
            }

            // Check cache first
            const cacheKey = `${sourceLanguage}-${TARGET_LANGUAGE}-${text}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                Logger.debug('Translation found in cache');
                return cached;
            }

            try {
                const translation = await this.performTranslation(text, sourceLanguage);
                if (translation) {
                    this.cache.set(cacheKey, translation);
                    return translation;
                }
            } catch (error) {
                Logger.error('Translation failed', error);
                throw error;
            }

            return text; // Return original if translation fails
        }

        async performTranslation(text, sourceLanguage) {
            const provider = AI_PROVIDERS[this.currentProvider];
            const apiKey = this.apiKeys[this.currentProvider];

            if (!apiKey) {
                throw new Error(`API key not set for ${provider.name}`);
            }

            const prompt = this.buildTranslationPrompt(text, sourceLanguage);

            switch (this.currentProvider) {
                case 'openai':
                    return await this.translateWithOpenAI(prompt, apiKey);
                case 'claude':
                    return await this.translateWithClaude(prompt, apiKey);
                case 'gemini':
                    return await this.translateWithGemini(prompt, apiKey);
                default:
                    throw new Error(`Unsupported provider: ${this.currentProvider}`);
            }
        }

        buildTranslationPrompt(text, sourceLanguage) {
            return `Translate the following text to English. Only return the translation, no explanations or additional text.

Source text: "${text}"

Translation:`;
        }

        async translateWithOpenAI(prompt, apiKey) {
            const provider = AI_PROVIDERS.openai;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: provider.endpoint,
                    headers: provider.headers(apiKey),
                    data: JSON.stringify({
                        model: provider.model,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        max_tokens: 1000,
                        temperature: 0.3
                    }),
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.choices && data.choices[0] && data.choices[0].message) {
                                resolve(data.choices[0].message.content.trim());
                            } else {
                                reject(new Error('Invalid response format from OpenAI'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onerror: (error) => reject(error),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        }

        async translateWithClaude(prompt, apiKey) {
            const provider = AI_PROVIDERS.claude;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: provider.endpoint,
                    headers: provider.headers(apiKey),
                    data: JSON.stringify({
                        model: provider.model,
                        max_tokens: 1000,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ]
                    }),
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.content && data.content[0] && data.content[0].text) {
                                resolve(data.content[0].text.trim());
                            } else {
                                reject(new Error('Invalid response format from Claude'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onerror: (error) => reject(error),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        }

        async translateWithGemini(prompt, apiKey) {
            const provider = AI_PROVIDERS.gemini;
            const url = `${provider.endpoint}?key=${apiKey}`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: provider.headers(apiKey),
                    data: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: prompt
                                    }
                                ]
                            }
                        ]
                    }),
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.candidates && data.candidates[0] &&
                                data.candidates[0].content && data.candidates[0].content.parts[0]) {
                                resolve(data.candidates[0].content.parts[0].text.trim());
                            } else {
                                reject(new Error('Invalid response format from Gemini'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onerror: (error) => reject(error),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        }
    }

    class OCREngine {
        constructor() {
            this.worker = null;
            this.isInitialized = false;
        }

        async initialize() {
            if (this.isInitialized) return;

            try {
                this.worker = await Tesseract.createWorker();
                await this.worker.loadLanguage('eng+jpn+kor+chi_sim+chi_tra');
                await this.worker.initialize('eng+jpn+kor+chi_sim+chi_tra');

                // Optimize for manga/comic text
                await this.worker.setParameters({
                    tessedit_char_whitelist: '',
                    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
                    preserve_interword_spaces: '1'
                });

                this.isInitialized = true;
                Logger.log('OCR engine initialized successfully');
            } catch (error) {
                Logger.error('Failed to initialize OCR engine', error);
                throw error;
            }
        }

        async extractText(imageData, options = {}) {
            if (!this.isInitialized) {
                await this.initialize();
            }

            try {
                const { data } = await this.worker.recognize(imageData, {
                    rectangle: options.rectangle
                });

                // Filter results by confidence for manga optimization
                const filteredText = data.words
                    .filter(word => word.confidence > OCR_CONFIDENCE_THRESHOLD)
                    .map(word => word.text)
                    .join(' ')
                    .trim();

                Logger.debug(`OCR extracted text: "${filteredText}" (confidence: ${data.confidence})`);
                return filteredText;
            } catch (error) {
                Logger.error('OCR text extraction failed', error);
                return '';
            }
        }

        async detectTextRegions(imageData) {
            if (!this.isInitialized) {
                await this.initialize();
            }

            try {
                const { data } = await this.worker.recognize(imageData);

                // Extract text regions optimized for manga bubbles
                const regions = data.words
                    .filter(word => word.confidence > OCR_CONFIDENCE_THRESHOLD)
                    .map(word => ({
                        text: word.text,
                        bbox: word.bbox,
                        confidence: word.confidence
                    }));

                // Group nearby words into text blocks (manga bubble detection)
                const textBlocks = this.groupWordsIntoBlocks(regions);

                return textBlocks.filter(block =>
                    this.calculateArea(block.bbox) > MANGA_BUBBLE_MIN_AREA
                );
            } catch (error) {
                Logger.error('Text region detection failed', error);
                return [];
            }
        }

        groupWordsIntoBlocks(words) {
            const blocks = [];
            const processed = new Set();

            words.forEach((word, index) => {
                if (processed.has(index)) return;

                const block = {
                    text: word.text,
                    bbox: { ...word.bbox },
                    confidence: word.confidence,
                    wordCount: 1
                };

                // Find nearby words to group together
                words.forEach((otherWord, otherIndex) => {
                    if (otherIndex === index || processed.has(otherIndex)) return;

                    if (this.areWordsNearby(word.bbox, otherWord.bbox)) {
                        block.text += ' ' + otherWord.text;
                        block.bbox = this.mergeBoundingBoxes(block.bbox, otherWord.bbox);
                        block.confidence = Math.min(block.confidence, otherWord.confidence);
                        block.wordCount++;
                        processed.add(otherIndex);
                    }
                });

                processed.add(index);
                blocks.push(block);
            });

            return blocks;
        }

        areWordsNearby(bbox1, bbox2, threshold = 50) {
            const centerX1 = bbox1.x0 + (bbox1.x1 - bbox1.x0) / 2;
            const centerY1 = bbox1.y0 + (bbox1.y1 - bbox1.y0) / 2;
            const centerX2 = bbox2.x0 + (bbox2.x1 - bbox2.x0) / 2;
            const centerY2 = bbox2.y0 + (bbox2.y1 - bbox2.y0) / 2;

            const distance = Math.sqrt(
                Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2)
            );

            return distance < threshold;
        }

        mergeBoundingBoxes(bbox1, bbox2) {
            return {
                x0: Math.min(bbox1.x0, bbox2.x0),
                y0: Math.min(bbox1.y0, bbox2.y0),
                x1: Math.max(bbox1.x1, bbox2.x1),
                y1: Math.max(bbox1.y1, bbox2.y1)
            };
        }

        calculateArea(bbox) {
            return (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0);
        }

        async terminate() {
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
                this.isInitialized = false;
            }
        }
    }

    class OverlayManager {
        constructor(translator) {
            this.translator = translator;
            this.overlays = new Map();
            this.isEnabled = Storage.get('overlay_enabled', true);
            this.setupStyles();
        }

        setupStyles() {
            GM_addStyle(`
                .king-translator-overlay {
                    position: absolute;
                    background: rgba(0, 0, 0, 0.85);
                    color: #ffffff;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    line-height: 1.4;
                    max-width: 300px;
                    word-wrap: break-word;
                    z-index: ${OVERLAY_Z_INDEX};
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(4px);
                    opacity: 0;
                    transform: scale(0.9);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }

                .king-translator-overlay.visible {
                    opacity: 1;
                    transform: scale(1);
                }

                .king-translator-overlay.loading {
                    background: rgba(0, 100, 200, 0.85);
                }

                .king-translator-overlay.error {
                    background: rgba(200, 50, 50, 0.85);
                }

                .king-translator-overlay::before {
                    content: '';
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-bottom: 6px solid rgba(0, 0, 0, 0.85);
                }

                .king-translator-original {
                    position: relative;
                    cursor: pointer;
                }

                .king-translator-original:hover {
                    background-color: rgba(255, 255, 0, 0.2);
                }

                .king-translator-loading-spinner {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: #ffffff;
                    animation: king-translator-spin 1s ease-in-out infinite;
                    margin-right: 6px;
                }

                @keyframes king-translator-spin {
                    to { transform: rotate(360deg); }
                }

                .king-translator-manga-region {
                    position: absolute;
                    border: 2px dashed #00ff00;
                    background: rgba(0, 255, 0, 0.1);
                    pointer-events: none;
                    z-index: ${OVERLAY_Z_INDEX - 1};
                }
            `);
        }

        async createOverlay(element, text, position = null) {
            if (!this.isEnabled || !text || text.trim().length === 0) {
                return null;
            }

            const overlayId = this.generateOverlayId(element, text);

            // Remove existing overlay if present
            this.removeOverlay(overlayId);

            // Create overlay element
            const overlay = document.createElement('div');
            overlay.className = 'king-translator-overlay loading';
            overlay.innerHTML = `<span class="king-translator-loading-spinner"></span>Translating...`;

            // Position overlay
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            if (position) {
                overlay.style.left = `${position.x + scrollLeft}px`;
                overlay.style.top = `${position.y + scrollTop}px`;
            } else {
                overlay.style.left = `${rect.left + scrollLeft + rect.width / 2}px`;
                overlay.style.top = `${rect.top + scrollTop - 10}px`;
                overlay.style.transform = 'translateX(-50%) translateY(-100%)';
            }

            document.body.appendChild(overlay);

            // Trigger animation
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
            });

            this.overlays.set(overlayId, {
                element: overlay,
                originalElement: element,
                text: text
            });

            try {
                // Perform translation
                const translation = await this.translator.translate(text);

                // Update overlay with translation
                overlay.className = 'king-translator-overlay visible';
                overlay.textContent = translation;

                return overlay;
            } catch (error) {
                Logger.error('Translation failed for overlay', error);
                overlay.className = 'king-translator-overlay visible error';
                overlay.textContent = 'Translation failed';
                return overlay;
            }
        }

        generateOverlayId(element, text) {
            return `overlay_${element.tagName}_${text.substring(0, 20).replace(/\s+/g, '_')}`;
        }

        removeOverlay(overlayId) {
            const overlay = this.overlays.get(overlayId);
            if (overlay) {
                overlay.element.remove();
                this.overlays.delete(overlayId);
            }
        }

        removeAllOverlays() {
            this.overlays.forEach((overlay, id) => {
                overlay.element.remove();
            });
            this.overlays.clear();
        }

        setEnabled(enabled) {
            this.isEnabled = enabled;
            Storage.set('overlay_enabled', enabled);

            if (!enabled) {
                this.removeAllOverlays();
            }
        }

        async createMangaOverlays(imageElement, textRegions) {
            if (!this.isEnabled || !textRegions || textRegions.length === 0) {
                return;
            }

            const imageRect = imageElement.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            for (const region of textRegions) {
                if (region.text && region.text.trim().length > 0) {
                    // Calculate position relative to image
                    const x = imageRect.left + scrollLeft + (region.bbox.x0 / imageElement.naturalWidth) * imageRect.width;
                    const y = imageRect.top + scrollTop + (region.bbox.y0 / imageElement.naturalHeight) * imageRect.height;

                    await this.createOverlay(imageElement, region.text, { x, y });
                }
            }
        }
    }

    class MangaTranslator {
        constructor(translator, ocrEngine, overlayManager) {
            this.translator = translator;
            this.ocrEngine = ocrEngine;
            this.overlayManager = overlayManager;
            this.isEnabled = Storage.get('manga_mode_enabled', false);
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('click', this.handleImageClick.bind(this), true);
        }

        async handleImageClick(event) {
            if (!this.isEnabled) return;

            const target = event.target;
            if (target.tagName === 'IMG' && this.isMangaImage(target)) {
                event.preventDefault();
                event.stopPropagation();

                await this.translateImage(target);
            }
        }

        isMangaImage(img) {
            // Heuristics to detect manga/comic images
            const src = img.src.toLowerCase();
            const alt = (img.alt || '').toLowerCase();
            const className = (img.className || '').toLowerCase();

            // Check for manga-related keywords
            const mangaKeywords = ['manga', 'comic', 'page', 'chapter', 'scan'];
            const hasMangaKeywords = mangaKeywords.some(keyword =>
                src.includes(keyword) || alt.includes(keyword) || className.includes(keyword)
            );

            // Check image dimensions (manga pages are typically tall)
            const aspectRatio = img.naturalHeight / img.naturalWidth;
            const isTallImage = aspectRatio > 1.2;

            // Check if image is large enough
            const isLargeEnough = img.naturalWidth > 300 && img.naturalHeight > 400;

            return hasMangaKeywords || (isTallImage && isLargeEnough);
        }

        async translateImage(img) {
            try {
                Logger.log('Starting manga translation for image');

                // Show loading indicator
                this.showLoadingIndicator(img);

                // Extract text regions from image
                const canvas = this.imageToCanvas(img);
                const textRegions = await this.ocrEngine.detectTextRegions(canvas);

                Logger.log(`Detected ${textRegions.length} text regions`);

                // Create overlays for each text region
                await this.overlayManager.createMangaOverlays(img, textRegions);

                this.hideLoadingIndicator(img);
            } catch (error) {
                Logger.error('Manga translation failed', error);
                this.hideLoadingIndicator(img);
            }
        }

        imageToCanvas(img) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            ctx.drawImage(img, 0, 0);
            return canvas;
        }

        showLoadingIndicator(img) {
            const indicator = document.createElement('div');
            indicator.className = 'king-translator-loading-indicator';
            indicator.innerHTML = `
                <div class="king-translator-loading-spinner"></div>
                <span>Analyzing manga...</span>
            `;

            const rect = img.getBoundingClientRect();
            indicator.style.cssText = `
                position: absolute;
                top: ${rect.top + window.pageYOffset + 10}px;
                left: ${rect.left + window.pageXOffset + 10}px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                z-index: ${OVERLAY_Z_INDEX};
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            `;

            document.body.appendChild(indicator);
            img.dataset.loadingIndicator = 'true';
        }

        hideLoadingIndicator(img) {
            if (img.dataset.loadingIndicator) {
                const indicators = document.querySelectorAll('.king-translator-loading-indicator');
                indicators.forEach(indicator => indicator.remove());
                delete img.dataset.loadingIndicator;
            }
        }

        setEnabled(enabled) {
            this.isEnabled = enabled;
            Storage.set('manga_mode_enabled', enabled);
        }
    }

    class TextSelector {
        constructor(overlayManager) {
            this.overlayManager = overlayManager;
            this.isEnabled = Storage.get('text_selection_enabled', true);
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('mouseup', this.handleTextSelection.bind(this));
            document.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        }

        async handleTextSelection(event) {
            if (!this.isEnabled) return;

            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length > 0 && selectedText.length < 1000) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (rect.width > 0 && rect.height > 0) {
                    await this.overlayManager.createOverlay(
                        range.commonAncestorContainer,
                        selectedText,
                        {
                            x: rect.left + rect.width / 2,
                            y: rect.top - 10
                        }
                    );
                }
            }
        }

        async handleDoubleClick(event) {
            if (!this.isEnabled) return;

            const target = event.target;
            if (target.nodeType === Node.TEXT_NODE ||
                (target.nodeType === Node.ELEMENT_NODE && target.textContent)) {

                const text = target.textContent.trim();
                if (text.length > 0 && text.length < 500) {
                    await this.overlayManager.createOverlay(target, text);
                }
            }
        }

        setEnabled(enabled) {
            this.isEnabled = enabled;
            Storage.set('text_selection_enabled', enabled);
        }
    }

    class SettingsPanel {
        constructor(translator, overlayManager, mangaTranslator, textSelector) {
            this.translator = translator;
            this.overlayManager = overlayManager;
            this.mangaTranslator = mangaTranslator;
            this.textSelector = textSelector;
            this.panel = null;
            this.isVisible = false;

            this.registerMenuCommands();
            this.setupStyles();
        }

        registerMenuCommands() {
            GM_registerMenuCommand('Open King Translator Settings', () => {
                this.toggle();
            });

            GM_registerMenuCommand('Clear Translation Cache', () => {
                this.translator.cache.clear();
                alert('Translation cache cleared successfully!');
            });
        }

        setupStyles() {
            GM_addStyle(`
                .king-translator-settings {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 480px;
                    max-height: 80vh;
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    z-index: ${OVERLAY_Z_INDEX + 1000};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                    display: none;
                }

                .king-translator-settings.visible {
                    display: block;
                }

                .king-translator-settings-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    text-align: center;
                }

                .king-translator-settings-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0;
                }

                .king-translator-settings-version {
                    font-size: 12px;
                    opacity: 0.8;
                    margin-top: 4px;
                }

                .king-translator-settings-content {
                    padding: 24px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .king-translator-settings-section {
                    margin-bottom: 24px;
                }

                .king-translator-settings-section:last-child {
                    margin-bottom: 0;
                }

                .king-translator-settings-section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 12px;
                    padding-bottom: 6px;
                    border-bottom: 2px solid #f0f0f0;
                }

                .king-translator-settings-field {
                    margin-bottom: 16px;
                }

                .king-translator-settings-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #555;
                    margin-bottom: 6px;
                }

                .king-translator-settings-input,
                .king-translator-settings-select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid #e1e5e9;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: border-color 0.2s ease;
                    box-sizing: border-box;
                }

                .king-translator-settings-input:focus,
                .king-translator-settings-select:focus {
                    outline: none;
                    border-color: #667eea;
                }

                .king-translator-settings-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }

                .king-translator-settings-checkbox input {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .king-translator-settings-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    padding: 20px 24px;
                    background: #f8f9fa;
                    border-top: 1px solid #e9ecef;
                }

                .king-translator-settings-button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .king-translator-settings-button-primary {
                    background: #667eea;
                    color: white;
                }

                .king-translator-settings-button-primary:hover {
                    background: #5a6fd8;
                }

                .king-translator-settings-button-secondary {
                    background: #6c757d;
                    color: white;
                }

                .king-translator-settings-button-secondary:hover {
                    background: #5a6268;
                }

                .king-translator-settings-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: ${OVERLAY_Z_INDEX + 999};
                    display: none;
                }

                .king-translator-settings-overlay.visible {
                    display: block;
                }

                .king-translator-settings-help {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    line-height: 1.4;
                }
            `);
        }

        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            if (!this.panel) {
                this.createPanel();
            }

            this.loadCurrentSettings();
            this.panel.classList.add('visible');
            this.panel.querySelector('.king-translator-settings-overlay').classList.add('visible');
            this.isVisible = true;
        }

        hide() {
            if (this.panel) {
                this.panel.classList.remove('visible');
                this.panel.querySelector('.king-translator-settings-overlay').classList.remove('visible');
            }
            this.isVisible = false;
        }

        createPanel() {
            const overlay = document.createElement('div');
            overlay.className = 'king-translator-settings-overlay';
            overlay.addEventListener('click', () => this.hide());

            const panel = document.createElement('div');
            panel.className = 'king-translator-settings';
            panel.innerHTML = this.getPanelHTML();

            panel.addEventListener('click', (e) => e.stopPropagation());

            document.body.appendChild(overlay);
            document.body.appendChild(panel);

            this.panel = panel;
            this.setupEventListeners();
        }

        getPanelHTML() {
            return `
                <div class="king-translator-settings-header">
                    <h2 class="king-translator-settings-title">King Translator AI</h2>
                    <div class="king-translator-settings-version">Version ${SCRIPT_VERSION}</div>
                </div>

                <div class="king-translator-settings-content">
                    <div class="king-translator-settings-section">
                        <h3 class="king-translator-settings-section-title">AI Provider</h3>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-label">Select AI Provider</label>
                            <select class="king-translator-settings-select" id="ai-provider">
                                <option value="openai">OpenAI GPT</option>
                                <option value="claude">Anthropic Claude</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-label">OpenAI API Key</label>
                            <input type="password" class="king-translator-settings-input" id="openai-key" placeholder="sk-...">
                            <div class="king-translator-settings-help">Get your API key from https://platform.openai.com/api-keys</div>
                        </div>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-label">Claude API Key</label>
                            <input type="password" class="king-translator-settings-input" id="claude-key" placeholder="sk-ant-...">
                            <div class="king-translator-settings-help">Get your API key from https://console.anthropic.com/</div>
                        </div>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-label">Gemini API Key</label>
                            <input type="password" class="king-translator-settings-input" id="gemini-key" placeholder="AI...">
                            <div class="king-translator-settings-help">Get your API key from https://makersuite.google.com/app/apikey</div>
                        </div>
                    </div>

                    <div class="king-translator-settings-section">
                        <h3 class="king-translator-settings-section-title">Features</h3>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-checkbox">
                                <input type="checkbox" id="overlay-enabled">
                                <span>Enable overlay translations</span>
                            </label>
                            <div class="king-translator-settings-help">Show translations as overlays over original text</div>
                        </div>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-checkbox">
                                <input type="checkbox" id="text-selection-enabled">
                                <span>Enable text selection translation</span>
                            </label>
                            <div class="king-translator-settings-help">Translate selected text automatically</div>
                        </div>

                        <div class="king-translator-settings-field">
                            <label class="king-translator-settings-checkbox">
                                <input type="checkbox" id="manga-mode-enabled">
                                <span>Enable manga translation mode</span>
                            </label>
                            <div class="king-translator-settings-help">Optimized for translating manga and comic images</div>
                        </div>
                    </div>
                </div>

                <div class="king-translator-settings-buttons">
                    <button class="king-translator-settings-button king-translator-settings-button-secondary" id="cancel-btn">Cancel</button>
                    <button class="king-translator-settings-button king-translator-settings-button-primary" id="save-btn">Save Settings</button>
                </div>
            `;
        }

        setupEventListeners() {
            const saveBtn = this.panel.querySelector('#save-btn');
            const cancelBtn = this.panel.querySelector('#cancel-btn');

            saveBtn.addEventListener('click', () => this.saveSettings());
            cancelBtn.addEventListener('click', () => this.hide());
        }

        loadCurrentSettings() {
            // Load AI provider settings
            const providerSelect = this.panel.querySelector('#ai-provider');
            providerSelect.value = this.translator.currentProvider;

            // Load API keys
            this.panel.querySelector('#openai-key').value = this.translator.apiKeys.openai;
            this.panel.querySelector('#claude-key').value = this.translator.apiKeys.claude;
            this.panel.querySelector('#gemini-key').value = this.translator.apiKeys.gemini;

            // Load feature toggles
            this.panel.querySelector('#overlay-enabled').checked = this.overlayManager.isEnabled;
            this.panel.querySelector('#text-selection-enabled').checked = this.textSelector.isEnabled;
            this.panel.querySelector('#manga-mode-enabled').checked = this.mangaTranslator.isEnabled;
        }

        saveSettings() {
            try {
                // Save AI provider
                const provider = this.panel.querySelector('#ai-provider').value;
                this.translator.setProvider(provider);

                // Save API keys
                const openaiKey = this.panel.querySelector('#openai-key').value.trim();
                const claudeKey = this.panel.querySelector('#claude-key').value.trim();
                const geminiKey = this.panel.querySelector('#gemini-key').value.trim();

                if (openaiKey) this.translator.setApiKey('openai', openaiKey);
                if (claudeKey) this.translator.setApiKey('claude', claudeKey);
                if (geminiKey) this.translator.setApiKey('gemini', geminiKey);

                // Save feature settings
                this.overlayManager.setEnabled(this.panel.querySelector('#overlay-enabled').checked);
                this.textSelector.setEnabled(this.panel.querySelector('#text-selection-enabled').checked);
                this.mangaTranslator.setEnabled(this.panel.querySelector('#manga-mode-enabled').checked);

                Logger.log('Settings saved successfully');
                this.hide();

                // Show success message
                this.showNotification('Settings saved successfully!', 'success');
            } catch (error) {
                Logger.error('Failed to save settings', error);
                this.showNotification('Failed to save settings. Please try again.', 'error');
            }
        }

        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `king-translator-notification king-translator-notification-${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: ${OVERLAY_Z_INDEX + 2000};
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;

            document.body.appendChild(notification);

            // Animate in
            requestAnimationFrame(() => {
                notification.style.transform = 'translateX(0)';
            });

            // Auto remove after 3 seconds
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
    }

    // ==================== MAIN APPLICATION ====================

    class KingTranslatorApp {
        constructor() {
            this.translator = null;
            this.ocrEngine = null;
            this.overlayManager = null;
            this.mangaTranslator = null;
            this.textSelector = null;
            this.settingsPanel = null;
            this.isInitialized = false;
        }

        async initialize() {
            if (this.isInitialized) return;

            try {
                Logger.log('Initializing King Translator AI v2...');

                // Initialize core components
                this.translator = new AITranslator();
                this.ocrEngine = new OCREngine();
                this.overlayManager = new OverlayManager(this.translator);
                this.mangaTranslator = new MangaTranslator(this.translator, this.ocrEngine, this.overlayManager);
                this.textSelector = new TextSelector(this.overlayManager);
                this.settingsPanel = new SettingsPanel(
                    this.translator,
                    this.overlayManager,
                    this.mangaTranslator,
                    this.textSelector
                );

                // Setup keyboard shortcuts
                this.setupKeyboardShortcuts();

                this.isInitialized = true;
                Logger.log('King Translator AI v2 initialized successfully');

                // Show welcome message for first-time users
                if (!Storage.get('welcome_shown', false)) {
                    this.showWelcomeMessage();
                    Storage.set('welcome_shown', true);
                }

            } catch (error) {
                Logger.error('Failed to initialize King Translator AI', error);
            }
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (event) => {
                // Ctrl+Shift+T: Toggle settings panel
                if (event.ctrlKey && event.shiftKey && event.key === 'T') {
                    event.preventDefault();
                    this.settingsPanel.toggle();
                }

                // Ctrl+Shift+O: Toggle overlay translations
                if (event.ctrlKey && event.shiftKey && event.key === 'O') {
                    event.preventDefault();
                    this.overlayManager.setEnabled(!this.overlayManager.isEnabled);
                    this.settingsPanel.showNotification(
                        `Overlay translations ${this.overlayManager.isEnabled ? 'enabled' : 'disabled'}`,
                        'info'
                    );
                }

                // Ctrl+Shift+M: Toggle manga mode
                if (event.ctrlKey && event.shiftKey && event.key === 'M') {
                    event.preventDefault();
                    this.mangaTranslator.setEnabled(!this.mangaTranslator.isEnabled);
                    this.settingsPanel.showNotification(
                        `Manga mode ${this.mangaTranslator.isEnabled ? 'enabled' : 'disabled'}`,
                        'info'
                    );
                }

                // Escape: Hide all overlays
                if (event.key === 'Escape') {
                    this.overlayManager.removeAllOverlays();
                }
            });
        }

        showWelcomeMessage() {
            const message = `
Welcome to King Translator AI v2!

Features:
• Overlay translations over original text
• Manga/comic translation support
• Multiple AI providers (OpenAI, Claude, Gemini)
• Smart text selection translation

Keyboard shortcuts:
• Ctrl+Shift+T: Open settings
• Ctrl+Shift+O: Toggle overlays
• Ctrl+Shift+M: Toggle manga mode
• Escape: Hide overlays

Click on the Tampermonkey menu to access settings and configure your API keys.
            `;

            setTimeout(() => {
                alert(message);
            }, 1000);
        }

        async cleanup() {
            if (this.ocrEngine) {
                await this.ocrEngine.terminate();
            }

            if (this.overlayManager) {
                this.overlayManager.removeAllOverlays();
            }

            Logger.log('King Translator AI v2 cleaned up');
        }
    }

    // ==================== INITIALIZATION ====================

    // Initialize the application when DOM is ready
    let app = null;

    function initializeApp() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
            return;
        }

        app = new KingTranslatorApp();
        app.initialize().catch(error => {
            Logger.error('Failed to initialize application', error);
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (app) {
            app.cleanup();
        }
    });

    // Start the application
    initializeApp();

})();
