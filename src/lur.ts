export interface LURStoreItemType {
  expires: number;
  [key: string]: any;
}

export class LURStore<T extends LURStoreItemType> {

  private max = 1;

  private store = new Map<any, T>();

  constructor(max = 1) {
    this.max = max;
  }

  update(key: any, value: any) {
    const item = this.tryGet(key)
    this.set(key, {
      ...item,
      ...value,
    });
  }

  set(key: any, value: T) {
    this.store.set(key, value);
    // Not exceeding maximum storage capacity, still return
    if (this.store.size <= this.max) {
      return value;
    }
    const now = Date.now();
    /**
     * Fallback cleanup operation, to clean up as much as possible, 
     * by default it will trigger cleanup of expired items and those exceeding the limit
     */
    const entries: any[][] = Array.from(this.store.entries());
    entries.sort((a, b) => {
      // @ts-ignore
      return a[1].expires - b[1].expires;
    });
    
    // Find the first non-expired item (sorted: expired -> non-expired)
    let index = entries.findIndex((p) => p[1] > now);
    // Set the starting position for queue size control
    index = Math.max(index, 0);
    // From index (non-expired start) to end, only max positions can be retained, calculate how many need to be deleted
    const deleteCount = Math.max(0, entries.length - index - this.max);
    // Retained index positions, everything before needs to be deleted
    index = index + deleteCount;
    entries.slice(0, index).forEach(([key, expires]) => {
      this.store.delete(key);
    });
    return value;
  }

  tryGet(key: any) {
    const now = Date.now();
    // @ts-ignore
    const item = this.store.get(key);
    if (item && item.expires > now) {
      return item;
    }
  }

  get(key: any) {
    return this.store.get(key);
  }

  getValues() {
    return Array.from(this.store.values());
  }

  delete(key: any) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}