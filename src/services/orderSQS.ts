import { EventEmitter } from 'events';

export interface OrderEvent {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  orderId?: string;
  data?: any;
  timestamp: Date;
  groupId: string;
  deduplicationId: string;
}

export interface OrderEventMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: OrderEvent;
  Attributes: {
    SentTimestamp: number;
    GroupId: string;
    DeduplicationId: string;
  };
}

class OrderSQSService extends EventEmitter {
  private queue: OrderEventMessage[] = [];
  private processingQueue: OrderEventMessage[] = [];
  private processedMessages: Set<string> = new Set();
  private deduplicationCache: Map<string, number> = new Map();
  private deduplicationWindowMs = 5 * 60 * 1000; // 5 minutes
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor() {
    super();
    this.startCleanupInterval();
  }

  /**
   * Send a message to the SQS queue
   */
  async sendMessage(event: Omit<OrderEvent, 'id' | 'timestamp'>): Promise<{ MessageId: string }> {
    const messageId = this.generateMessageId();
    const timestamp = new Date();
    
    // Check deduplication
    if (this.isDuplicate(event.deduplicationId, timestamp)) {
      console.log(`🔄 Duplicate message detected: ${event.deduplicationId}`);
      return { MessageId: messageId };
    }

    const message: OrderEventMessage = {
      MessageId: messageId,
      ReceiptHandle: this.generateReceiptHandle(),
      Body: {
        ...event,
        id: messageId,
        timestamp
      },
      Attributes: {
        SentTimestamp: timestamp.getTime(),
        GroupId: event.groupId,
        DeduplicationId: event.deduplicationId
      }
    };

    this.queue.push(message);
    this.deduplicationCache.set(event.deduplicationId, timestamp.getTime());
    
    console.log(`📤 Message sent to SQS: ${messageId} (${event.type})`);
    this.emit('messageReceived', message);
    
    return { MessageId: messageId };
  }

  /**
   * Receive messages from the queue (simulates SQS receive)
   */
  async receiveMessage(maxNumberOfMessages: number = 10): Promise<OrderEventMessage[]> {
    const availableMessages = this.queue.filter(msg => 
      !this.processingQueue.some(processing => processing.MessageId === msg.MessageId) &&
      !this.processedMessages.has(msg.MessageId)
    );

    const messagesToReceive = availableMessages.slice(0, maxNumberOfMessages);
    
    if (messagesToReceive.length === 0) {
      return [];
    }

    // Move messages to processing queue
    messagesToReceive.forEach(msg => {
      this.processingQueue.push(msg);
    });

    console.log(`📥 Received ${messagesToReceive.length} messages from SQS`);
    return messagesToReceive;
  }

  /**
   * Delete a message from the queue (acknowledge successful processing)
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    const messageIndex = this.processingQueue.findIndex(msg => msg.ReceiptHandle === receiptHandle);
    
    if (messageIndex === -1) {
      throw new Error('Message not found in processing queue');
    }

    const message = this.processingQueue[messageIndex];
    this.processingQueue.splice(messageIndex, 1);
    this.processedMessages.add(message.MessageId);
    
    console.log(`✅ Message deleted from SQS: ${message.MessageId}`);
  }

  /**
   * Return a message to the queue (for retry scenarios)
   */
  async returnMessage(receiptHandle: string, error?: Error): Promise<void> {
    const messageIndex = this.processingQueue.findIndex(msg => msg.ReceiptHandle === receiptHandle);
    
    if (messageIndex === -1) {
      throw new Error('Message not found in processing queue');
    }

    const message = this.processingQueue[messageIndex];
    this.processingQueue.splice(messageIndex, 1);
    
    // Check if we should retry
    const retryCount = this.getRetryCount(message.MessageId);
    if (retryCount < this.maxRetries) {
      // Add delay before retry
      const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
      
      setTimeout(() => {
        this.queue.push(message);
        console.log(`🔄 Message returned to queue for retry: ${message.MessageId} (attempt ${retryCount + 1})`);
      }, delay);
    } else {
      // Max retries exceeded, mark as processed to avoid infinite loops
      this.processedMessages.add(message.MessageId);
      console.log(`❌ Message max retries exceeded: ${message.MessageId}`);
    }
  }

  /**
   * Get queue attributes
   */
  async getQueueAttributes(): Promise<{
    ApproximateNumberOfMessages: number;
    ApproximateNumberOfMessagesNotVisible: number;
    ApproximateNumberOfMessagesDelayed: number;
  }> {
    return {
      ApproximateNumberOfMessages: this.queue.length,
      ApproximateNumberOfMessagesNotVisible: this.processingQueue.length,
      ApproximateNumberOfMessagesDelayed: 0
    };
  }

  /**
   * Purge the queue (for testing purposes)
   */
  async purgeQueue(): Promise<void> {
    this.queue = [];
    this.processingQueue = [];
    this.processedMessages.clear();
    this.deduplicationCache.clear();
    console.log('🧹 Queue purged');
  }

  /**
   * Check if message is duplicate
   */
  private isDuplicate(deduplicationId: string, timestamp: Date): boolean {
    const lastSeen = this.deduplicationCache.get(deduplicationId);
    if (!lastSeen) return false;
    
    return (timestamp.getTime() - lastSeen) < this.deduplicationWindowMs;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate receipt handle
   */
  private generateReceiptHandle(): string {
    return `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get retry count for a message
   */
  private getRetryCount(messageId: string): number {
    // Simple retry tracking - in production you'd want more sophisticated tracking
    return 0; // For now, always allow retries
  }

  /**
   * Start cleanup interval for deduplication cache
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.deduplicationCache.entries()) {
        if (now - timestamp > this.deduplicationWindowMs) {
          this.deduplicationCache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }
}

export const orderSQSService = new OrderSQSService();
