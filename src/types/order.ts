export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_email: string;
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}
