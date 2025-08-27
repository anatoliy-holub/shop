# ACMO Shop Backend

A high-performance Node.js backend service built with Fastify, TypeScript, PostgreSQL, Redis caching, and SQS-like event processing.

## 🚀 Features

- **Fastify Framework**: High-performance web framework
- **TypeScript**: Full type safety and modern JavaScript features
- **PostgreSQL**: Robust relational database
- **Redis Caching**: Intelligent caching with automatic invalidation
- **SQS-like Event Processing**: Asynchronous order processing with FIFO queue
- **Swagger/OpenAPI**: Interactive API documentation
- **Docker Support**: Easy development and deployment
- **Event-Driven Architecture**: Decoupled API and database operations

## 🏗️ Architecture

The system uses an event-driven architecture where:

1. **API Endpoints** receive requests and queue events to SQS
2. **OrderSQS Service** emulates AWS SQS FIFO queue with deduplication
3. **OrderHandler Service** processes events asynchronously and updates the database
4. **Cache Service** provides intelligent caching with automatic invalidation

This architecture ensures:
- **High Availability**: API remains responsive even under heavy load
- **Scalability**: Multiple handlers can process events in parallel
- **Reliability**: Event processing with retry logic and deduplication
- **Performance**: Caching reduces database load

## 📋 API Endpoints

### Orders Management
- `POST /api/orders` - Create order (queues event)
- `GET /api/orders` - Get all orders (with caching and filtering)
- `GET /api/orders/:id` - Get order by ID (with caching)
- `PUT /api/orders/:id/status` - Update order status (queues event)
- `DELETE /api/orders/:id` - Delete order (queues event)

### Monitoring & Management
- `GET /health` - Health check
- `GET /cache/stats` - Cache statistics
- `DELETE /cache/clear` - Clear all cache
- `GET /cache/keys` - List all cache keys
- `GET /sqs/stats` - SQS queue statistics
- `DELETE /sqs/purge` - Purge SQS queue
- `GET /handler/status` - OrderHandler service status
- `GET /handler/stats` - OrderHandler and queue statistics

## 🛠️ Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd acmo-shop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start database services**
   ```bash
   npm run db:up
   ```

5. **Build and start the application**
   ```bash
   npm run build
   npm start
   ```

## 🚀 Development

```bash
# Start development server with hot reload
npm run dev

# Build the project
npm run build

# Start production server
npm start
```

## 🗄️ Database Management

```bash
# Start database services
npm run db:up

# Stop database services
npm run db:down

# Reset database (removes all data)
npm run db:reset
```

## 📊 Caching Strategy

The system implements intelligent caching with:

- **Cache Keys**: Generated based on query parameters and entity IDs
- **TTL Management**: Different TTL values for different data types
- **Automatic Invalidation**: Cache cleared when data changes
- **Cache Statistics**: Monitor cache performance and usage

## 🔄 Event Processing

### OrderSQS Service
- **FIFO Queue**: Ensures order of message processing
- **Deduplication**: Prevents duplicate message processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Message Groups**: Supports message grouping for ordered processing

### OrderHandler Service
- **Asynchronous Processing**: Processes events in background
- **Error Handling**: Graceful error handling with retry logic
- **Cache Management**: Automatically invalidates cache after operations
- **Monitoring**: Real-time status and statistics

## 📈 Performance Benefits

- **Reduced Latency**: Cache hits provide sub-millisecond response times
- **Higher Throughput**: Asynchronous processing handles more concurrent requests
- **Better Scalability**: Event-driven architecture supports horizontal scaling
- **Improved Reliability**: Retry logic and deduplication ensure data consistency

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/acmo_shop

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=acmo_shop:
```

### Docker Compose
The project includes Docker Compose configuration for:
- PostgreSQL 15 with persistent storage
- Redis 7 with persistent storage
- Health checks and proper networking

## 📁 Project Structure

```
acmo-shop/
├── src/
│   ├── config/          # Configuration files
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic and external services
│   │   ├── orderService.ts      # Database operations
│   │   ├── cacheService.ts      # Redis caching
│   │   ├── orderSQS.ts          # SQS-like queue service
│   │   └── orderHandler.ts      # Event processing service
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Application entry point
├── docker-compose.yml   # Database services
├── init.sql            # Database initialization
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## 🧪 Testing

The system includes comprehensive testing capabilities:

- **Cache Testing**: Verify cache operations and invalidation
- **Database Testing**: Test database connections and operations
- **SQS Testing**: Test queue operations and message processing
- **Integration Testing**: End-to-end API testing

## 🚀 Production Deployment

For production deployment:

1. **Environment Configuration**: Set production environment variables
2. **Database**: Use managed PostgreSQL service
3. **Redis**: Use managed Redis service or Redis Cluster
4. **Monitoring**: Enable logging and monitoring endpoints
5. **Scaling**: Deploy multiple OrderHandler instances for high throughput

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
