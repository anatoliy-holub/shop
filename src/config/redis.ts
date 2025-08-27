export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0')
};

// Cache TTL in seconds
export const CACHE_TTL = {
  ORDERS: 300,        // 5 minutes
  ORDER_DETAILS: 600, // 10 minutes
  DEFAULT: 300        // 5 minutes
};
