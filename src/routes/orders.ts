import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Order, CreateOrderRequest, OrderStatus } from '../types/order.js';
import { orderService } from '../services/orderService.js';
import { cacheService } from '../services/cacheService.js';
import { orderSQSService } from '../services/orderSQS.js';

export async function orderRoutes(fastify: FastifyInstance) {
  // POST /orders - Create a new order
  fastify.post('/orders', {
    schema: {
      description: 'Create a new order (adds to SQS queue)',
      tags: ['Orders'],
      body: {
        type: 'object',
        required: ['customer_name', 'customer_email', 'items'],
        properties: {
          customer_name: { type: 'string', minLength: 1 },
          customer_email: { type: 'string', format: 'email' },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['product_id', 'product_name', 'quantity', 'unit_price'],
              properties: {
                product_id: { type: 'string' },
                product_name: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                unit_price: { type: 'number', minimum: 0 }
              }
            }
          }
        }
      },
      response: {
        201: {
          description: 'Order creation event queued successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            messageId: { type: 'string' },
            orderId: { type: 'string' }
          }
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateOrderRequest }>, reply: FastifyReply) => {
    try {
      const orderData = request.body;
      
      // Generate a unique order ID for the event
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Send CREATE event to SQS queue
      const result = await orderSQSService.sendMessage({
        type: 'CREATE',
        orderId,
        data: orderData,
        groupId: 'orders', // All order events go to the same group for FIFO ordering
        deduplicationId: `create_${orderId}_${Date.now()}`
      });

      reply.status(201).send({
        message: 'Order creation event queued successfully',
        messageId: result.MessageId,
        orderId
      });
    } catch (error) {
      console.error('Error queuing order creation:', error);
      reply.status(500).send({ error: 'Failed to queue order creation' });
    }
  });

  // GET /orders - Get all orders (with caching)
  fastify.get('/orders', {
    schema: {
      description: 'Get all orders with optional filtering and caching',
      tags: ['Orders'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          description: 'List of orders',
          type: 'object',
          properties: {
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  customer_name: { type: 'string' },
                  customer_email: { type: 'string' },
                  total_amount: { type: 'number' },
                  status: { type: 'string' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        product_id: { type: 'string' },
                        product_name: { type: 'string' },
                        quantity: { type: 'integer' },
                        unit_price: { type: 'number' },
                        total_price: { type: 'number' }
                      }
                    }
                  }
                }
              }
            },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { status?: OrderStatus; limit?: number; offset?: number } }>, reply: FastifyReply) => {
    try {
      const { status, limit = 20, offset = 0 } = request.query;
      
      // Generate cache key based on query parameters
      const cacheKey = cacheService.generateOrdersListKey({ status, limit, offset });
      
      // Try to get from cache first
      let orders = await cacheService.get<Order[]>(cacheKey);
      
      if (orders) {
        console.log('💾 Cache hit for orders list');
        const result = {
          orders,
          total: orders.length,
          limit,
          offset
        };
        return reply.send(result);
      }
      
      console.log('💾 Cache miss for orders list, fetching from database');
      
      // Get from database
      orders = await orderService.getAllOrders({ status, limit, offset });
      
      // Store in cache
      await cacheService.set(cacheKey, orders, 300); // 5 minutes TTL
      
      const result = {
        orders,
        total: orders.length,
        limit,
        offset
      };
      
      reply.send(result);
    } catch (error) {
      console.error('Error getting orders:', error);
      reply.status(500).send({ error: 'Failed to get orders' });
    }
  });

  // GET /orders/:id - Get order by ID (with caching)
  fastify.get('/orders/:id', {
    schema: {
      description: 'Get order by ID with caching',
      tags: ['Orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Order details',
          type: 'object',
          properties: {
            id: { type: 'string' },
            customer_name: { type: 'string' },
            customer_email: { type: 'string' },
            total_amount: { type: 'number' },
            status: { type: 'string' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  product_id: { type: 'string' },
                  product_name: { type: 'string' },
                  quantity: { type: 'integer' },
                  unit_price: { type: 'number' },
                  total_price: { type: 'number' }
                }
              }
            }
          }
        },
        404: {
          description: 'Order not found',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Generate cache key
      const cacheKey = cacheService.generateOrderKey(id);
      
      // Try to get from cache first
      let order = await cacheService.get<Order>(cacheKey);
      
      if (order) {
        console.log('💾 Cache hit for order:', id);
        return reply.send(order);
      }
      
      console.log('💾 Cache miss for order:', id, 'fetching from database');
      
      // Get from database
      order = await orderService.getOrderById(id);
      
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      
      // Store in cache
      await cacheService.set(cacheKey, order, 600); // 10 minutes TTL
      
      reply.send(order);
    } catch (error) {
      console.error('Error getting order:', error);
      reply.status(500).send({ error: 'Failed to get order' });
    }
  });

  // PUT /orders/:id/status - Update order status (adds to SQS queue)
  fastify.put('/orders/:id/status', {
    schema: {
      description: 'Update order status (adds to SQS queue)',
      tags: ['Orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'] }
        }
      },
      response: {
        200: {
          description: 'Order status update event queued successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            messageId: { type: 'string' },
            orderId: { type: 'string' }
          }
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { status: OrderStatus } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;
      
      // Send UPDATE event to SQS queue
      const result = await orderSQSService.sendMessage({
        type: 'UPDATE',
        orderId: id,
        data: { status },
        groupId: 'orders',
        deduplicationId: `update_${id}_${status}_${Date.now()}`
      });

      reply.send({
        message: 'Order status update event queued successfully',
        messageId: result.MessageId,
        orderId: id
      });
    } catch (error) {
      console.error('Error queuing order status update:', error);
      reply.status(500).send({ error: 'Failed to queue order status update' });
    }
  });

  // DELETE /orders/:id - Delete order (adds to SQS queue)
  fastify.delete('/orders/:id', {
    schema: {
      description: 'Delete order (adds to SQS queue)',
      tags: ['Orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Order deletion event queued successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            messageId: { type: 'string' },
            orderId: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Send DELETE event to SQS queue
      const result = await orderSQSService.sendMessage({
        type: 'DELETE',
        orderId: id,
        data: {},
        groupId: 'orders',
        deduplicationId: `delete_${id}_${Date.now()}`
      });

      reply.send({
        message: 'Order deletion event queued successfully',
        messageId: result.MessageId,
        orderId: id
      });
    } catch (error) {
      console.error('Error queuing order deletion:', error);
      reply.status(500).send({ error: 'Failed to queue order deletion' });
    }
  });
}
