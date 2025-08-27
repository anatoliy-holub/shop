import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import postgres from '@fastify/postgres';
import { orderRoutes } from './routes/orders.js';
import { orderService } from './services/orderService.js';
import { cacheService } from './services/cacheService.js';
import { orderHandlerService } from './services/orderHandler.js';
import { orderSQSService } from './services/orderSQS.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(helmet);
await fastify.register(cors);
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'ACMO Shop API',
      description: 'REST API for ACMO Shop with PostgreSQL, Redis caching, and SQS-like event processing',
      version: '1.0.0'
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

await fastify.register(swaggerUi, {
  routePrefix: '/documentation'
});

await fastify.register(postgres, {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/acmo_shop'
});

// Register routes
await fastify.register(orderRoutes, { prefix: '/api' });

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'OK', timestamp: new Date().toISOString() };
});

// Cache management endpoints
fastify.get('/cache/stats', async (request, reply) => {
  const stats = await cacheService.getStats();
  return stats;
});

fastify.delete('/cache/clear', async (request, reply) => {
  await cacheService.clearAll();
  return { message: 'Cache cleared successfully' };
});

fastify.get('/cache/keys', async (request, reply) => {
  const keys = await cacheService.listAllKeys();
  return { keys };
});

// SQS monitoring endpoints
fastify.get('/sqs/stats', async (request, reply) => {
  const stats = await orderSQSService.getQueueAttributes();
  return stats;
});

fastify.delete('/sqs/purge', async (request, reply) => {
  await orderSQSService.purgeQueue();
  return { message: 'SQS queue purged successfully' };
});

// OrderHandler monitoring endpoints
fastify.get('/handler/status', async (request, reply) => {
  const status = orderHandlerService.getStatus();
  return status;
});

fastify.get('/handler/stats', async (request, reply) => {
  const stats = await orderHandlerService.getQueueStats();
  return stats;
});

// Start the server
try {
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
  console.log('🚀 Server is running on http://localhost:3000');
  console.log('📚 API Documentation available at http://localhost:3000/documentation');
  
  // Start the OrderHandler service
  console.log('🔄 Starting OrderHandler service...');
  orderHandlerService.start();
  
} catch (err) {
  console.error('Error starting server:', err);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  try {
    // Stop the OrderHandler service
    orderHandlerService.stop();
    
    // Close database connections
    await orderService.close();
    
    // Close cache connections
    await cacheService.close();
    
    // Close the server
    await fastify.close();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  try {
    // Stop the OrderHandler service
    orderHandlerService.stop();
    
    // Close database connections
    await orderService.close();
    
    // Close cache connections
    await cacheService.close();
    
    // Close the server
    await fastify.close();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});
