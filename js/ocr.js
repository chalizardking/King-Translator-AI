class OCRManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required for OCRManager");
      }
      this.translator = translator;
      this.isProcessing = false;
      this._ = this.translator.userSettings._;
    }
    async captureScreen() {
      try {
        const elements = this.translator.ui.$$(".translator-tools-container, .translator-notification, .center-translate-status");
        elements.forEach(el => {
          if (el) el.style.visibility = "hidden";
        });
        try {
          const style = document.createElement('style');
          style.textContent = `
        .screenshot-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.3);
          cursor: crosshair;
          z-index: 2147483647;
          touch-action: none;
        }
        .screenshot-guide {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          z-index: 2147483648;
          font-family: "GoMono Nerd Font", "Noto Sans", Arial;
          font-size: 14px;
          text-align: center;
          white-space: nowrap;
        }
        .screenshot-cancel {
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
        .screenshot-selection {
          position: fixed;
          border: 2px solid #4a90e2;
          background: rgba(74,144,226,0.1);
          z-index: 2147483647;
        }`;
          this.translator.uiRoot.getRoot().appendChild(style);
          const overlay = document.createElement('div');
          overlay.className = 'screenshot-overlay';
          const guide = document.createElement('div');
          guide.className = 'screenshot-guide';
          guide.textContent = this._("notifications.cap_gui");
          const cancelBtn = document.createElement("button");
          cancelBtn.className = "screenshot-cancel";
          cancelBtn.textContent = "✕";
          this.translator.uiRoot.getRoot().appendChild(overlay);
          this.translator.uiRoot.getRoot().appendChild(guide);
          this.translator.uiRoot.getRoot().appendChild(cancelBtn);
          return new Promise((resolve, reject) => {
            let startX, startY;
            let selection = null;
            let isSelecting = false;
            const getCoordinates = (event) => {
              if (event.touches) {
                return {
                  x: event.touches[0].clientX,
                  y: event.touches[0].clientY
                };
              }
              return {
                x: event.clientX,
                y: event.clientY
              };
            };
            const startSelection = (e) => {
              e.preventDefault();
              const coords = getCoordinates(e);
              startX = coords.x;
              startY = coords.y;
              isSelecting = true;
              if (selection) selection.remove();
              selection = document.createElement('div');
              selection.className = 'screenshot-selection';
              this.translator.uiRoot.getRoot().appendChild(selection);
            };
            const updateSelection = debounce((e) => {
              if (!isSelecting || !selection) return;
              e.preventDefault();
              const coords = getCoordinates(e);
              const currentX = coords.x;
              const currentY = coords.y;
              const left = Math.min(startX, currentX);
              const top = Math.min(startY, currentY);
              const width = Math.abs(currentX - startX);
              const height = Math.abs(currentY - startY);
              if (width < 10 || height < 10) return;
              requestAnimationFrame(() => {
                selection.style.left = left + 'px';
                selection.style.top = top + 'px';
                selection.style.width = width + 'px';
                selection.style.height = height + 'px';
              });
            }, 16);
            const endSelection = debounce(async (e) => {
              if (!isSelecting || !selection) return;
              e.preventDefault();
              isSelecting = false;
              try {
                this.translator.ui.showProcessingStatus("Capturing screenshot...");
                const rect = selection.getBoundingClientRect();
                if (rect.width < 10 || rect.height < 10) {
                  selection.remove();
                  return;
                }
                const video = document.createElement('video');
                video.style.cssText = 'position: fixed; top: -9999px; left: -9999px;';
                document.body.appendChild(video);
                const stream = await navigator.mediaDevices.getDisplayMedia({
                  preferCurrentTab: true,
                  video: {
                    width: window.innerWidth,
                    height: window.innerHeight
                  }
                });
                video.srcObject = stream;
                await video.play();
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = rect.width;
                canvas.height = rect.height;
                ctx.drawImage(video,
                  rect.left, rect.top, rect.width, rect.height,
                  0, 0, rect.width, rect.height
                );
                stream.getTracks().forEach(track => track.stop());
                video.remove();
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;
                let isMonochrome = true;
                const firstPixel = {
                  r: pixels[0],
                  g: pixels[1],
                  b: pixels[2],
                  a: pixels[3]
                };
                for (let i = 4; i < pixels.length; i += 4) {
                  if (pixels[i] !== firstPixel.r ||
                    pixels[i + 1] !== firstPixel.g ||
                    pixels[i + 2] !== firstPixel.b ||
                    pixels[i + 3] !== firstPixel.a) {
                    isMonochrome = false;
                    break;
                  }
                }
                const isWhiteOrTransparent = (
                  (firstPixel.r === 255 && firstPixel.g === 255 && firstPixel.b === 255) ||
                  firstPixel.a === 0
                );
                if (isMonochrome && isWhiteOrTransparent) {
                  throw new Error(this._("notifications.no_content_in_selection"));
                }
                const blob = await new Promise(resolve => {
                  canvas.toBlob(resolve, 'image/png', 1.0);
                });
                if (!blob || blob.size < 100) {
                  throw new Error(this._("notifications.invalid_image_file"));
                }
                const file = new File([blob], "screenshot.png", { type: "image/png" });
                resolve(file);
              } catch (error) {
                console.log("Primary method failed, switching to backup:", error);
                try {
                  const rect = selection.getBoundingClientRect();
                  const elements = document.elementsFromPoint(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2
                  );
                  const targetElement = elements.find(el => {
                    const classList = el.classList ? Array.from(el.classList) : [];
                    const id = el.id || '';
                    return !id.includes('translator') &&
                      !classList.some(c => c.includes('translator')) &&
                      !classList.some(c => c.includes('screenshot'));
                  });
                  if (!targetElement) {
                    throw new Error(this._("notifications.cannot_identify_region"));
                  }
                  if (targetElement.tagName === 'IMG' || targetElement.tagName === 'CANVAS') {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    if (targetElement.tagName === 'IMG') {
                      const originalCrossOrigin = targetElement.crossOrigin;
                      targetElement.crossOrigin = 'anonymous';
                      await new Promise((resolve, reject) => {
                        const loadHandler = () => {
                          targetElement.removeEventListener('load', loadHandler);
                          targetElement.removeEventListener('error', errorHandler);
                          resolve();
                        };
                        const errorHandler = () => {
                          targetElement.removeEventListener('load', loadHandler);
                          targetElement.removeEventListener('error', errorHandler);
                          targetElement.crossOrigin = originalCrossOrigin;
                          reject(new Error(this._("notifications.image_load_error")));
                        };
                        if (targetElement.complete) {
                          resolve();
                        } else {
                          targetElement.addEventListener('load', loadHandler);
                          targetElement.addEventListener('error', errorHandler);
                        }
                      });
                      const elementRect = targetElement.getBoundingClientRect();
                      const sourceX = rect.left - elementRect.left;
                      const sourceY = rect.top - elementRect.top;
                      const scaleX = targetElement.naturalWidth / elementRect.width;
                      const scaleY = targetElement.naturalHeight / elementRect.height;
                      ctx.drawImage(
                        targetElement,
                        sourceX * scaleX,
                        sourceY * scaleY,
                        rect.width * scaleX,
                        rect.height * scaleY,
                        0,
                        0,
                        rect.width,
                        rect.height
                      );
                      targetElement.crossOrigin = originalCrossOrigin;
                    } else if (targetElement.tagName === 'CANVAS') {
                      const sourceCtx = targetElement.getContext('2d', { willReadFrequently: true });
                      const elementRect = targetElement.getBoundingClientRect();
                      const sourceX = rect.left - elementRect.left;
                      const sourceY = rect.top - elementRect.top;
                      const scaleX = targetElement.width / elementRect.width;
                      const scaleY = targetElement.height / elementRect.height;
                      try {
                        const imageData = sourceCtx.getImageData(
                          sourceX * scaleX,
                          sourceY * scaleY,
                          rect.width * scaleX,
                          rect.height * scaleY
                        );
                        canvas.width = imageData.width;
                        canvas.height = imageData.height;
                        ctx.putImageData(imageData, 0, 0);
                      } catch (error) {
                        if (error.name === 'SecurityError') {
                          throw new Error(this._("notifications.canvas_security_error"));
                        }
                        throw error;
                      }
                    }
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const hasContent = imageData.data.some(pixel => pixel !== 0);
                    if (!hasContent) {
                      throw new Error(this._("notifications.cannot_capture_element"));
                    }
                    const file = await new Promise((resolve, reject) => {
                      canvas.toBlob(blob => {
                        if (!blob || blob.size < 100) {
                          reject(new Error(this._("notifications.cannot_generate_valid")));
                          return;
                        }
                        resolve(new File([blob], "screenshot.png", { type: "image/png" }));
                      }, 'image/png', 1.0);
                    });
                    resolve(file);
                  } else {
                    const screenshotCanvas = await html2canvas(targetElement, {
                      width: rect.width,
                      height: rect.height,
                      x: rect.left - targetElement.getBoundingClientRect().left,
                      y: rect.top - targetElement.getBoundingClientRect().top,
                      scale: 2,
                      logging: false,
                      useCORS: true,
                      allowTaint: true,
                      backgroundColor: '#ffffff',
                      foreignObjectRendering: true,
                      removeContainer: true,
                      ignoreElements: (element) => {
                        const classList = element.classList ? Array.from(element.classList) : [];
                        const id = element.id || '';
                        return id.includes('translator') ||
                          classList.some(c => c.includes('translator')) ||
                          classList.some(c => c.includes('screenshot'));
                      },
                      onclone: (clonedDoc) => {
                        const elements = clonedDoc.querySelectorAll('[id*="translator"], [class*="translator"], [class*="screenshot"]');
                        elements.forEach(el => el.remove());
                      }
                    });
                    const file = await new Promise((resolve, reject) => {
                      screenshotCanvas.toBlob(blob => {
                        if (!blob || blob.size < 100) {
                          reject(new Error(this._("notifications.invalid_screenshot")));
                          return;
                        }
                        resolve(new File([blob], "screenshot.png", { type: "image/png" }));
                      }, 'image/png', 1.0);
                    });
                    resolve(file);
                  }
                } catch (backupError) {
                  console.error("Backup method failed:", backupError);
                  reject(new Error(this._("notifications.cannot_capture_screen") + backupError.message));
                }
              } finally {
                cleanup();
              }
            }, 100);
            const cleanup = () => {
              setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
              overlay.remove();
              guide.remove();
              cancelBtn.remove();
              if (selection) selection.remove();
              style.remove();
              elements.forEach(el => {
                if (el) el.style.visibility = "";
              });
              overlay.removeEventListener('mousedown', startSelection);
              document.removeEventListener('mousemove', updateSelection);
              document.removeEventListener('mouseup', endSelection);
              overlay.removeEventListener('touchstart', startSelection);
              document.removeEventListener('touchmove', updateSelection);
              document.removeEventListener('touchend', endSelection);
              document.removeEventListener('touchcancel', cleanup);
            };
            overlay.addEventListener('mousedown', startSelection);
            document.addEventListener('mousemove', updateSelection);
            document.addEventListener('mouseup', endSelection);
            overlay.addEventListener('touchstart', startSelection, { passive: false });
            document.addEventListener('touchmove', updateSelection, { passive: false });
            document.addEventListener('touchend', endSelection);
            document.addEventListener('touchcancel', cleanup);
            cancelBtn.addEventListener("click", () => {
              cleanup();
              reject(new Error('Selection cancelled'));
            });
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                cleanup();
                reject(new Error('Selection cancelled'));
              }
            });
          });
        } catch (error) {
          console.error("Screen capture error:", error);
          const elements = this.translator.ui.$$(".translator-tools-container, .translator-notification, .center-translate-status");
          elements.forEach(el => {
            if (el) el.style.visibility = "";
          });
          throw error;
        }
      } catch (error) {
        console.error("Screen capture error:", error);
        const elements = this.translator.ui.$$(".translator-tools-container, .translator-notification, .center-translate-status");
        elements.forEach(el => {
          if (el) el.style.visibility = "";
        });
        throw error;
      }
    }
    async processImage(file, prompts, silent = false) {
      try {
        const settings = this.translator.userSettings.settings;
        this.isProcessing = true;
        if (!silent) this.translator.ui.showProcessingStatus(this._("notifications.processing_image"));
        const optimizedFile = await this.optimizeImage(file);
        const base64Image = await this.fileToBase64(optimizedFile);
        if (!silent) this.translator.ui.updateProcessingStatus(this._("notifications.checking_cache"), 20);
        let cacheKey = null;
        if (this.translator.imageCache && settings.cacheOptions.image.enabled) {
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64Image));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          cacheKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const cachedResult = await this.translator.imageCache.get(cacheKey);
          if (cachedResult) {
            if (!silent) this.translator.ui.updateProcessingStatus(this._("notifications.found_in_cache"), 100);
            this.isProcessing = false;
            if (!silent) setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
            return cachedResult;
          }
        }
        if (!silent) this.translator.ui.updateProcessingStatus(this._("notifications.detecting_text"), 40);
        const prompt = prompts ? prompts : this.translator.createPrompt("ocr", "ocr");
        console.log('prompt: ', prompt);
        const content = await this.translator.fileProcess.processFile(file, prompt);
        const result = await this.translator.api.request(content.content, 'ocr', content.key);
        if (cacheKey && this.translator.imageCache && settings.cacheOptions.image.enabled) {
          await this.translator.imageCache.set(cacheKey, result);
        }
        if (!silent) this.translator.ui.updateProcessingStatus(this._("notifications.completed"), 100);
        return result;
      } catch (error) {
        console.error("OCR processing error:", error);
        throw error;
      } finally {
        this.isProcessing = false;
        if (!silent) setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
      }
    }
    async optimizeImage(file) {
      const img = await createImageBitmap(file);
      const maxDimension = 2560;
      let newWidth = img.width;
      let newHeight = img.height;
      if (img.width > maxDimension || img.height > maxDimension) {
        if (img.width > img.height) {
          newWidth = maxDimension;
          newHeight = Math.floor(img.height * (maxDimension / img.width));
        } else {
          newHeight = maxDimension;
          newWidth = Math.floor(img.width * (maxDimension / img.height));
        }
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
        alpha: true
      });
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium'; // 'high', 'medium'
      ctx.filter = 'contrast(1.1) brightness(1.05)';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      try {
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/webp', 0.92);
        });
        if (blob) {
          return new File([blob], file.name, {
            type: 'image/webp',
            lastModified: Date.now()
          });
        }
      } catch (e) {
        console.log('WebP not supported, falling back to JPEG');
      }
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });
      return new File([blob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
    }
    async reduceImageSize(file) {
      const img = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = Math.floor(img.width * 0.75);
      canvas.height = Math.floor(img.height * 0.75);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      });
      return new File([blob], file.name, { type: 'image/jpeg' });
    }
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
        reader.readAsDataURL(file);
      });
    }
  }
