import Redis from 'ioredis';
import { redisConfig, CACHE_TTL } from '../config/redis.js';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(redisConfig);
    
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
    
    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
  }

  /**
   * Generate cache key for orders list
   */
  generateOrdersListKey(query?: Record<string, any>): string {
    if (!query || Object.keys(query).length === 0) {
      return 'orders:list:all';
    }
    
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce((result, key) => {
        result[key] = query[key];
        return result;
      }, {} as Record<string, any>);
    
    const queryString = JSON.stringify(sortedQuery);
    const key = `orders:list:${Buffer.from(queryString).toString('base64')}`;
    console.log(`🔑 Generated orders list cache key: ${key}`);
    return key;
  }

  /**
   * Generate cache key for individual order
   */
  generateOrderKey(id: string): string {
    const key = `order:${id}`;
    console.log(`🔑 Generated order cache key: ${key}`);
    return key;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl: number = CACHE_TTL.DEFAULT): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      console.log(`💾 Stored in cache: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * Delete specific key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async delMultiple(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis delMultiple error:', error);
    }
  }

  /**
   * Invalidate all order-related cache
   */
  async invalidateOrderCache(orderId?: string): Promise<void> {
    try {
      const keys: string[] = [];
      
      if (orderId) {
        // If specific order ID provided, only invalidate that order and related list caches
        const orderKey = `order:${orderId}`;
        const orderExists = await this.redis.exists(orderKey);
        
        if (orderExists) {
          keys.push(orderKey);
        }
        
        // Also invalidate all list caches since the order data changed
        const ordersListKeys = await this.redis.keys(`orders:list:*`);
        keys.push(...ordersListKeys);
        
        console.log(`🗑️ Invalidating cache for specific order ${orderId}`);
      } else {
        // If no order ID provided, invalidate ALL order-related cache
        const orderKeys = await this.redis.keys(`order:*`);
        const ordersListKeys = await this.redis.keys(`orders:list:*`);
        
        keys.push(...orderKeys, ...ordersListKeys);
        
        console.log('🗑️ Invalidating ALL order-related cache');
      }
      
      if (keys.length > 0) {
        // Since keys already include the prefix from the keys() command, we can use them directly
        // Use Redis del directly for the found keys
        const delResult = await this.redis.del(...keys);
        console.log(`✅ Invalidated ${delResult} cache keys out of ${keys.length} found keys:`, keys);
      } else {
        console.log('ℹ️ No cache keys found to invalidate');
      }
    } catch (error) {
      console.error('Redis invalidateOrderCache error:', error);
    }
  }

  /**
   * List all cache keys (for debugging)
   */
  async listAllKeys(): Promise<string[]> {
    try {
      const allKeys = await this.redis.keys('*');
      return allKeys.sort();
    } catch (error) {
      console.error('Redis listAllKeys error:', error);
      return [];
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('All cache cleared');
    } catch (error) {
      console.error('Redis clearAll error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string }> {
    try {
      const info = await this.redis.info('memory');
      const keys = await this.redis.dbsize();
      
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';
      
      return { keys, memory };
    } catch (error) {
      console.error('Redis getStats error:', error);
      return { keys: 0, memory: 'unknown' };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Redis close error:', error);
    }
  }
}

export const cacheService = new CacheService();
