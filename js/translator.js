class Translator {
    constructor() {
      // This will be mostly empty, or just initialize some properties
    }

    async init() {
      if (window.translatorInstance) {
        window.translatorInstance.cleanup();
        window.translatorInstance = null;
      }
      window.translator = this;
      this.userSettings = new UserSettings(this);
      await this.userSettings.init();
      this._ = this.userSettings._;
      const apiConfig = {
        ...CONFIG.API,
        currentProvider: this.userSettings.getSetting("apiProvider"),
        apiKey: this.userSettings.getSetting("apiKey")
      };
      this.cache = new PersistentCache('textCache', this.userSettings.settings.cacheOptions.text.maxSize, this.userSettings.settings.cacheOptions.text.expirationTime);
      this.imageCache = new PersistentCache('imageCache', this.userSettings.settings.cacheOptions.image.maxSize, this.userSettings.settings.cacheOptions.image.expirationTime);
      this.mediaCache = new PersistentCache('mediaCache', this.userSettings.settings.cacheOptions.media.maxSize, this.userSettings.settings.cacheOptions.media.expirationTime);
      this.ttsCache = new PersistentCache('ttsCache', this.userSettings.settings.cacheOptions.tts.maxSize, this.userSettings.settings.cacheOptions.tts.expirationTime);
      await this.cache.init();
      await this.imageCache.init();
      await this.mediaCache.init();
      await this.ttsCache.init();
      this.uiRoot = new UIRoot(this);
      this.fileProcess = new FileProcessor(this);
      this.videoStreaming = new VideoStreamingTranslator(this);
      this.api = new APIManager(apiConfig, () => this.userSettings.settings, this.userSettings._);
      this.page = new PageTranslator(this);
      this.input = new InputTranslator(this);
      this.ocr = new OCRManager(this);
      this.media = new MediaManager(this);
      this.fileManager = new FileManager(this);
      this.ui = new UIManager(this);
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
        console.log('prompt: ', prompt);
        let translatedText;
        const cacheEnabled =
          this.userSettings.settings.cacheOptions.text.enabled;
        if (cacheEnabled) {
          translatedText = await this.cache.get(text, isAdvanced, targetLanguage);
        }
        if (!translatedText) {
          translatedText = await this.api.request(prompt, 'page');
          if (cacheEnabled && translatedText) {
            await this.cache.set(text, translatedText, isAdvanced, targetLanguage);
          }
        }
        if (
          translatedText &&
          targetElement &&
          !targetElement.isPDFTranslation
        ) {
          if (isAdvanced || popup) {
            if (settings.translationMode !== "translation_only") {
              const translations = translatedText.split("\n");
              let fullTranslation = "";
              let pinyin = "";
              for (const trans of translations) {
                const parts = trans.split("<|>");
                pinyin += (parts[1] || "") + "\n";
                fullTranslation += (parts[2] || trans.replace("<|>", "")) + "\n";
              }
              this.ui.displayPopup(
                fullTranslation,
                text,
                "King1x32 <3",
                pinyin
              );
            } else {
              this.ui.displayPopup(translatedText, '', "King1x32 <3");
            }
          } else {
            this.ui.showTranslationBelow(translatedText, targetElement, text);
          }
        }
        return translatedText;
      } catch (error) {
        console.error("Error translation:", error);
        this.ui.showNotification(error.message, "error");
      }
    }
    async translateFile(file) {
      try {
        if (!this.fileManager.isValidFormat(file)) {
          throw new Error(this._("notifications.unsupport_file") + ' txt, srt, vtt, pdf, html, md, json');
        }
        if (!this.fileManager.isValidSize(file)) {
          throw new Error(this._("notifications.file_too_large"));
        }
        return await this.fileManager.processFile(file);
      } catch (error) {
        throw new Error(this._("notifications.file_translation_error") + ` ${error.message}`);
      }
    }
    createPrompt(text, type = "normal", targetLang = "") {
      const docTitle = `"${document.title}"`;
      const settings = this.userSettings.settings;
      const targetLanguage =
        targetLang || settings.displayOptions.targetLanguage;
      const sourceLanguage = settings.displayOptions.sourceLanguage === 'auto' ? this.page.languageCode : settings.displayOptions.sourceLanguage;
      const isPinyinMode =
        settings.displayOptions.translationMode !== "translation_only";
      if (
        settings.promptSettings?.enabled &&
        settings.promptSettings?.useCustom
      ) {
        const prompts = settings.promptSettings.customPrompts;
        const promptKey = isPinyinMode ? `${type}_chinese` : type;
        let promptTemplate = prompts[promptKey];
        if (promptTemplate) {
          return promptTemplate
            .replace(/{text}/g, text)
            .replace(/{docTitle}/g, docTitle)
            .replace(/{targetLang}/g, targetLanguage)
            .replace(
              /{sourceLang}/g,
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
      const docTitle = `and title "${document.title}"` || '';
      const settings = this.userSettings.settings;
      const targetLanguage = targetLang || settings.displayOptions.targetLanguage;
      const share_per = `  - Target language: '${targetLanguage}'.
  - Based on the context, the context ${docTitle} to determine the translation style.
  - Make sure the meaning of the sentences is not changed when translating.
  - Use slang or common phrases when necessary to make the translation more accessible to the reader.
  - Check spelling and grammar in the translation.
  - Add language particles with the language code '${targetLanguage}' when needed to make the sentence more complete.
  - Use personal pronouns in the language with the language code '${targetLanguage}' naturally and appropriately.
`;
      const share_normal = `You are a professional translator, specializing in creating accurate and natural translations. Please translate the text to be processed ${docTitle} into the language with the language code '${targetLanguage}' with the following requirements:
  - Target language: '${targetLanguage}'.
  - Based on the context, the context ${docTitle} to determine the translation style.
  - The translation must strictly adhere to the original context and nuance of the text.
  - Ensure fluency and naturalness as a native speaker.
  - Do not add any explanation or interpretation other than the translation.
  - Preserve terminology and proper nouns on a 1:1 basis.
If you find that the text is a story, please translate the story according to the following requirements:
  You are a professional story translator, specializing in creating accurate and natural translations. You need to translate a story ${docTitle} into a language with the language code '${targetLanguage}'. Please ensure that your translation preserves the meaning of the original sentence and is appropriate to the style of the target language. When translating, pay attention to the cultural context and the context of the story so that the reader can understand the content correctly. The important rules you need to follow include:
${share_per}
`;
      const note_normal = `Note:
  - The translation must be entirely in the language with the language code '${targetLanguage}'.
  - Please print the translation without quotation marks, keep the original font format and do not explain further.
`;
      const share_text = `Text to translate:
\`\`\`
  ${text}
\`\`\`
`;
      const share_ocr = `You are a professional story translator, specializing in creating accurate and natural translations. You need to translate a story ${docTitle} into a language with the language code '${targetLanguage}'. Please ensure that your translation preserves the meaning of the original sentence and is appropriate to the style of the target language. When translating, pay attention to the cultural context and the context of the story so that the reader can understand the content correctly. The important rules you need to follow include:
${share_per}
`;
      const share_media = `You are a professional movie subtitle translator, specializing in creating SRT files. You need to translate a movie dialogue ${docTitle} into a language with the language code '${targetLanguage}'. Please ensure that your translation is accurate and natural, preserving the meaning of the original sentence. When translating, pay attention to the cultural context and the context of the movie so that the viewer can understand the content correctly. The important rules you need to follow include:
${share_per}
`;
      const share_pinyin = `
Please return in the following format, with each part separated by a <|> and no further explanation:
  Original text <|> IPA phonetic transcription <|> translation into the language with the language code '${targetLanguage}'
  Example: Hello <|> heˈloʊ <|> Hello
`;
      const note_pinyin = `Note:
  - If there is a Chinese word, please return the phonetic value of that word, which is pinyin + the tone number (1-4) of that word. Example: 你好 <|> Nǐ3 hǎo3 <|> Hello
  - The translation must be entirely in the language with the language code '${targetLanguage}'.
  - Only return the translation in the above format, each cluster in the format will be on one line, keep the original font format and do not explain further.
`;
      const basePrompts = {
        normal: `${share_normal}
${note_normal}
${share_text}`,
        advanced: `Translate and analyze keywords: ${text}`,
        ocr: `${share_ocr}
Note:
  - The translation must be entirely in the language with the language code '${targetLanguage}'.
  - Read carefully and process all the text in the image.
  - Return only the translation, no explanation.`,
        media: `${share_media}
Note:
  - The translation must be entirely in the language with the language code '${targetLanguage}'.
  - Format your translation in SRT format and make sure that each dialogue has at least 4 lines including the numbered line, the line with clear start and end times, the translated content line and a blank line to separate the dialogue sequence numbers above.
  - Return only the translation, no explanation.`,
        page: `You are a professional translator, specializing in processing HTML text snippets. You will receive a JSON string containing an array of objects, each with an "id" (index) and "text" (content to be translated).\n
Your task is to translate the "text" field of EACH object into the language with the code '${targetLanguage}'.\n
MANDATORY rules:
1.  **Output format:** Your response MUST be a SINGLE valid JSON string, containing an array of objects.
2.  **Object structure:** Each object in the returned array MUST contain two fields: "id" (integer, preserved from the input) and "translation" (string, the translated text).
3.  **Data integrity:** DO NOT omit, merge, or change the order of any "id" from the input. The number of objects in the output array MUST be equal to the number of objects in the input array.
4.  **No extraneous content:** Your response must NOT contain any text, explanations, notes, or markdown formatting (like \`\`\`json) outside the JSON string.\n
Translation quality requirements:
-   Target language: '${targetLanguage}'.
-   Use a natural style, appropriate to the context of the web page with the title ${docTitle}.
\nExample input:
\`\`\`json
[
  {"id": 0, "text": "Hello world"},
  {"id": 1, "text": "This is a test."}
]
\`\`\`
\nExample desired output (translating to 'es'):
\`\`\`json
[
  {"id": 0, "translation": "Hola mundo"},
  {"id": 1, "translation": "Esto es una prueba."}
]
\`\`\`
\nNow, please process the following JSON string:
${text}`,
        page_fallback: `Please translate the following text into the language with the code '${targetLanguage}'. Return only the translation, without any additional explanations or formatting.
${share_text}`,
        file_content: `You are a professional translation assistant. Please translate the content of this file into the language with the code '${targetLanguage}'. Provide a comprehensive and accurate translation of the entire document/media content, preserving all important information and structure.
Note:
- Return only the complete translation without any explanations, titles, or additional text.
- Ensure the translation has a style appropriate to the content type of the file (e.g., formal for documents, conversational for audio/video).`,
      };
      const pinyinPrompts = {
        normal: `${share_normal}
${share_pinyin}
${note_pinyin}
${share_text}`,
        advanced: `Translate and analyze keywords: ${text}`,
        ocr: `${share_ocr}
${share_pinyin}
${note_pinyin}
Read carefully and process all the text in the image.`,
        media: `${share_media}
Note:
  - The translation must be entirely in the language with the language code '${targetLanguage}'.
  - Format your translation in SRT format and make sure that each dialogue has at least 4 lines including the numbered line, the line with clear start and end times, the translated content line and a blank line to separate the dialogue sequence numbers above.
  - Return only the translation, no explanation.`,
        page: `You are a deep language translator. You will receive a JSON string containing an array of objects, each with an "id" and "text".\n
Your task is to process EACH object and return: the original text, the IPA phonetic transcription (or Pinyin for Chinese), and the translation into the language with the code '${targetLanguage}'.\n
MANDATORY rules:
1.  **Output format:** Your response MUST be a SINGLE valid JSON string, containing an array of objects.
2.  **Object structure:** Each object in the returned array MUST contain four fields: "id" (preserved), "original" (original text), "ipa" (phonetic transcription), and "translation" (translation).
3.  **Data integrity:** DO NOT omit, merge, or change the order of any "id". The number of objects returned MUST be equal to the number of objects in the input.
4.  **No extraneous content:** Your response must NOT contain any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON string.
5.  **Phonetic transcription rules:**
    -   For Chinese: "ipa" must be Pinyin with tone marks (e.g., "Nǐ hǎo").
    -   For other languages: "ipa" must be IPA phonetic transcription (e.g., "həˈloʊ").
\nExample input:
\`\`\`json
[
  {"id": 0, "text": "Hello world"},
  {"id": 1, "text": "你好"}
]
\`\`\`
\nExample desired output (translating to 'es'):
\`\`\`json
[
  {"id": 0, "original": "Hello world", "ipa": "həˈloʊ wɜːrld", "translation": "Hola mundo"},
  {"id": 1, "original": "你好", "ipa": "Nǐ hǎo", "translation": "Hola"}
]
\`\`\`
\nNow, please process the following JSON string:
${text}`,
        page_fallback: `Please provide the original text, phonetic transcription, and translation into '${targetLanguage}' for the following text.
- For Chinese, the phonetic transcription is Pinyin with tone marks.
- For other languages, the phonetic transcription is IPA.
- Respond in the strict format: Original text <|> Phonetic transcription <|> Translation
- DO NOT add any explanations.
${share_text}`,
        file_content: `You are a professional translation assistant. Please translate the content of this file into the language with the code '${targetLanguage}'. Provide a comprehensive and accurate translation of the entire document/media content, preserving all important information and structure.
Please return in the following format, with each part separated by a <|> and no further explanation:
Original text <|> IPA phonetic transcription <|> translation into the language with the language code '${targetLanguage}'
Note:
- If there is a Chinese word, please return the phonetic value of that word, which is pinyin + the tone number (1-4) of that word.
- Return only the complete translation in the above format without any explanations, titles, or additional text.
- Ensure the translation has a style appropriate to the content type of the file (e.g., formal for documents, conversational for audio/video).`,
      };
      return isPinyinMode ? (pinyinPrompts[type] || basePrompts[type]) : basePrompts[type];
    }
    showSettingsUI() {
      const settingsUI = this.userSettings.createSettingsUI();
      this.uiRoot.getRoot().appendChild(settingsUI);
    }
    getRootContainer() {
      return this.uiRoot ? this.uiRoot.container : null;
    }
    cleanup() {
      console.log("Cleaning up Translator instance...");
      if (this.uiRoot) this.uiRoot.cleanup();
      if (this.ui) this.ui.cleanup();
      if (this.input) this.input.cleanup();
      if (this.videoStreaming) this.videoStreaming.cleanup();
      window.translatorInstance = null;
    }
  }
