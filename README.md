# Cron Scheduler App

A modern job scheduling application with a Python FastAPI backend and a React frontend. The backend uses SQLite to store and orchestrate jobs, tracking their status as scheduled, running, and completed.

## Features

### Scheduling Capabilities
- Create and schedule jobs to run at specific times
- Support for recurring jobs (hourly, daily, weekly, monthly)
- Manual job execution at any time
- Timezone support (currently set to Asia/Kolkata)

### Script Execution
- Support for multiple script types (Python, Bash)
- Code editor with syntax highlighting and line numbers
- Custom script code input

### Job Management
- List, create, edit, and delete jobs
- Filter jobs by status (scheduled, running, ended)
- View job execution logs (stdout/stderr)
- Track job status and execution time

### User Interface
- Modern, responsive Material UI design
- Dark mode support with persistent user preference
- Easy navigation between job listing and creation
- Real-time status updates with color-coded indicators

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

## Future Enhancements
Check the `Features.md` file for planned enhancements including:
- Cron expression support
- File upload for scripts
- Email/Slack notifications
- User authentication
- Workflow builder
- And more!

---

Feel free to contribute to the app with more features!
