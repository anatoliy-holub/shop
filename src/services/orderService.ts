import { Pool, PoolClient } from 'pg';
import { Order, CreateOrderRequest, OrderStatus } from '../types/order.js';
import { databaseConfig } from '../config/database.js';
import { cacheService } from './cacheService.js';
import { CACHE_TTL } from '../config/redis.js';

class OrderService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(databaseConfig);
  }

  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const orderId = this.generateId();
      const totalAmount = this.calculateTotalAmount(orderData.items);
      
      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (id, customer_name, customer_email, total_amount, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [orderId, orderData.customer_name, orderData.customer_email, totalAmount, OrderStatus.PENDING]
      );
      
      const order = orderResult.rows[0];
      
      // Insert order items
      for (const item of orderData.items) {
        const totalPrice = item.quantity * item.unit_price;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, totalPrice]
        );
      }
      
      await client.query('COMMIT');
      
      // Fetch complete order with items
      const createdOrder = await this.getOrderById(orderId);
      if (!createdOrder) {
        throw new Error('Failed to create order');
      }
      
      // Invalidate cache after creating new order
      console.log('🔄 Invalidating cache after creating new order...');
      await cacheService.invalidateOrderCache(orderId);
      console.log('✅ Cache invalidation completed');
      
      return createdOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllOrders(query?: Record<string, any>): Promise<Order[]> {
    // Try to get from cache first
    const cacheKey = cacheService.generateOrdersListKey(query);
    const cachedOrders = await cacheService.get<Order[]>(cacheKey);
    
    if (cachedOrders) {
      console.log('📦 Orders retrieved from cache');
      return cachedOrders;
    }
    
    // If not in cache, get from database
    console.log('🗄️ Orders retrieved from database');
    const result = await this.pool.query(`
      SELECT 
        o.id,
        o.customer_name,
        o.customer_email,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at,
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id, o.customer_name, o.customer_email, o.total_amount, o.status, o.created_at, o.updated_at
      ORDER BY o.created_at DESC
    `);
    
    const orders = result.rows.map(this.mapDbRowToOrder);
    
    // Store in cache
    await cacheService.set(cacheKey, orders, CACHE_TTL.ORDERS);
    
    return orders;
  }

  async getOrderById(id: string): Promise<Order | null> {
    // Try to get from cache first
    const cacheKey = cacheService.generateOrderKey(id);
    const cachedOrder = await cacheService.get<Order>(cacheKey);
    
    if (cachedOrder) {
      console.log(`📦 Order ${id} retrieved from cache`);
      return cachedOrder;
    }
    
    // If not in cache, get from database
    console.log(`🗄️ Order ${id} retrieved from database`);
    const result = await this.pool.query(`
      SELECT 
        o.id,
        o.customer_name,
        o.customer_email,
        o.total_amount,
        o.status,
        o.created_at,
        o.updated_at,
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id, o.customer_name, o.customer_email, o.total_amount, o.status, o.created_at, o.updated_at
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const order = this.mapDbRowToOrder(result.rows[0]);
    
    // Store in cache
    await cacheService.set(cacheKey, order, CACHE_TTL.ORDER_DETAILS);
    
    return order;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const result = await this.pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Invalidate cache after updating order
    console.log(`🔄 Invalidating cache after updating order ${id}...`);
    await cacheService.invalidateOrderCache(id);
    console.log('✅ Cache invalidation completed');
    
    return await this.getOrderById(id);
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM orders WHERE id = $1`,
      [id]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      // Invalidate cache after deleting order
      console.log(`🔄 Invalidating cache after deleting order ${id}...`);
      await cacheService.invalidateOrderCache(id);
      console.log('✅ Cache invalidation completed');
      return true;
    }
    
    return false;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private calculateTotalAmount(items: any[]): number {
    return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  }

  private mapDbRowToOrder(dbRow: any): Order {
    return {
      id: dbRow.id,
      customer_name: dbRow.customer_name,
      customer_email: dbRow.customer_email,
      items: dbRow.items || [],
      total_amount: parseFloat(dbRow.total_amount),
      status: dbRow.status as OrderStatus,
      created_at: new Date(dbRow.created_at),
      updated_at: new Date(dbRow.updated_at)
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const orderService = new OrderService();
