// Note: This module depends on 'lz-string' library.
// I will add it to the project later.

export class PersistentCache {
    constructor(storageKey, maxSize, expirationTime) {
      this.storageKey = storageKey;
      this.maxSize = maxSize;
      this.expirationTime = expirationTime;
      this.cache = new Map();
      this.accessOrder = [];
      this.isInitialized = false;
    }
    async init() {
      if (this.isInitialized) return;
      const storedData = await new Promise(resolve => chrome.storage.local.get(this.storageKey, resolve));
      if (storedData && storedData[this.storageKey]) {
        try {
          const parsed = JSON.parse(storedData[this.storageKey]);
          this.cache = new Map(Object.entries(parsed.cache || {}));
          this.accessOrder = parsed.accessOrder || [];
          console.log(`Cache "${this.storageKey}" loaded with ${this.cache.size} items.`);
        } catch (e) {
          console.error(`Failed to load cache "${this.storageKey}":`, e);
          this.cache = new Map();
          this.accessOrder = [];
        }
      }
      this.isInitialized = true;
    }
    async _saveToStorage() {
      const dataToStore = {
        cache: Object.fromEntries(this.cache),
        accessOrder: this.accessOrder,
      };
      await new Promise(resolve => chrome.storage.local.set({ [this.storageKey]: JSON.stringify(dataToStore) }, resolve));
    }
    async set(key, value) {
      if (!this.isInitialized) await this.init();
      if (this.cache.has(key)) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) this.accessOrder.splice(index, 1);
      } else {
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.accessOrder.shift();
          this.cache.delete(oldestKey);
        }
      }
      this.accessOrder.push(key);
      const compressedData = LZString.compressToUTF16(JSON.stringify({
        value,
        timestamp: Date.now()
      }));
      this.cache.set(key, compressedData);
      await this._saveToStorage();
    }
    async get(key) {
      if (!this.isInitialized) await this.init();
      const compressedData = this.cache.get(key);
      if (!compressedData) return null;
      const data = JSON.parse(LZString.decompressFromUTF16(compressedData));
      if (Date.now() - data.timestamp > this.expirationTime) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) this.accessOrder.splice(index, 1);
        await this._saveToStorage();
        return null;
      }
      const index = this.accessOrder.indexOf(key);
      if (index > -1) this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      await this._saveToStorage();
      return data.value;
    }
    static arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
    static base64ToArrayBuffer(base64) {
      const binary_string = window.atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    }
    async clear() {
      this.cache.clear();
      this.accessOrder = [];
      await new Promise(resolve => chrome.storage.local.remove(this.storageKey, resolve));
    }
  }
