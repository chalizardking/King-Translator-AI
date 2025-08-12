const translator = new Translator();
translator.init(); // Initialize the translator

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'togglePageTranslation') {
        translator.page.translatePage();
    } else if (request.action === 'ocrRegion') {
        translator.ocr.captureScreen().then(screenshot => {
            if (screenshot) {
                translator.ui.showTranslatingStatus();
                translator.ocr.processImage(screenshot).then(result => {
                    translator.ui.removeTranslatingStatus();
                    if (result) {
                        translator.ui.formatTrans(result);
                    }
                }).catch(error => {
                    translator.ui.removeTranslatingStatus();
                    translator.ui.showNotification(error.message, "error");
                });
            }
        }).catch(error => {
            translator.ui.showNotification(error.message, "error");
        });
    } else if (request.action === 'webImageOcr') {
        translator.ui.startWebImageOCR();
    } else if (request.action === 'mangaWebTrans') {
        translator.ui.startMangaTranslation();
    } else if (request.action === 'imageFileTrans') {
        createFileInput("image/*", (file) => {
            translator.ocr.processImage(file).then(result => {
                if (result) {
                    translator.ui.formatTrans(result);
                }
            }).catch(error => {
                translator.ui.showNotification(error.message, "error");
            });
        });
    } else if (request.action === 'mediaFileTrans') {
        createFileInput("audio/*,video/*", (file) => {
            translator.media.processMediaFile(file).catch(error => {
                translator.ui.showNotification(error.message, "error");
            });
        });
    } else if (request.action === 'fileTranslate') {
        const supportedFormats = RELIABLE_FORMATS.text.formats.map(f => `.${f.ext}`).join(',');
        createFileInput(supportedFormats, async (file) => {
            try {
                const result = await translator.translateFile(file);
                const blob = file.type.endsWith('pdf') ? result : new Blob([result], { type: file.type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `king1x32_translated_${file.type.endsWith('pdf') ? file.name.replace(".pdf", ".html") : file.name}`;
                translator.ui.shadowRoot.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
            } catch (error) {
                translator.ui.showNotification(error.message, "error");
            }
        });
    } else if (request.action === 'translateVip') {
        translator.ui.handleGeminiFileOrUrlTranslation();
    } else if (request.action === 'openSettings') {
        translator.showSettingsUI();
    }
});
