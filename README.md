# Scheduler App

A simple scheduler app with a Python FastAPI backend and a modern React frontend. The backend uses SQLite and orchestrates jobs, tracking their status as scheduled, started, running, and ended.

## Features
- Create, schedule, and monitor jobs
- Job statuses: scheduled, started, running, ended
- Modern React frontend
- Python FastAPI backend with SQLite
- Dockerized for easy setup

## Prerequisites
- Docker and Docker Compose installed

## Setup & Run

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd cron-scheduler-app
   ```

2. Build and start the app:
   ```sh
   docker-compose up --build
   ```

3. Access the app:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/docs

## Development
- Backend code: `backend/`
- Frontend code: `frontend/`

## Stopping the app
```sh
docker-compose down
```

---

Feel free to extend the app with more features!
