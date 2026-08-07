# Cassandra Project - Docker Setup Guide

This guide explains how to run the entire Cassandra project (backend, frontend, and PostgreSQL database) using Docker and Docker Compose.

## Prerequisites

1. **Docker Desktop** installed and running
   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Install for Windows/Mac/Linux

2. **Docker Compose** (comes with Docker Desktop)

3. **At least 4GB RAM** available for containers

## Directory Structure

```
cassandra/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── docker-compose.yml
├── .env.docker (optional - for environment variables)
└── README.md (this file)
```

## Services

- **PostgreSQL** (port 5432): Database
- **Backend** (port 7676): NestJS API server
- **Frontend** (port 7678): React web application

## Quick Start (5 minutes)

### 1. Start All Services

From the `cassandra/` directory, run:

```powershell
docker-compose up -d
```

Or with logs visible:

```powershell
docker-compose up
```

This will:
- Pull required Docker images
- Build backend and frontend images
- Create and start all three containers
- Set up networking between services
- Initialize the PostgreSQL database

### 2. Verify Services Are Running

```powershell
docker-compose ps
```

Expected output (all should show "Up"):
```
NAME                 STATUS
cassandra-postgres   Up (healthy)
cassandra-backend    Up
cassandra-frontend   Up
```

### 3. Check Logs

View all logs:
```powershell
docker-compose logs -f
```

View specific service logs:
```powershell
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 4. Access the Application

- **Frontend**: [http://localhost:7678](http://localhost:7678)
- **Backend API**: [http://localhost:7676](http://localhost:7676)
- **Backend Health**: [http://localhost:7676/constants/public](http://localhost:7676/constants/public)

## Common Commands

### Start Services
```powershell
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Start specific service
docker-compose up -d backend
```

### Stop Services
```powershell
# Stop all services
docker-compose down

# Stop all services and remove volumes (delete database)
docker-compose down -v
```

### Rebuild Images
```powershell
# Rebuild all images
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### View Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 50 lines
docker-compose logs --tail=50 backend
```

### Connect to Database
```powershell
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d cassandra_dev

# List tables
\dt

# Exit
\q
```

### Shell Access
```powershell
# Access backend container shell
docker-compose exec backend sh

# Access frontend container shell
docker-compose exec frontend sh

# Exit
exit
```

## Environment Variables

Environment variables are defined in `docker-compose.yml`. To override them:

### Option 1: Create `.env` file in `cassandra/` directory
```
GOOGLE_CLIENT_ID=your-value
GOOGLE_CLIENT_SECRET=your-value
OPENAI_API_KEY=your-value
# ... more variables
```

### Option 2: Use `.env.docker` (provided template)
```powershell
cp .env.docker .env
# Edit .env with your actual values
docker-compose up -d
```

## Troubleshooting

### Port Already in Use
If a port is already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "9999:7676"  # Use port 9999 instead of 7676
```

### Backend Can't Connect to Database
- Check Postgres is running: `docker-compose logs postgres`
- Verify Postgres is healthy: `docker-compose ps` (should show "healthy")
- Restart backend: `docker-compose restart backend`

### Frontend Shows Blank Page
- Check backend is running: `docker-compose logs backend`
- Verify backend URL is correct: [http://localhost:7676/constants/public](http://localhost:7676/constants/public)
- Check frontend logs: `docker-compose logs frontend`

### Container Crashes Immediately
Check the logs:
```powershell
docker-compose logs backend
```

Common issues:
- Missing environment variables → Add to `.env` or `docker-compose.yml`
- Port conflicts → Change port in `docker-compose.yml`
- Insufficient memory → Increase Docker memory allocation

### Remove Everything and Start Fresh
```powershell
# Stop and remove all containers and volumes
docker-compose down -v

# Rebuild images from scratch
docker-compose up -d --build

# View logs to confirm startup
docker-compose logs -f
```

## Advanced

### Build Images Without Starting
```powershell
docker-compose build
```

### Run Commands in Container
```powershell
# Run npm command in backend
docker-compose exec backend npm run build:prod

# Run database migration
docker-compose exec backend npm run migrate
```

### Docker without Compose
If you prefer not to use Docker Compose:

**Start PostgreSQL:**
```powershell
docker run -d `
  --name cassandra-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=cassandra_dev `
  -p 5432:5432 `
  postgres:15
```

**Build Backend:**
```powershell
cd backend
docker build -t cassandra-backend .
docker run -d `
  -p 7676:7676 `
  -e DB_HOST=host.docker.internal `
  -e POSTGRES_PASSWORD=postgres `
  cassandra-backend
```

**Build Frontend:**
```powershell
cd frontend
docker build -t cassandra-frontend .
docker run -d -p 7678:7678 cassandra-frontend
```

## Notes

- Database data is persisted in Docker volume `cassandra_data`
- Services automatically restart if they crash
- Backend waits for database to be healthy before starting
- Frontend depends on backend being available
- Default credentials: postgres/postgres (change in production)

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Check Docker Desktop is running
4. Ensure ports 5432, 7676, 7678 are available
