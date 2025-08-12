class VideoStreamingTranslator {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.defaultLang = this.settings.displayOptions.targetLanguage;
      this.isEnabled = false;
      this.isPlaying = false;
      this.hasCaptions = false;
      this.initialized = false;
      this.isFetchingTranscript = false;
      this.isTranslatingChunk = false;
      this.isSeeking = false;
      this.lastCurrentTime = -1;
      this.fullTranscriptTranslated = false;
      this.isNotify = false;
      this.activeVideoId = null;
      this.currentVideo = null;
      this.videoTrackingInterval = null;
      this.translatedTranscript = null;
      this.subtitleContainer = null;
      this.lastCaption = '';
      this.lastTranslatedIndex = -1;
      this.translatingIndexes = new Set();
      this.subtitleCache = new Map();
      this.keyIndex = null;
      this.rateLimitedKeys = new Map();
      this.retryDelay = 100;
      this.captionObserver = null;
      this.platformInfo = this.detectPlatform();
      if (this.settings.videoStreamingOptions?.enabled && this.platformInfo) {
        setTimeout(() => this.start(), 2000);
      }
    }
    detectPlatform() {
      this.platformConfigs = {
        youtube: {
          videoSelector: [
            'video',
            'video.html5-main-video',
            '.html5-video-container video',
            '#movie_player video',
          ],
          controlsContainer: [
            '.ytp-subtitles-button',
            '.ytp-settings-button',
            'ytm-closed-captioning-button'
          ],
          videoContainer: [
            '#movie_player',
            '#player',
            '.html5-video-container',
          ],
          // captionSelector: ['.captions-text'],
          // captionButton: {
          //   desktop: '.ytp-subtitles-button',
          //   mobile: '.ytmClosedCaptioningButtonButton'
          // }
        },
        udemy: {
          videoSelector: [
            'video',
            '[class*="video-player--video-player"] video'
          ],
          controlsContainer: [
            '[data-purpose="transcript-toggle"]',
            '[id="popper-trigger--131"]'
          ],
          videoContainer: [
            '[class*="video-player--mock-vjs-tech"]',
            '[id*="video-container"]'
          ],
          // captionSelector: ['data-purpose="captions-cue-text"'],
          // captionButton: {
          //   desktop: 'button[data-purpose="transcript-toggle"]'
          // }
        }
      };
      const hostname = window.location.hostname;
      for (const [platform, config] of Object.entries(this.platformConfigs)) {
        if (hostname.includes(platform)) {
          return { platform, config };
        }
      }
      return null;
    }
    setupVideoListeners() {
      if (!this.currentVideo || this.initialized) return;
      this.activeVideoId = Math.random().toString(36).substring(7);
      this.currentVideo.dataset.translatorVideoId = this.activeVideoId;
      const videoEvents = ['play', 'playing', 'seeking', 'seeked', 'pause', 'ended'];
      videoEvents.forEach(eventName => {
        const handler = async () => {
          if (this.currentVideo?.dataset.translatorVideoId !== this.activeVideoId) return;
          switch (eventName) {
            case 'play':
            case 'playing':
              this.isPlaying = true;
              break;
            case 'seeking':
              this.isSeeking = true;
              break;
            case 'seeked':
              this.isSeeking = false;
              this.isTranslatingChunk = false;
              this.processVideoFrame();
              break;
            case 'pause':
              this.isPlaying = false;
              break;
            case 'ended':
              this.isPlaying = false;
              this.cleanupVideo();
              break;
          }
        };
        this.currentVideo.addEventListener(eventName, handler);
        this.currentVideo[`${eventName}Handler`] = handler;
      });
      if (this.currentVideo) {
        let previousWidth = 0;
        let translatedCaption = null;
        let originalText = null;
        let translatedText = null;
        const updateStyles = debounce((width) => {
          if (width === previousWidth) return;
          previousWidth = width;
          if (!translatedCaption) translatedCaption = document.querySelector('.translated-caption');
          if (!originalText) originalText = document.querySelector('.original-text') || null;
          if (!translatedText) translatedText = document.querySelector('.translated-text');
          if (translatedText) {
            let tranWidth, origSize, transSize;
            if (width <= 480) {
              tranWidth = '98%';
              origSize = '0.65em';
              transSize = '0.7em';
            } else if (width <= 962) {
              tranWidth = '95%';
              origSize = '0.75em';
              transSize = '0.8em';
            } else if (width <= 1366) {
              tranWidth = '90%';
              origSize = '0.85em';
              transSize = '0.9em';
            } else {
              tranWidth = '90%';
              origSize = '0.95em';
              transSize = '1em';
            }
            if (translatedCaption) translatedCaption.style.maxWidth = tranWidth;
            if (originalText) originalText.style.fontSize = origSize;
            translatedText.style.fontSize = transSize;
          }
        }, 100);
        const adjustContainer = debounce(() => {
          if (!this.subtitleContainer || !this.currentVideo) return;
          const videoRect = this.currentVideo.getBoundingClientRect();
          const containerRect = this.subtitleContainer.getBoundingClientRect();
          if (containerRect.bottom > videoRect.bottom) {
            this.subtitleContainer.style.bottom = '5%';
          }
          if (containerRect.width > videoRect.width * 0.9) {
            this.subtitleContainer.style.maxWidth = '90%';
          }
        }, 100);
        const resizeObserver = new ResizeObserver(entries => {
          const width = entries[0].contentRect.width;
          updateStyles(width);
          adjustContainer();
        });
        resizeObserver.observe(this.currentVideo);
      }
      this.initialized = true;
    }
}
