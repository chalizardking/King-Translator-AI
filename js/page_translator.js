class PageTranslator {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.MIN_TEXT_LENGTH = 100;
      this.originalTexts = new Map();
      this.isTranslated = false;
      this.languageCode = this.detectLanguage().languageCode;
      this.pageCache = new Map();
      this.pdfLoaded = true;
      this.pageObserver = null;
      this.sentinelContainer = null;
      this.allTextNodes = [];
    }
    parseFaultyJSON(jsonString) {
      let cleanString = jsonString.trim();
      const markdownMatch = cleanString.match(/```json\s*([\s\S]*?)\s*```/);
      if (markdownMatch && markdownMatch[1]) {
        cleanString = markdownMatch[1].trim();
      }
      try {
        const parsed = JSON.parse(cleanString);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn("Could not parse the whole JSON string, attempting to parse line by line.", e.message);
      }
      const objects = [];
      const lines = cleanString.split('\n');
      let currentObjectStr = '';
      lines.forEach(line => {
        currentObjectStr += line;
        try {
          if (line.trim().endsWith('},') || line.trim().endsWith('}')) {
            const objectToParse = currentObjectStr.trim().endsWith(',')
              ? currentObjectStr.trim().slice(0, -1)
              : currentObjectStr.trim();
            const parsed = JSON.parse(objectToParse);
            if (typeof parsed.id === 'number' && parsed.translation) {
              objects.push(parsed);
            }
            currentObjectStr = '';
          }
        } catch (e) {
        }
      });
      return objects;
    }
    async translatePage() {
      try {
        if (this.isTranslated) {
          if (this.pageObserver) this.pageObserver.disconnect();
          if (this.sentinelContainer) this.sentinelContainer.remove();
          if (this.domObserver) this.domObserver.disconnect();
          this.pageObserver = this.sentinelContainer = this.domObserver = null;
          await Promise.all(
            Array.from(this.originalTexts.entries()).map(async ([node, originalText]) => {
              if (node && (node.parentNode || document.contains(node))) {
                node.textContent = originalText;
              }
            })
          );
          this.originalTexts.clear();
          this.allTextNodes = [];
          this.isTranslated = false;
          return {
            success: true,
            message: this._("notifications.page_reverted_to_original")
          };
        }
        if (this.pageObserver) this.pageObserver.disconnect();
        this.allTextNodes = this.collectTextNodes();
        if (this.allTextNodes.length === 0) {
          return {
            success: false,
            message: this._("notifications.no_content_to_translate")
          };
        }
        this.translator.ui.showNotification(this._("notifications.page_translate_loading"), "info");
        const pageHeight = document.documentElement.scrollHeight;
        const NUM_SECTIONS = Math.max(10, Math.min(50, Math.floor(pageHeight / 800)));
        const sectionHeight = pageHeight / NUM_SECTIONS;
        if (this.sentinelContainer) this.sentinelContainer.remove();
        this.sentinelContainer = document.createElement('div');
        this.sentinelContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 1px; height: 100%; pointer-events: none; z-index: -1;';
        document.body.appendChild(this.sentinelContainer);
        const sentinels = [];
        for (let i = 0; i < NUM_SECTIONS; i++) {
          const sentinel = document.createElement('div');
          sentinel.style.cssText = `position: absolute; top: ${i * sectionHeight}px; height: 1px; width: 1px;`;
          sentinel.dataset.sectionIndex = i;
          this.sentinelContainer.appendChild(sentinel);
          sentinels.push(sentinel);
        }
        let translatedSections = new Set();
        const translateRemainingNodes = async () => {
          if (this.pageObserver) {
            this.pageObserver.disconnect();
            this.pageObserver = null;
          }
          const remainingNodes = this.allTextNodes.filter(node => !this.originalTexts.has(node));
          if (remainingNodes.length > 0) {
            console.log(`[Final Sweep] Found ${remainingNodes.length} remaining text nodes to translate.`);
            const chunks = this.createChunks(remainingNodes, 2000);
            await Promise.all(chunks.map(chunk => this.translateChunkWithRetries(chunk)))
              .catch(err => console.error("Error during final sweep translation:", err));
          }
          this.translator.ui.showNotification(this._("notifications.page_translated_success"), "success");
          if (!this.domObserver) {
            this.setupDOMObserver();
          }
        };
        this.pageObserver = new IntersectionObserver(
          (entries) => {
            let needsFinalSweep = false;
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const sentinel = entry.target;
                const sectionIndex = parseInt(sentinel.dataset.sectionIndex, 10);
                if (translatedSections.has(sectionIndex)) continue;
                this.pageObserver.unobserve(sentinel);
                translatedSections.add(sectionIndex);
                const startY = sectionIndex * sectionHeight;
                const isLastSection = sectionIndex === NUM_SECTIONS - 1;
                const endY = isLastSection ? Infinity : startY + sectionHeight;
                const nodesForThisSection = this.allTextNodes.filter(node => {
                  if (!node.parentElement || this.originalTexts.has(node)) return false;
                  const rect = node.parentElement.getBoundingClientRect();
                  const nodeY = rect.top + window.scrollY;
                  return nodeY >= startY && nodeY < endY;
                });
                if (nodesForThisSection.length > 0) {
                  const chunks = this.createChunks(nodesForThisSection, 2000);
                  Promise.all(chunks.map(chunk => this.translateChunkWithRetries(chunk)))
                    .catch(err => console.error("Error translating chunk in observer:", err));
                }
              }
              if (translatedSections.size >= NUM_SECTIONS) {
                needsFinalSweep = true;
              }
            }
            if (needsFinalSweep) {
              translateRemainingNodes();
            }
          }, {
          rootMargin: "100% 0px",
          threshold: 0.01,
        });
        sentinels.forEach(s => this.pageObserver.observe(s));
        this.isTranslated = true;
        return { success: true, message: this._("notifications.translating") };
      } catch (error) {
        console.error("Page translation error:", error);
        this.isTranslated = false;
        return { success: false, message: error.message };
      }
    }
    getExcludeSelectors() {
      const settings = this.settings.pageTranslation;
      if (!settings.useCustomSelectors) {
        return settings.defaultSelectors;
      }
      return settings.combineWithDefault
        ? [
          ...new Set([
            ...settings.defaultSelectors,
            ...settings.customSelectors
          ])
        ]
        : settings.customSelectors;
    }
    async makeTranslationRequest(text) {
      const settings = this.settings;
      const apiKeys = settings.apiKey[settings.apiProvider];
      const key = apiKeys[Math.floor(Math.random() * apiKeys.length)];;
      const prompt =
        "Detect language of this text and return only ISO code (e.g. 'en', 'vi'): \n" +
        text;
      return await this.translator.api.makeApiRequest(key, prompt, 'page');
    }
    async detectLanguageBackup(text) {
      try {
        const response = await this.makeTranslationRequest(text);
        return response.trim().toLowerCase();
      } catch (error) {
        console.error("Backup language detection failed:", error);
        return 'auto';
      }
    }
    async detectLanguage() {
      let text = "";
      try {
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
          throw new Error(this._("notifications.no_content_for_lang_detect"));
        }
        const data = await new Promise((resolve, reject) => {
          fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`)
            .then(response => response.json())
            .then(data => resolve(data))
            .catch(error => reject(new Error("Request failed: " + error.message)));
        });
        const detectedCode = data[2] || data[8][0] || data[8][3];
        const confidence = data[6] || data[8][2] || 0;
        if (!detectedCode || confidence < 0.5) {
          return await this.detectLanguageBackup(text);
        }
        this.languageCode = detectedCode;
        console.log(`${this._("notifications.lang_detect")}: ${this.languageCode} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`);
        const targetLanguage = this.settings.displayOptions.targetLanguage;
        if (this.languageCode === targetLanguage) {
          return {
            isTargetLanguage: true,
            languageCode: this.languageCode,
            confidence: confidence,
            message: `${this._("notifications.page_already_target_lang")}: ${targetLanguage} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`
          };
        }
        return {
          isTargetLanguage: false,
          languageCode: this.languageCode,
          confidence: confidence,
          message: `${this._("notifications.lang_detect")}: ${this.languageCode} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`
        };
      } catch (error) {
        console.error("Language detection error:", error);
        return await this.detectLanguageBackup(text);
      }
    }
}
