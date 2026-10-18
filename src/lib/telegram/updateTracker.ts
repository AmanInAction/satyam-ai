/**
 * In-memory update deduplication tracker for Telegram Webhook.
 * Prevents re-processing identical Telegram update_ids on network retries.
 */

export class TelegramUpdateTracker {
  private seenUpdates: Map<number, number> = new Map();
  private maxCapacity: number;
  private ttlMs: number;

  constructor(maxCapacity: number = 5000, ttlMinutes: number = 15) {
    this.maxCapacity = maxCapacity;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Checks whether the update_id has already been processed recently.
   * If not seen, records it and returns false.
   * If seen and not expired, returns true (is duplicate).
   */
  isDuplicate(updateId: number): boolean {
    const now = Date.now();
    this.cleanup(now);

    if (this.seenUpdates.has(updateId)) {
      return true;
    }

    // Enforce capacity limit
    if (this.seenUpdates.size >= this.maxCapacity) {
      const oldestKey = this.seenUpdates.keys().next().value;
      if (oldestKey !== undefined) {
        this.seenUpdates.delete(oldestKey);
      }
    }

    this.seenUpdates.set(updateId, now);
    return false;
  }

  /**
   * Clears seen updates (useful for test resets).
   */
  reset(): void {
    this.seenUpdates.clear();
  }

  get size(): number {
    return this.seenUpdates.size;
  }

  private cleanup(now: number): void {
    for (const [id, timestamp] of this.seenUpdates.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.seenUpdates.delete(id);
      } else {
        // Since entries are inserted in chronological order, break early
        break;
      }
    }
  }
}

export const defaultUpdateTracker = new TelegramUpdateTracker();
