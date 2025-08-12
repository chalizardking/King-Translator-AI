class FileUploader {
    constructor(settings) {
      this.settings = settings.settings;
      this._ = settings._;
    }
    async getUploadUrl(file) {
      const apiKeys = this.settings.apiKey[this.settings.apiProvider];
      const errors = [];
      let startIndex = Math.floor(Math.random() * apiKeys.length);
      for (let i = 0; i < apiKeys.length; i++) {
        const currentIndex = (startIndex + i) % apiKeys.length;
        const key = apiKeys[currentIndex];
        try {
          const response = await fetch(`${CONFIG.API.providers.gemini.uploadUrl}?key=${key}`, {
            method: 'POST',
            headers: {
              'X-Goog-Upload-Protocol': 'resumable',
              'X-Goog-Upload-Command': 'start',
              'X-Goog-Upload-Header-Content-Length': file.size,
              'X-Goog-Upload-Header-Content-Type': file.type,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: {
                display_name: file.name
              }
            })
          });
          const uploadUrl = response.headers.get('x-goog-upload-url');
          if (!uploadUrl) throw new Error(this._("notifications.upl_url"));
          return {
            url: uploadUrl,
            key: key,
          };
        } catch (error) {
          errors.push(`Key ${key.slice(0, 8)}... : ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
      }
      if (errors.length > 0) {
        throw new Error(this._("notifications.all_keys_failed") + `${errors.join('\n')}`);
      }
    }
    async uploadFile(uploadUrl, file) {
        const response = await fetch(uploadUrl.url, {
            method: 'POST',
            headers: {
                'Content-Length': file.size,
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize'
            },
            body: file,
        });
        const result = await response.json();
        if (!result.file?.uri) throw new Error(this._("notifications.upl_uri"));
        return {
            uri: result.file.uri,
            key: uploadUrl.key,
        };
    }
    async uploadLargeFile(file) {
      try {
        const uploadUrl = await this.getUploadUrl(file);
        return await this.uploadFile(uploadUrl, file);
      } catch (error) {
        console.error('Upload failed:', error);
        throw new Error(this._("notifications.upl_fail"));
      }
    }
  }
