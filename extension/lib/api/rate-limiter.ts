const STORAGE_KEY_DAILY_COUNT = 'geminiDailyCount';
const STORAGE_KEY_DAILY_DATE = 'geminiDailyDate';

interface RateLimiterConfig {
  minIntervalMs: number;
  maxDailyRequests: number;
}

interface QueueEntry {
  resolve: () => void;
}

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export class RateLimiter {
  private readonly minIntervalMs: number;
  private readonly maxDailyRequests: number;
  private lastRequestTime = 0;
  private dailyCount = 0;
  private dailyDate = '';
  private queue: QueueEntry[] = [];
  private processing = false;
  private initialized = false;

  constructor(config: RateLimiterConfig) {
    this.minIntervalMs = config.minIntervalMs;
    this.maxDailyRequests = config.maxDailyRequests;
  }

  get remainingDaily(): number {
    const today = getTodayUtcDate();
    if (this.dailyDate !== today) {
      return this.maxDailyRequests;
    }
    return Math.max(0, this.maxDailyRequests - this.dailyCount);
  }

  async acquire(): Promise<void> {
    await this.ensureInitialized();

    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
      this.processQueue();
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const stored = await chrome.storage.local.get([
        STORAGE_KEY_DAILY_COUNT,
        STORAGE_KEY_DAILY_DATE,
      ]);
      const storedDate = stored[STORAGE_KEY_DAILY_DATE] as string | undefined;
      const storedCount = stored[STORAGE_KEY_DAILY_COUNT] as number | undefined;
      const today = getTodayUtcDate();

      if (storedDate === today && typeof storedCount === 'number') {
        this.dailyDate = storedDate;
        this.dailyCount = storedCount;
      } else {
        this.dailyDate = today;
        this.dailyCount = 0;
      }
    } catch {
      this.dailyDate = getTodayUtcDate();
      this.dailyCount = 0;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const waitMs = this.getWaitTime();
      if (waitMs > 0) {
        await new Promise<void>((r) => setTimeout(r, waitMs));
      }

      const entry = this.queue.shift();
      if (!entry) break;

      this.lastRequestTime = Date.now();
      await this.incrementDailyCount();
      entry.resolve();
    }

    this.processing = false;
  }

  private getWaitTime(): number {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed >= this.minIntervalMs) return 0;
    return this.minIntervalMs - elapsed;
  }

  private async incrementDailyCount(): Promise<void> {
    const today = getTodayUtcDate();
    if (this.dailyDate !== today) {
      this.dailyDate = today;
      this.dailyCount = 0;
    }
    this.dailyCount++;

    try {
      await chrome.storage.local.set({
        [STORAGE_KEY_DAILY_COUNT]: this.dailyCount,
        [STORAGE_KEY_DAILY_DATE]: this.dailyDate,
      });
    } catch {
      // Storage write failure is non-critical — count is still tracked in memory
    }
  }
}

// 10 RPM = 1 request per 6s, with 500ms margin → 6500ms
// 250 RPD free tier daily limit
export const geminiRateLimiter = new RateLimiter({
  minIntervalMs: 6500,
  maxDailyRequests: 250,
});
