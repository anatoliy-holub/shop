# Caching Strategy Documentation

This document explains the Redis caching implementation in the ACMO Shop Backend.

## Overview

The application implements a multi-layered caching strategy using Redis to improve performance and reduce database load. All GET operations are cached, while write operations automatically invalidate relevant cache entries.

## Architecture

```
Client Request → Fastify Route → Cache Check → Database (if needed) → Cache Storage → Response
```

## Cache Service Features

### 1. Intelligent Key Generation

#### Orders List Cache Keys
- **Default**: `orders:list:all`
- **With Filters**: `orders:list:{base64_encoded_query}`

Example:
```typescript
// Query: { status: 'pending', limit: 10 }
// Key: orders:list:eyJzdGF0dXMiOiJwZW5kaW5nIiwibGltaXQiOjEwfQ==
```

#### Individual Order Cache Keys
- **Format**: `order:{id}`
- **Example**: `order:abc123`

### 2. Cache TTL (Time To Live)

```typescript
export const CACHE_TTL = {
  ORDERS: 300,        // 5 minutes - for order lists
  ORDER_DETAILS: 600, // 10 minutes - for individual orders
  DEFAULT: 300        // 5 minutes - fallback TTL
};
```

### 3. Automatic Cache Invalidation

The cache is automatically invalidated when:

- **Creating Orders**: Invalidates all order list caches
- **Updating Orders**: Invalidates specific order and list caches
- **Deleting Orders**: Invalidates specific order and list caches

## Implementation Details

### Cache Service Methods

#### `generateOrdersListKey(query?: Record<string, any>): string`
Generates cache keys for order lists based on query parameters.

```typescript
// No query parameters
generateOrdersListKey() // Returns: "orders:list:all"

// With query parameters
generateOrdersListKey({ status: 'pending', limit: 10 })
// Returns: "orders:list:eyJzdGF0dXMiOiJwZW5kaW5nIiwibGltaXQiOjEwfQ=="
```

#### `generateOrderKey(id: string): string`
Generates cache keys for individual orders.

```typescript
generateOrderKey('abc123') // Returns: "order:abc123"
```

#### `get<T>(key: string): Promise<T | null>`
Retrieves data from cache with automatic JSON parsing.

#### `set(key: string, value: any, ttl: number): Promise<void>`
Stores data in cache with specified TTL.

#### `invalidateOrderCache(orderId?: string): Promise<void>`
Invalidates all order-related cache entries.

### Cache Integration in Order Service

#### GET Operations (Cached)

```typescript
async getAllOrders(query?: Record<string, any>): Promise<Order[]> {
  // 1. Try to get from cache first
  const cacheKey = cacheService.generateOrdersListKey(query);
  const cachedOrders = await cacheService.get<Order[]>(cacheKey);
  
  if (cachedOrders) {
    console.log('📦 Orders retrieved from cache');
    return cachedOrders;
  }
  
  // 2. If not in cache, get from database
  console.log('🗄️ Orders retrieved from database');
  const orders = await this.fetchFromDatabase();
  
  // 3. Store in cache for future requests
  await cacheService.set(cacheKey, orders, CACHE_TTL.ORDERS);
  
  return orders;
}
```

#### Write Operations (Cache Invalidation)

```typescript
async createOrder(orderData: CreateOrderRequest): Promise<Order> {
  // ... create order logic ...
  
  // Invalidate cache after creating new order
  await cacheService.invalidateOrderCache();
  
  return createdOrder;
}
```

## Cache Management Endpoints

### GET `/cache/stats`
Returns cache statistics including:
- Number of keys in cache
- Memory usage
- Connection status

### DELETE `/cache/clear`
Clears all cache entries. Useful for:
- Development testing
- Emergency cache reset
- Performance troubleshooting

## Performance Benefits

### 1. Response Time Improvement
- **Cache Hit**: ~1-5ms
- **Database Query**: ~10-50ms
- **Improvement**: 5-10x faster responses

### 2. Database Load Reduction
- **Without Cache**: Every request hits the database
- **With Cache**: Only first request hits database, subsequent requests served from cache

### 3. Scalability
- Redis can handle thousands of concurrent read requests
- Database connections remain minimal
- Horizontal scaling becomes easier

## Monitoring and Debugging

### Cache Hit/Miss Logging
The application logs cache operations:
```
📦 Orders retrieved from cache
🗄️ Orders retrieved from database
```

### Cache Statistics
Monitor cache performance via `/cache/stats`:
```json
{
  "success": true,
  "data": {
    "keys": 15,
    "memory": "2.5M"
  }
}
```

### Redis CLI Monitoring
```bash
# Connect to Redis container
docker exec -it acmo-shop-redis redis-cli

# Monitor all Redis commands
MONITOR

# Check memory usage
INFO memory

# List all keys
KEYS acmo_shop:*
```

## Best Practices

### 1. Cache Key Design
- Use descriptive prefixes (`acmo_shop:`)
- Include query parameters for filtered results
- Keep keys consistent and predictable

### 2. TTL Management
- Set appropriate TTL based on data freshness requirements
- Use longer TTL for static data
- Use shorter TTL for frequently changing data

### 3. Cache Invalidation
- Invalidate cache immediately after data changes
- Use pattern-based invalidation for related data
- Consider using cache tags for complex invalidation

### 4. Error Handling
- Cache failures should not break the application
- Fall back to database queries when cache is unavailable
- Log cache errors for monitoring

## Troubleshooting

### Common Issues

#### 1. Cache Not Working
- Check Redis connection: `npm run redis:test`
- Verify Redis container is running: `docker ps`
- Check Redis logs: `docker logs acmo-shop-redis`

#### 2. Stale Data
- Verify cache invalidation is working
- Check TTL settings
- Use `/cache/clear` to reset cache

#### 3. Memory Issues
- Monitor memory usage via `/cache/stats`
- Adjust TTL if cache is too large
- Consider Redis memory limits

### Debug Commands

```bash
# Test Redis connection
npm run redis:test

# View cache statistics
curl http://localhost:3000/cache/stats

# Clear cache
curl -X DELETE http://localhost:3000/cache/clear

# Check Redis container
docker logs acmo-shop-redis
```

## Future Enhancements

### 1. Cache Warming
- Pre-populate cache with frequently accessed data
- Background cache refresh before expiration

### 2. Distributed Caching
- Redis cluster for high availability
- Cache sharding for large datasets

### 3. Advanced Invalidation
- Cache tags for complex relationships
- Time-based invalidation strategies
- Partial cache updates

### 4. Monitoring and Alerting
- Cache hit ratio monitoring
- Performance metrics collection
- Automated cache optimization
