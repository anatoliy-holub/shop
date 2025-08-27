# Database Setup Guide

This guide will help you set up PostgreSQL database for the ACMO Shop Backend.

## Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js** (v16 or higher)
3. **npm** package manager

## Quick Setup

### Option 1: Automated Setup (Recommended)

1. Make sure Docker Desktop is running
2. Run the setup script:
   ```bash
   ./setup.sh
   ```

This script will:
- Check if Docker is running
- Create a `.env` file with default database configuration
- Start the PostgreSQL database
- Build the project
- Provide next steps

### Option 2: Manual Setup

1. **Start Docker Desktop**

2. **Create environment file**:
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env with your preferred settings
   nano .env
   ```

3. **Start the database**:
   ```bash
   npm run db:up
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

## Database Configuration

The default database configuration in `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=acmo_shop
DB_USER=acmo_user
DB_PASSWORD=acmo_password
```

## Database Schema

The application automatically creates the following tables:

### Orders Table
- `id` - Primary key (VARCHAR)
- `customer_name` - Customer name (VARCHAR)
- `customer_email` - Customer email (VARCHAR)
- `total_amount` - Order total (DECIMAL)
- `status` - Order status (VARCHAR)
- `created_at` - Creation timestamp (TIMESTAMP)
- `updated_at` - Last update timestamp (TIMESTAMP)

### Order Items Table
- `id` - Primary key (SERIAL)
- `order_id` - Foreign key to orders (VARCHAR)
- `product_id` - Product identifier (VARCHAR)
- `product_name` - Product name (VARCHAR)
- `quantity` - Item quantity (INTEGER)
- `unit_price` - Unit price (DECIMAL)
- `total_price` - Item total (DECIMAL)

## Database Management Commands

```bash
# Start database
npm run db:up

# Stop database
npm run db:down

# Reset database (removes all data)
npm run db:reset

# Test database connection
npm run db:test
```

## Testing the Setup

1. **Test database connection**:
   ```bash
   npm run db:test
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Test the API**:
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Create an order
   curl -X POST http://localhost:3000/api/orders \
     -H "Content-Type: application/json" \
     -d '{
       "customerName": "John Doe",
       "customerEmail": "john@example.com",
       "items": [
         {
           "productId": "prod-001",
           "productName": "Laptop",
           "quantity": 1,
           "unitPrice": 999.99
         }
       ]
     }'
   ```

## Troubleshooting

### Docker Issues

**Error: "Cannot connect to the Docker daemon"**
- Make sure Docker Desktop is running
- On macOS, check if Docker Desktop is started from Applications

**Error: "Port already in use"**
- Check if port 5432 is already in use:
  ```bash
   lsof -i :5432
   ```
- Stop any existing PostgreSQL services

### Database Connection Issues

**Error: "Connection refused"**
- Ensure the database container is running:
  ```bash
   docker ps
   ```
- Check container logs:
  ```bash
   docker logs acmo-shop-postgres
   ```

**Error: "Authentication failed"**
- Verify the credentials in `.env` match the Docker Compose configuration
- Reset the database if needed:
  ```bash
   npm run db:reset
   ```

### Application Issues

**Error: "Module not found"**
- Rebuild the project:
  ```bash
   npm run build
   ```

**Error: "TypeScript compilation failed"**
- Check for syntax errors in source files
- Ensure all dependencies are installed:
  ```bash
   npm install
   ```

## Production Considerations

For production deployment:

1. **Use environment variables** for database credentials
2. **Use a managed PostgreSQL service** (AWS RDS, Google Cloud SQL, etc.)
3. **Implement connection pooling** for better performance
4. **Set up database backups** and monitoring
5. **Use SSL connections** for security

## Support

If you encounter issues:

1. Check the Docker container logs
2. Verify the database is accessible
3. Test the database connection manually
4. Check the application logs for detailed error messages
