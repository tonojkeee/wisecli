/**
 * Ring Buffer implementation for O(1) push operations
 * Used for terminal output to avoid memory pressure from frequent array operations
 */
export class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer. O(1) operation.
   * If buffer is full, overwrites the oldest item.
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, advance head to overwrite oldest
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items as an array. O(n) but only called when needed.
   */
  toArray(): T[] {
    if (this.count === 0) return [];

    const result: T[] = new Array(this.count);

    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(this.head + i) % this.capacity];
    }

    return result;
  }

  /**
   * Get number of items in buffer
   */
  get length(): number {
    return this.count;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Clear all items from buffer
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    // Clear references to help GC
    this.buffer = new Array(this.capacity);
  }

  /**
   * Get items starting from a specific index
   * Returns items from startIndex to current end
   */
  sliceFrom(startIndex: number): T[] {
    if (startIndex >= this.count) return [];
    if (startIndex < 0) startIndex = 0;

    const itemsToGet = this.count - startIndex;
    const result: T[] = new Array(itemsToGet);

    for (let i = 0; i < itemsToGet; i++) {
      const bufferIndex = (this.head + startIndex + i) % this.capacity;
      result[i] = this.buffer[bufferIndex];
    }

    return result;
  }
}
