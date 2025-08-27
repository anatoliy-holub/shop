# Cache Debugging Guide

This guide helps you troubleshoot and verify that cache invalidation is working correctly.

## The Bug

**Issue**: After adding a new order, the cache is not being cleared, so subsequent GET requests return stale data.

**Root Cause**: The cache invalidation logic was not properly matching the cache keys.

## What Was Fixed

1. **Consistent Key Patterns**: Ensured cache invalidation looks for the same key patterns used when storing data
2. **Better Logging**: Added detailed logging to track cache operations
3. **Debug Endpoints**: Added endpoints to inspect cache state
4. **Test Scripts**: Created scripts to verify cache invalidation

## Debugging Steps

### Step 1: Test Cache Invalidation

Run the cache invalidation test:

```bash
npm run cache:test
```

This will:
- Set test cache data
- Invalidate the cache
- Verify that all order-related keys are removed

### Step 2: Check Cache State

Use the debug endpoints to inspect cache state:

```bash
# View all cache keys
curl http://localhost:3000/cache/keys

# View cache statistics
curl http://localhost:3000/cache/stats

# Clear all cache
curl -X DELETE http://localhost:3000/cache/clear
```

### Step 3: Monitor Cache Operations

Start the server and watch the console logs:

```bash
npm run dev
```

Look for these log messages:
```
🔄 Invalidating cache after creating new order...
🗑️ Invalidated X cache keys: [key1, key2, ...]
✅ Cache invalidation completed
```

### Step 4: Test the Complete Flow

1. **Start fresh**: Clear all cache
   ```bash
   curl -X DELETE http://localhost:3000/cache/clear
   ```

2. **Get orders** (should hit database first time)
   ```bash
   curl http://localhost:3000/api/orders
   ```
   Look for: `🗄️ Orders retrieved from database`

3. **Get orders again** (should hit cache)
   ```bash
   curl http://localhost:3000/api/orders
   ```
   Look for: `📦 Orders retrieved from cache`

4. **Create a new order**
   ```bash
   curl -X POST http://localhost:3000/api/orders \
     -H "Content-Type: application/json" \
     -d '{
       "customerName": "Test User",
       "customerEmail": "test@example.com",
       "items": [
         {
           "productId": "test-001",
           "productName": "Test Product",
           "quantity": 1,
           "unitPrice": 10.00
         }
       ]
     }'
   ```
   Look for: `🔄 Invalidating cache after creating new order...`

5. **Get orders again** (should hit database due to cache invalidation)
   ```bash
   curl http://localhost:3000/api/orders
   ```
   Look for: `🗄️ Orders retrieved from database`

## Expected Behavior

### Before Fix
- ❌ Cache not cleared after creating orders
- ❌ Stale data returned from cache
- ❌ New orders not visible in subsequent requests

### After Fix
- ✅ Cache properly cleared after creating orders
- ✅ Fresh data retrieved from database
- ✅ New orders immediately visible in subsequent requests

## Debug Endpoints

### GET `/cache/keys`
Lists all cache keys currently stored in Redis.

**Response**:
```json
{
  "success": true,
  "data": [
    "order:123",
    "orders:list:all",
    "orders:list:filtered"
  ]
}
```

### GET `/cache/stats`
Shows cache statistics including key count and memory usage.

**Response**:
```json
{
  "success": true,
  "data": {
    "keys": 3,
    "memory": "2.5M"
  }
}
```

### DELETE `/cache/clear`
Clears all cache entries. Useful for testing and debugging.

**Response**:
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

## Common Issues and Solutions

### Issue 1: Cache Keys Not Found
**Symptoms**: Log shows "No cache keys found to invalidate"
**Solution**: Check if cache keys are being stored with correct patterns

### Issue 2: Partial Invalidation
**Symptoms**: Some cache keys remain after invalidation
**Solution**: Verify the key patterns in `invalidateOrderCache()` method

### Issue 3: Redis Connection Issues
**Symptoms**: Cache operations fail with connection errors
**Solution**: Check if Redis container is running: `docker ps`

## Testing Commands

### Test Redis Connection
```bash
npm run redis:test
```

### Test Database Connection
```bash
npm run db:test
```

### Test Cache Invalidation
```bash
npm run cache:test
```

### Manual Cache Testing
```bash
# Start services
npm run db:up

# Build project
npm run build

# Start server
npm run dev

# In another terminal, test the flow
curl -X DELETE http://localhost:3000/cache/clear
curl http://localhost:3000/api/orders
curl http://localhost:3000/api/orders
# Create order...
curl http://localhost:3000/api/orders
```

## Monitoring Cache State

### Real-time Monitoring
```bash
# Connect to Redis container
docker exec -it acmo-shop-redis redis-cli

# Monitor all Redis commands
MONITOR

# List all keys
KEYS *

# Check specific patterns
KEYS order:*
KEYS orders:list:*
```

### Application Logs
Watch for these log patterns:
- `📦` - Data retrieved from cache
- `🗄️` - Data retrieved from database
- `🔄` - Cache invalidation started
- `🗑️` - Cache keys invalidated
- `✅` - Operation completed successfully

## Verification Checklist

- [ ] Cache invalidation test passes: `npm run cache:test`
- [ ] Redis connection works: `npm run redis:test`
- [ ] Server starts without errors: `npm run dev`
- [ ] Cache keys endpoint works: `GET /cache/keys`
- [ ] Cache stats endpoint works: `GET /cache/stats`
- [ ] Cache clear endpoint works: `DELETE /cache/clear`
- [ ] Creating order triggers cache invalidation logs
- [ ] Subsequent GET requests return fresh data
- [ ] Cache keys are properly removed after invalidation

## If Issues Persist

1. **Check Redis logs**: `docker logs acmo-shop-redis`
2. **Verify Redis connection**: Check if Redis is accessible on port 6379
3. **Check application logs**: Look for Redis connection errors
4. **Verify key patterns**: Ensure cache keys match invalidation patterns
5. **Test with minimal data**: Use the test scripts to isolate the issue

## Performance Impact

After fixing the cache invalidation:
- **First request**: Hits database, stores in cache
- **Subsequent requests**: Served from cache (fast)
- **After data change**: Cache invalidated, next request hits database
- **Result**: Optimal performance with data consistency
