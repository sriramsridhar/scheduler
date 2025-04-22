# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Enum, Text, Boolean, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from enum import Enum as PyEnum
from datetime import datetime, timedelta
import uuid
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
import threading
from pydantic import BaseModel
from typing import Optional, List
import subprocess
import tempfile
import os
import shutil

# Delete existing database if it exists
db_path = "./jobs.db"
if os.path.exists(db_path):
    os.remove(db_path)

DATABASE_URL = "sqlite:///./jobs.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class JobStatus(PyEnum):
    SCHEDULED = "scheduled"
    STARTED = "started"
    RUNNING = "running"
    ENDED = "ended"
    FAILED = "failed"

class RecurrenceType(PyEnum):
    NONE = "NONE"
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"

class ScriptType(PyEnum):
    PYTHON = "python"
    BASH = "bash"

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, index=True)
    status = Column(Enum(JobStatus), default=JobStatus.SCHEDULED)
    scheduled_time = Column(DateTime, nullable=False)
    started_time = Column(DateTime, nullable=True)
    ended_time = Column(DateTime, nullable=True)
    code = Column(Text, nullable=True)  # Script code (Python or Bash)
    script_type = Column(Enum(ScriptType), default=ScriptType.PYTHON)  # Type of script
    stdout = Column(Text, nullable=True)  # Store standard output
    stderr = Column(Text, nullable=True)  # Store standard error
    execution_time = Column(String, nullable=True)  # Time taken to execute
    
    # Recurrence fields
    is_recurring = Column(Boolean, default=False)
    recurrence_type = Column(Enum(RecurrenceType), default=RecurrenceType.NONE)
    recurrence_value = Column(Integer, default=1)  # For example: 1 for hourly means every 1 hour
    last_run_time = Column(DateTime, nullable=True)
    next_run_time = Column(DateTime, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()
scheduler.start()
scheduler_lock = threading.Lock()

# Helper function to convert string recurrence type to enum
def string_to_recurrence_type(recurrence_str):
    """Convert a string recurrence type to the RecurrenceType enum value"""
    # Ensure uppercase
    recurrence_str = str(recurrence_str).upper() if recurrence_str else "NONE"
    
    try:
        return RecurrenceType[recurrence_str]
    except (KeyError, ValueError):
        print(f"Invalid recurrence type: {recurrence_str}. Using NONE.")
        return RecurrenceType.NONE

# Helper function to convert string script type to enum
def string_to_script_type(script_type_str):
    """Convert a string script type to the ScriptType enum value"""
    script_type_str = str(script_type_str).lower() if script_type_str else "python"
    
    try:
        return ScriptType[script_type_str.upper()]
    except (KeyError, ValueError):
        print(f"Invalid script type: {script_type_str}. Using PYTHON.")
        return ScriptType.PYTHON

def calculate_next_run_time(job):
    """Calculate the next run time based on recurrence settings"""
    if not job.is_recurring:
        return None
    
    if not job.last_run_time:
        # If this is the first run, use scheduled_time
        base_time = job.scheduled_time
    else:
        # Otherwise use the last run time
        base_time = job.last_run_time
    
    if job.recurrence_type == RecurrenceType.HOURLY:
        return base_time + timedelta(hours=job.recurrence_value)
    elif job.recurrence_type == RecurrenceType.DAILY:
        return base_time + timedelta(days=job.recurrence_value)
    elif job.recurrence_type == RecurrenceType.WEEKLY:
        return base_time + timedelta(weeks=job.recurrence_value)
    elif job.recurrence_type == RecurrenceType.MONTHLY:
        # Simple approximation for monthly (30 days)
        return base_time + timedelta(days=30 * job.recurrence_value)
    
    return None

def run_job(job_id: str):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = JobStatus.STARTED
        job.started_time = datetime.utcnow()
        job.stdout = None
        job.stderr = None
        job.execution_time = None
        db.commit()
        
        # Set status to running
        job.status = JobStatus.RUNNING
        db.commit()
        
        # Execute the code if available
        if job.code:
            try:
                # Record start time
                start_time = datetime.now()
                
                # Handle different script types
                if job.script_type == ScriptType.PYTHON:
                    # Create a temporary Python file
                    with tempfile.NamedTemporaryFile(suffix='.py', delete=False) as temp:
                        temp_filename = temp.name
                        temp.write(job.code.encode('utf-8'))
                    
                    # Execute the Python script
                    result = subprocess.run(['python3', temp_filename], 
                                           capture_output=True, 
                                           text=True, 
                                           timeout=60)
                elif job.script_type == ScriptType.BASH:
                    # Create a temporary Bash file
                    with tempfile.NamedTemporaryFile(suffix='.sh', delete=False) as temp:
                        temp_filename = temp.name
                        temp.write(job.code.encode('utf-8'))
                    
                    # Make the script executable
                    os.chmod(temp_filename, 0o755)
                    
                    # Execute the Bash script
                    result = subprocess.run(['bash', temp_filename], 
                                           capture_output=True, 
                                           text=True, 
                                           timeout=60)
                else:
                    raise ValueError(f"Unsupported script type: {job.script_type}")
                
                # Record end time and calculate duration
                end_time = datetime.now()
                duration = end_time - start_time
                
                # Store execution time as string
                job.execution_time = f"{duration.total_seconds():.2f} seconds"
                
                # Store stdout and stderr
                job.stdout = result.stdout
                job.stderr = result.stderr
                
                # Clean up the temporary file
                os.unlink(temp_filename)
                
                # Check if execution was successful
                if result.returncode == 0:
                    job.status = JobStatus.ENDED
                else:
                    job.status = JobStatus.FAILED
            except Exception as e:
                job.status = JobStatus.FAILED
                job.stderr = str(e)
                print(f"Error executing job {job_id}: {str(e)}")
        else:
            # No code to execute, just mark as completed
            job.status = JobStatus.ENDED
            job.stdout = "No code to execute"
        
        job.ended_time = datetime.utcnow()
        
        # Handle recurrence
        if job.is_recurring:
            job.last_run_time = job.ended_time
            job.next_run_time = calculate_next_run_time(job)
            
            # Reset status to scheduled for the next run
            if job.next_run_time is not None:
                job.status = JobStatus.SCHEDULED
                
                # Schedule the next run
                with scheduler_lock:
                    scheduler.add_job(
                        run_job,
                        trigger=DateTrigger(run_date=job.next_run_time),
                        args=[job.id],
                        id=f"recurring-{job.id}-{job.next_run_time.timestamp()}",
                        replace_existing=False
                    )
        
        db.commit()
    db.close()

def schedule_job(job_id):
    """Schedule a job with the APScheduler"""
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if job and job.status == JobStatus.SCHEDULED:
        with scheduler_lock:
            # If this is a recurring job, assign next_run_time
            if job.is_recurring and job.next_run_time is None:
                job.next_run_time = job.scheduled_time
                db.commit()
                
            scheduler.add_job(
                run_job,
                trigger=DateTrigger(run_date=job.scheduled_time),
                args=[job.id],
                id=job.id,
                replace_existing=True
            )
    
    db.close()

@app.on_event("startup")
def load_and_schedule_jobs():
    db = SessionLocal()
    scheduled_jobs = db.query(Job).filter(Job.status == JobStatus.SCHEDULED).all()
    
    for job in scheduled_jobs:
        # For recurring jobs, check if we need to update the scheduled time
        if job.is_recurring and job.next_run_time and job.next_run_time < datetime.utcnow():
            # Calculate a new next run time if we missed the previous one
            job.next_run_time = calculate_next_run_time(job)
            job.scheduled_time = job.next_run_time
            db.commit()
            
        schedule_job(job.id)
        
    db.close()

# Pydantic models
class RecurrenceSettings(BaseModel):
    is_recurring: bool = False
    recurrence_type: str = "NONE"
    recurrence_value: int = 1

class JobBase(BaseModel):
    name: str
    scheduled_time: datetime
    code: Optional[str] = None
    script_type: str = "python"  # Default to Python
    recurrence: Optional[RecurrenceSettings] = None

class JobCreate(JobBase):
    pass

class JobResponse(JobBase):
    id: str
    status: str
    started_time: Optional[datetime]
    ended_time: Optional[datetime]
    is_recurring: bool
    recurrence_type: str
    recurrence_value: int
    next_run_time: Optional[datetime]

    class Config:
        orm_mode = True

class JobDetailResponse(JobResponse):
    stdout: Optional[str]
    stderr: Optional[str]
    execution_time: Optional[str]
    last_run_time: Optional[datetime]

@app.post("/jobs/", response_model=JobResponse)
def create_job(job: JobCreate):
    db = SessionLocal()
    
    # Create the job with basic fields
    db_job = Job(
        name=job.name, 
        scheduled_time=job.scheduled_time,
        code=job.code,
        script_type=string_to_script_type(job.script_type)
    )
    
    # Handle recurrence settings if provided
    if job.recurrence and job.recurrence.is_recurring:
        db_job.is_recurring = True
        db_job.recurrence_type = string_to_recurrence_type(job.recurrence.recurrence_type)
        db_job.recurrence_value = job.recurrence.recurrence_value
    
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    # Schedule the job
    schedule_job(db_job.id)
    
    db.close()
    return db_job

@app.get("/jobs/", response_model=List[JobResponse])
def list_jobs():
    db = SessionLocal()
    jobs = db.query(Job).all()
    db.close()
    return jobs

@app.get("/jobs/{job_id}", response_model=JobDetailResponse)
def get_job(job_id: str):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    db.close()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: str):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    db.close()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "id": job.id,
        "name": job.name,
        "status": job.status.value,
        "script_type": job.script_type.value,
        "execution_time": job.execution_time,
        "stdout": job.stdout or "",
        "stderr": job.stderr or "",
        "is_recurring": job.is_recurring,
        "recurrence_type": job.recurrence_type.value,
        "next_run_time": job.next_run_time
    }

@app.put("/jobs/{job_id}", response_model=JobResponse)
def update_job(job_id: str, job_update: JobCreate):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update basic fields
    job.name = job_update.name
    job.scheduled_time = job_update.scheduled_time
    job.status = JobStatus.SCHEDULED
    job.started_time = None
    job.ended_time = None
    job.stdout = None
    job.stderr = None
    job.execution_time = None
    
    # Update code and script type if provided
    if job_update.code is not None:
        job.code = job_update.code
    
    if job_update.script_type is not None:
        job.script_type = string_to_script_type(job_update.script_type)
    
    # Update recurrence settings if provided
    if job_update.recurrence is not None:
        job.is_recurring = job_update.recurrence.is_recurring
        job.recurrence_type = string_to_recurrence_type(job_update.recurrence.recurrence_type)
        job.recurrence_value = job_update.recurrence.recurrence_value
        
        # Reset recurrence-related fields
        job.last_run_time = None
        job.next_run_time = None if not job.is_recurring else job.scheduled_time
    
    db.commit()
    db.refresh(job)
    
    # Re-schedule the job
    with scheduler_lock:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass
        
        schedule_job(job.id)
    
    db.close()
    return job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    db.close()
    with scheduler_lock:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass
    return {"message": "Job deleted"}

@app.post("/jobs/{job_id}/run")
def trigger_job_now(job_id: str):
    with scheduler_lock:
        scheduler.add_job(run_job, args=[job_id], id=f"manual-{job_id}", replace_existing=True)
    return {"message": "Job triggered"}
