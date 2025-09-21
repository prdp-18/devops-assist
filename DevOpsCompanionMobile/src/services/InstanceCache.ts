import { AWSInstance } from './AWSService';

interface CacheData {
  instances: AWSInstance[];
  timestamp: number;
  expiresIn: number; // milliseconds
}

class InstanceCache {
  private cache: CacheData | null = null;
  private readonly DEFAULT_CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get cached instances if they exist and are not expired
   */
  getInstances(): AWSInstance[] | null {
    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    if (now - this.cache.timestamp > this.cache.expiresIn) {
      this.cache = null;
      return null;
    }

    return this.cache.instances;
  }

  /**
   * Set instances in cache
   */
  setInstances(instances: AWSInstance[], cacheDuration?: number): void {
    this.cache = {
      instances: [...instances], // Create a copy
      timestamp: Date.now(),
      expiresIn: cacheDuration || this.DEFAULT_CACHE_DURATION,
    };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache = null;
  }

  /**
   * Check if cache exists and is valid
   */
  hasValidCache(): boolean {
    return this.getInstances() !== null;
  }
}

// Export a singleton instance
export const instanceCache = new InstanceCache();
