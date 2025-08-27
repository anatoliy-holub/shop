#!/bin/bash

echo "🚀 Setting up ACMO Shop Backend with PostgreSQL and Redis..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=acmo_shop
DB_USER=acmo_user
DB_PASSWORD=acmo_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Server Configuration
NODE_ENV=development
PORT=3000
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Start PostgreSQL and Redis databases
echo "🐘 Starting PostgreSQL and Redis databases..."
npm run db:up

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 15

# Test database connections
echo "🔌 Testing database connections..."
echo "Testing PostgreSQL..."
npm run db:test

echo "Testing Redis..."
npm run redis:test

# Build the project
echo "🔨 Building the project..."
npm run build

echo "🎉 Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To view the API documentation:"
echo "  http://localhost:3000/documentation"
echo ""
echo "Database management commands:"
echo "  npm run db:up      - Start databases"
echo "  npm run db:down    - Stop databases"
echo "  npm run db:reset   - Reset databases"
echo "  npm run db:test    - Test PostgreSQL"
echo "  npm run redis:test - Test Redis"
echo ""
echo "Cache management:"
echo "  GET  /cache/stats  - View cache statistics"
echo "  DELETE /cache/clear - Clear all cache"
