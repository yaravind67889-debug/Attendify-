class SafeStorage {
  private memoryStore: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is not accessible. Using in-memory fallback.', e);
      return this.memoryStore[key] || null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is not accessible. Using in-memory fallback.', e);
      this.memoryStore[key] = String(value);
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is not accessible. Using in-memory fallback.', e);
      delete this.memoryStore[key];
    }
  }

  clear(): void {
    try {
      window.localStorage.clear();
    } catch (e) {
      console.warn('localStorage is not accessible. Using in-memory fallback.', e);
      this.memoryStore = {};
    }
  }
}

export const safeStorage = new SafeStorage();
