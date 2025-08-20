# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YAOGAN_CHAT is a remote sensing image analysis system that combines a React frontend with a Python FastAPI backend. The system uses Zhipu AI's GLM-4.5v multi-modal model for analyzing satellite and aerial imagery, with features for chat-based interactions, canvas-based annotation, and asynchronous task processing.

## Development Commands

### Frontend (React)
```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Eject (not recommended)
npm run eject
```

### Backend (FastAPI)
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start backend services (Linux/Mac)
./start.sh

# Start backend services (Windows)
./start.bat

# Manual startup:
# 1. Start FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Start Celery Worker (in separate terminal)
celery -A app.worker.celery_app worker --loglevel=info
```

### Docker
```bash
# Start all services with Docker Compose
docker-compose up

# Build and start
docker-compose up --build
```

## Architecture Overview

### Frontend Architecture
- **Framework**: React 19.1.1 with React Scripts
- **State Management**: React hooks with local state
- **Key Libraries**:
  - `react-konva` + `konva` for canvas-based image annotation
  - `react-markdown` with `rehype-katex` and `remark-math` for LaTeX rendering
  - `react-syntax-highlighter` for code block display
- **Authentication**: JWT token-based with demo account (`demo`/`password`)
- **Main Components**:
  - `App.js`: Main application component with authentication and chat management
  - `ChatContainer.js`: Handles chat interactions and message display
  - `CanvasDisplay.js`: Canvas component for image annotation
  - `Sidebar.js`: Chat history and user management

### Backend Architecture
- **Framework**: FastAPI with async support
- **Task Queue**: Celery with Redis for async image processing
- **Database**: SQLite with SQLAlchemy ORM
- **AI Integration**: Zhipu AI GLM-4.5v model for multi-modal analysis
- **Key Services**:
  - `zhipuai_service.py`: GLM-4.5v API integration
  - `tasks.py`: Celery tasks for async processing
  - `image_utils.py`: Image processing utilities

### API Structure
- **Base URL**: `http://localhost:8000/api`
- **Authentication**: Bearer token in Authorization header
- **Key Endpoints**:
  - `/users/token` - User login
  - `/users/chats` - Chat management
  - `/analyze/image/` - Image upload and analysis
  - `/tasks/{task_id}/` - Task status polling
  - `/chat/text` - Text-based queries
  - `/chat/text-async` - Async text processing

### Data Flow
1. User uploads image → Frontend stores and displays preview
2. User submits question → Frontend sends to backend via `/analyze/image/`
3. Backend creates Celery task → Returns task ID immediately
4. Frontend polls task status → Shows loading state
5. Celery worker processes image with GLM-4.5v → Stores results
6. Frontend receives completed results → Displays analysis with annotations

## Key Features

### Image Analysis
- Multi-modal analysis using GLM-4.5v model
- Support for description, detection, and segmentation tasks
- Canvas-based annotation with object marking
- Asynchronous processing with progress tracking

### Chat System
- Persistent chat history with SQLite backend
- Multi-turn conversations with image context
- Real-time message updates
- Chat management (create, delete, rename)

### Authentication
- JWT-based authentication
- Demo account for testing
- Token refresh and validation
- Automatic logout on authentication failure

## Configuration

### Environment Variables
Backend requires `.env` file with:
```
ZHIPUAI_API_KEY=your_api_key
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=["http://localhost:3000"]
UPLOAD_FOLDER=uploads
```

### Redis Setup
The backend requires Redis for Celery task queue:
```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis

# Docker
docker run -d --name redis -p 6379:6379 redis
```

## Important Implementation Details

### Image Processing
- Images are stored in `backend/uploads/` directory
- Static files served at `/api/uploads/` with CORS headers
- Image preprocessing before sending to GLM-4.5v model
- Base64 encoding for API transmission

### Async Task Handling
- Celery tasks for long-running AI analysis
- Task polling with timeout and error handling
- Support for task cancellation
- Progress tracking with callback functions

### Canvas Integration
- Konva.js for interactive image annotation
- Object marking with bounding boxes
- Coordinate mapping between original and displayed images
- Real-time canvas updates

### Error Handling
- Comprehensive error handling in API layer
- Authentication failure detection and automatic logout
- Network timeout and retry logic
- User-friendly error messages

## Testing and Development

### API Documentation
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Common Development Patterns
- Use React hooks for state management
- Implement proper error boundaries
- Follow async/await patterns for API calls
- Use FormData for file uploads
- Implement proper loading states

### Security Considerations
- Never expose API keys in frontend code
- Use environment variables for sensitive configuration
- Implement proper CORS policies
- Validate user inputs and file uploads
- Use HTTPS in production

## Deployment Notes

- Frontend can be deployed to Vercel/Netlify
- Backend requires Python environment with Redis
- Use Docker containers for consistent deployment
- Configure proper CORS origins for production
- Set up proper logging and monitoring