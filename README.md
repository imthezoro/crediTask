# FreelanceFlow - Microservices Architecture

A modern freelance platform split into separate backend (Python/FastAPI) and frontend (TypeScript/React) services.

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with async/await support
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **API Documentation**: Auto-generated OpenAPI/Swagger docs
- **Caching**: Redis for session management and caching

### Frontend (TypeScript/React)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query for server state
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- PostgreSQL 15+ (for local development)

### Using Docker (Recommended)

1. **Clone and start all services:**
```bash
git clone <repository>
cd freelanceflow
docker-compose up --build
```

2. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Local Development

#### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. **Start the backend:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API URL
```

4. **Start the frontend:**
```bash
npm run dev
```

## 📁 Project Structure

```
freelanceflow/
├── backend/                 # Python/FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core functionality (config, database, security)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── main.py         # FastAPI application
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/               # TypeScript/React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/           # Utilities and API client
│   │   └── types/         # TypeScript types
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
└── docker-compose.yml     # Multi-service orchestration
```

## 🔧 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - User logout

### Users
- `GET /api/v1/users/` - List users
- `GET /api/v1/users/{user_id}` - Get user by ID
- `PUT /api/v1/users/me` - Update current user
- `DELETE /api/v1/users/me` - Delete current user

### Projects
- `GET /api/v1/projects/` - List projects
- `POST /api/v1/projects/` - Create project
- `GET /api/v1/projects/{project_id}` - Get project
- `PUT /api/v1/projects/{project_id}` - Update project
- `DELETE /api/v1/projects/{project_id}` - Delete project

### Tasks
- `GET /api/v1/tasks/` - List tasks
- `POST /api/v1/tasks/` - Create task
- `GET /api/v1/tasks/my-tasks` - Get user's assigned tasks
- `GET /api/v1/tasks/{task_id}` - Get task
- `PUT /api/v1/tasks/{task_id}` - Update task
- `POST /api/v1/tasks/{task_id}/claim` - Claim task
- `DELETE /api/v1/tasks/{task_id}` - Delete task

### Notifications
- `GET /api/v1/notifications/` - List notifications
- `PUT /api/v1/notifications/{notification_id}/read` - Mark as read
- `PUT /api/v1/notifications/mark-all-read` - Mark all as read
- `DELETE /api/v1/notifications/{notification_id}` - Delete notification

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **CORS Protection**: Configurable CORS policies
- **Input Validation**: Pydantic schemas for request validation
- **SQL Injection Protection**: SQLAlchemy ORM prevents SQL injection
- **Rate Limiting**: Built-in FastAPI rate limiting

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📦 Deployment

### Production Docker Build
```bash
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/freelanceflow
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-super-secret-key
ALLOWED_ORIGINS=https://yourdomain.com
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.