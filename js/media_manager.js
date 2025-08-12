class MediaManager {
    constructor(translator) {
      this.translator = translator;
      this.isProcessing = false;
      this._ = this.translator.userSettings._;
    }
    async processMediaFile(file) {
      try {
        if (!this.isValidFormat(file)) {
          throw new Error(this._("notifications.unsupported_file_format"));
        }
        if (!this.isValidSize(file)) {
          throw new Error(this._("notifications.file_too_large") + ` Kích thước tối đa: ${this.getMaxSizeInMB(file)}MB`);
        }
        this.isProcessing = true;
        this.translator.ui.showProcessingStatus(this._("notifications.processing_media"));
        const base64Media = await this.fileToBase64(file);
        this.translator.ui.updateProcessingStatus(this._("notifications.checking_cache"), 20);
        let cacheKey = null;
        const cacheEnabled = this.translator.userSettings.settings.cacheOptions.media?.enabled;
        if (cacheEnabled && this.translator.mediaCache) {
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64Media));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          cacheKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const cachedResult = await this.translator.mediaCache.get(cacheKey);
          if (cachedResult) {
            this.translator.ui.updateProcessingStatus(this._("notifications.found_in_cache"), 100);
            this.translator.ui.displayPopup(cachedResult, '', "Bản dịch");
            this.isProcessing = false;
            setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
            return;
          }
        }
        this.translator.ui.updateProcessingStatus(this._("notifications.processing_audio_video"), 40);
        const prompt = this.translator.createPrompt("media", "media");
        console.log('prompt: ', prompt);
        const content = await this.translator.fileProcess.processFile(file, prompt);
        this.translator.ui.updateProcessingStatus(this._("notifications.translating"), 60);
        const result = await this.translator.api.request(content.content, 'media', content.key);
        this.translator.ui.updateProcessingStatus(this._("notifications.finalizing"), 80);
        if (!result || result.length === 0) {
          throw new Error(this._("notifications.cannot_process_media"));
        }
        if (cacheKey && cacheEnabled && this.translator.mediaCache) {
          await this.translator.mediaCache.set(cacheKey, result);
        }
        this.translator.ui.updateProcessingStatus(this._("notifications.completed"), 100);
        this.translator.ui.displayPopup(result, '', this._("notifications.translation_label"));
      } catch (error) {
        console.error("Media processing error:", error);
        throw new Error(this._("notifications.media_file_error") + ` ${error.message}`);
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
        mkv: "video/x-matroska"
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
        reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
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
