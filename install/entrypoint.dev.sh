#!/bin/sh

set -e

echo "=== Starting NOMAD Development Entrypoint ==="

# Ensure required storage directories exist
mkdir -p /app/storage/logs /app/storage/kb_uploads

# Wait for Redis to be reachable
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
echo "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."
for i in $(seq 1 60); do
  if node -e "const net=require('net');const s=net.connect(Number(process.env.REDIS_PORT||6379),process.env.REDIS_HOST||'redis');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));" 2>/dev/null; then
    echo "Redis is up and running!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}" >&2
    exit 1
  fi
  sleep 1
done

# Wait for MySQL to be reachable
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 60); do
  if node -e "const net=require('net');const s=net.connect(Number(process.env.DB_PORT||3306),process.env.DB_HOST||'mysql');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));" 2>/dev/null; then
    echo "MySQL is reachable!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for MySQL at ${DB_HOST}:${DB_PORT}" >&2
    exit 1
  fi
  sleep 1
done

# Run AdonisJS migrations
echo "Running AdonisJS migrations..."
node ace migration:run --force || echo "Migration command finished with notice/error."

# Seed the database
echo "Seeding the database..."
node ace db:seed || echo "Database seeding finished with notice/error."

# Start background workers for queues
echo "Starting background workers for queues..."
node ace queue:work --all &

# Start AdonisJS development server with Hot Module Replacement (HMR)
echo "Starting AdonisJS development server with HMR..."
exec node ace serve --hmr
