import { orderSQSService, OrderEventMessage } from './orderSQS.js';
import { orderService } from './orderService.js';
import { cacheService } from './cacheService.js';

class OrderHandlerService {
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly processingIntervalMs = 1000; // Process every second

  constructor() {
    // Listen for new messages
    orderSQSService.on('messageReceived', () => {
      if (!this.isRunning) {
        this.start();
      }
    });
  }

  /**
   * Start the order handler service
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 OrderHandler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting OrderHandler service...');

    this.processingInterval = setInterval(async () => {
      await this.processMessages();
    }, this.processingIntervalMs);
  }

  /**
   * Stop the order handler service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('🔄 OrderHandler is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('🛑 OrderHandler service stopped');
  }

  /**
   * Process messages from the SQS queue
   */
  private async processMessages(): Promise<void> {
    try {
      // Receive messages from the queue
      const messages = await orderSQSService.receiveMessage(5); // Process up to 5 messages at a time
      
      if (messages.length === 0) {
        return;
      }

      console.log(`📋 Processing ${messages.length} messages...`);

      // Process each message
      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('❌ Error processing messages:', error);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: OrderEventMessage): Promise<void> {
    const { Body: event, ReceiptHandle } = message;
    
    try {
      console.log(`🔄 Processing event: ${event.type} (ID: ${event.id})`);
      
      switch (event.type) {
        case 'CREATE':
          await this.handleCreateOrder(event);
          break;
        case 'UPDATE':
          await this.handleUpdateOrder(event);
          break;
        case 'DELETE':
          await this.handleDeleteOrder(event);
          break;
        default:
          console.warn(`⚠️ Unknown event type: ${event.type}`);
      }

      // Successfully processed, delete message from queue
      await orderSQSService.deleteMessage(ReceiptHandle);
      console.log(`✅ Successfully processed event: ${event.type} (ID: ${event.id})`);
      
    } catch (error) {
      console.error(`❌ Error processing event ${event.type} (ID: ${event.id}):`, error);
      
      // Return message to queue for retry
      await orderSQSService.returnMessage(ReceiptHandle, error as Error);
    }
  }

  /**
   * Handle CREATE order event
   */
  private async handleCreateOrder(event: any): Promise<void> {
    if (!event.data) {
      throw new Error('CREATE event missing order data');
    }

    console.log(`📝 Creating order for customer: ${event.data.customer_name}`);
    
    // Create the order in the database
    const createdOrder = await orderService.createOrder(event.data);
    
    if (!createdOrder) {
      throw new Error('Failed to create order');
    }

    console.log(`✅ Order created successfully: ${createdOrder.id}`);
    
    // Invalidate cache after successful creation
    await cacheService.invalidateOrderCache();
  }

  /**
   * Handle UPDATE order event
   */
  private async handleUpdateOrder(event: any): Promise<void> {
    if (!event.orderId) {
      throw new Error('UPDATE event missing orderId');
    }

    if (!event.data) {
      throw new Error('UPDATE event missing update data');
    }

    console.log(`📝 Updating order: ${event.orderId}`);
    
    // Update the order in the database
    const success = await orderService.updateOrderStatus(event.orderId, event.data.status);
    
    if (!success) {
      throw new Error(`Failed to update order ${event.orderId}`);
    }

    console.log(`✅ Order updated successfully: ${event.orderId}`);
    
    // Invalidate cache after successful update
    await cacheService.invalidateOrderCache(event.orderId);
  }

  /**
   * Handle DELETE order event
   */
  private async handleDeleteOrder(event: any): Promise<void> {
    if (!event.orderId) {
      throw new Error('DELETE event missing orderId');
    }

    console.log(`🗑️ Deleting order: ${event.orderId}`);
    
    // Delete the order from the database
    const success = await orderService.deleteOrder(event.orderId);
    
    if (!success) {
      throw new Error(`Failed to delete order ${event.orderId}`);
    }

    console.log(`✅ Order deleted successfully: ${event.orderId}`);
    
    // Invalidate cache after successful deletion
    await cacheService.invalidateOrderCache();
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; processingIntervalMs: number } {
    return {
      isRunning: this.isRunning,
      processingIntervalMs: this.processingIntervalMs
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    status: { isRunning: boolean; processingIntervalMs: number };
    queue: any;
  }> {
    const queueAttributes = await orderSQSService.getQueueAttributes();
    
    return {
      status: this.getStatus(),
      queue: queueAttributes
    };
  }
}

export const orderHandlerService = new OrderHandlerService();
