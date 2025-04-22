import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Container, Typography, Box, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Snackbar, Alert, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Chip, FormControlLabel, Switch, FormControl, InputLabel, Select, MenuItem, FormHelperText
} from "@mui/material";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/Info';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Configure dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Kolkata"); // Set IST as default timezone

const API_URL = "http://localhost:8000";

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editName, setEditName] = useState("");
  const [editScheduledTime, setEditScheduledTime] = useState(null);
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'scheduled', 'running', 'ended'
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [jobLogs, setJobLogs] = useState({ stdout: "", stderr: "", status: "", execution_time: "" });
  const [selectedJobName, setSelectedJobName] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // New job form state
  const [newJobName, setNewJobName] = useState("");
  const [newJobCode, setNewJobCode] = useState("# Enter your Python script here\n\ndef main():\n    print('Hello from scheduled job!')\n\nif __name__ == '__main__':\n    main()");
  const [scriptType, setScriptType] = useState("python");
  const [newJobScheduledTime, setNewJobScheduledTime] = useState(dayjs().add(1, 'hour'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("DAILY");
  const [recurrenceValue, setRecurrenceValue] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/jobs/`);
      setJobs(res.data);
    } catch (err) {
      setError("Failed to fetch jobs");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleEdit = (job) => {
    setEditingJob(job.id);
    setEditName(job.name);
    setEditScheduledTime(dayjs(job.scheduled_time).tz("Asia/Kolkata"));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // Send time in IST format
      const istTime = dayjs(editScheduledTime).tz("Asia/Kolkata").format();
      
      // For now, we don't allow editing recurrence settings
      // This would need a more complete edit form
      await axios.put(`${API_URL}/jobs/${editingJob}`, {
        name: editName,
        scheduled_time: istTime,
      });
      setEditingJob(null);
      fetchJobs();
    } catch (err) {
      setError("Failed to update job");
    }
  };

  const handleDelete = async (jobId) => {
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_URL}/jobs/${jobToDelete}`);
      fetchJobs();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (err) {
      setError("Failed to delete job");
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  const handleManualRun = async (jobId) => {
    try {
      await axios.post(`${API_URL}/jobs/${jobId}/run`);
      fetchJobs();
    } catch (err) {
      setError("Failed to run job");
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!newJobName || !newJobScheduledTime || !newJobCode) {
      setError("All fields are required");
      return;
    }

    setCreateLoading(true);
    try {
      // Send time in IST format
      const istTime = dayjs(newJobScheduledTime).tz("Asia/Kolkata").format();
      
      const jobData = {
        name: newJobName,
        scheduled_time: istTime,
        code: newJobCode,
        script_type: scriptType
      };
      
      // Add recurrence settings if enabled
      if (isRecurring) {
        jobData.recurrence = {
          is_recurring: true,
          recurrence_type: recurrenceType.toUpperCase(),  // Convert to uppercase to match enum
          recurrence_value: parseInt(recurrenceValue, 10)
        };
      }
      
      await axios.post(`${API_URL}/jobs/`, jobData);
      
      setCurrentPage('home');
      setNewJobName("");
      setNewJobCode("# Enter your Python script here\n\ndef main():\n    print('Hello from scheduled job!')\n\nif __name__ == '__main__':\n    main()");
      setScriptType("python");
      setNewJobScheduledTime(dayjs().add(1, 'hour'));
      setIsRecurring(false);
      setRecurrenceType("DAILY");
      setRecurrenceValue(1);
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job");
    } finally {
      setCreateLoading(false);
    }
  };

  // Function to get the default code template based on script type
  const getDefaultCodeTemplate = (type) => {
    if (type === "bash") {
      return "#!/bin/bash\n\n# Enter your Bash script here\necho \"Hello from scheduled job!\"";
    } else {
      return "# Enter your Python script here\n\ndef main():\n    print('Hello from scheduled job!')\n\nif __name__ == '__main__':\n    main()";
    }
  };

  // Handle script type change
  const handleScriptTypeChange = (e) => {
    const newType = e.target.value;
    setScriptType(newType);
    
    // Update code template if the current code is a template (hasn't been modified by user)
    const isPythonTemplate = newJobCode === getDefaultCodeTemplate("python");
    const isBashTemplate = newJobCode === getDefaultCodeTemplate("bash");
    
    if (isPythonTemplate || isBashTemplate) {
      setNewJobCode(getDefaultCodeTemplate(newType));
    }
  };

  const handleViewLogs = async (jobId, jobName) => {
    setSelectedJobName(jobName);
    setLoadingLogs(true);
    setLogDialogOpen(true);
    
    try {
      const res = await axios.get(`${API_URL}/jobs/${jobId}/logs`);
      setJobLogs(res.data);
    } catch (err) {
      setError("Failed to fetch job logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Format time to IST with timezone indicator
  const formatToIST = (time) => {
    return dayjs(time).tz("Asia/Kolkata").format('YYYY-MM-DD HH:mm [IST]');
  };

  // Get color for status chip
  const getStatusColor = (status) => {
    if (!status) return 'default';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'scheduled' || statusLower === 'pending') {
      return 'primary';
    }
    
    if (statusLower === 'started' || statusLower === 'running' || statusLower === 'in_progress') {
      return 'warning';
    }
    
    if (statusLower === 'ended' || statusLower === 'completed' || statusLower === 'success') {
      return 'success';
    }
    
    if (statusLower === 'failed' || statusLower === 'error') {
      return 'error';
    }
    
    return 'default';
  };

  // Format recurrence details for display
  const formatRecurrenceInfo = (job) => {
    if (!job.is_recurring) return "One-time";
    
    const value = job.recurrence_value;
    const type = job.recurrence_type.toLowerCase();
    
    switch (type) {
      case "hourly":
        return `Every ${value} hour${value > 1 ? 's' : ''}`;
      case "daily":
        return `Every ${value} day${value > 1 ? 's' : ''}`;
      case "weekly":
        return `Every ${value} week${value > 1 ? 's' : ''}`;
      case "monthly":
        return `Every ${value} month${value > 1 ? 's' : ''}`;
      default:
        return "Custom";
    }
  };

  // Filter jobs based on status
  const filteredJobs = jobs.filter(job => {
    if (statusFilter === 'all') return true;
    
    const status = job.status.toLowerCase();
    
    if (statusFilter === 'scheduled') {
      return status === 'scheduled' || status === 'pending';
    }
    
    if (statusFilter === 'running') {
      return status === 'running' || status === 'in_progress' || status === 'in progress';
    }
    
    if (statusFilter === 'ended') {
      return status === 'ended' || status === 'completed' || status === 'failed' || status === 'success';
    }
    
    return status === statusFilter;
  });

  const renderHomePage = () => (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Scheduler App</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCurrentPage('create')}
        >
          New Job
        </Button>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>Jobs</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button 
            variant={statusFilter === 'all' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button 
            variant={statusFilter === 'scheduled' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setStatusFilter('scheduled')}
          >
            Scheduled
          </Button>
          <Button 
            variant={statusFilter === 'running' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setStatusFilter('running')}
          >
            Running
          </Button>
          <Button 
            variant={statusFilter === 'ended' ? 'contained' : 'outlined'} 
            size="small"
            onClick={() => setStatusFilter('ended')}
          >
            Ended
          </Button>
        </Box>
      </Box>
      
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Scheduled (IST)</TableCell>
                <TableCell>Recurrence</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobs.map(job => (
                <TableRow key={job.id}>
                  {editingJob === job.id ? (
                    <>
                      <TableCell>
                        <TextField
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status} 
                          color={getStatusColor(job.status)} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.script_type} 
                          color={job.script_type === 'python' ? 'primary' : 'secondary'} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <DateTimePicker
                          value={editScheduledTime}
                          onChange={setEditScheduledTime}
                          timezone="Asia/Kolkata"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatRecurrenceInfo(job)}</TableCell>
                      <TableCell>
                        <Button onClick={handleEditSubmit} variant="contained" size="small" sx={{ mr: 1 }}>Save</Button>
                        <Button onClick={() => setEditingJob(null)} size="small">Cancel</Button>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{job.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={job.status} 
                          color={getStatusColor(job.status)} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.script_type} 
                          color={job.script_type === 'python' ? 'primary' : 'secondary'} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatToIST(job.scheduled_time)}</TableCell>
                      <TableCell>{formatRecurrenceInfo(job)}</TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleEdit(job)} color="primary"><EditIcon /></IconButton>
                        <IconButton onClick={() => handleDelete(job.id)} color="error"><DeleteIcon /></IconButton>
                        <IconButton onClick={() => handleManualRun(job.id)} color="success"><PlayArrowIcon /></IconButton>
                        <IconButton onClick={() => handleViewLogs(job.id, job.name)} color="info"><InfoIcon /></IconButton>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError("")}> 
        <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete this job? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog
        open={logDialogOpen}
        onClose={() => setLogDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Logs for: {selectedJobName}
        </DialogTitle>
        <DialogContent>
          {loadingLogs ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Status</Typography>
                  <Chip 
                    label={jobLogs.status} 
                    color={getStatusColor(jobLogs.status)} 
                    size="small" 
                  />
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Script Type</Typography>
                  <Chip 
                    label={jobLogs.script_type || "python"} 
                    color={jobLogs.script_type === 'bash' ? 'secondary' : 'primary'} 
                    size="small" 
                  />
                </Box>
              </Box>
              
              {jobLogs.execution_time && (
                <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                  Execution time: {jobLogs.execution_time}
                </Typography>
              )}
              
              <Typography variant="subtitle2" gutterBottom>Standard Output</Typography>
              <Box 
                sx={{ 
                  backgroundColor: '#f5f5f5', 
                  p: 2, 
                  borderRadius: 1, 
                  mb: 2,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}
              >
                {jobLogs.stdout || "No output"}
              </Box>
              
              {jobLogs.stderr && (
                <>
                  <Typography variant="subtitle2" gutterBottom>Standard Error</Typography>
                  <Box 
                    sx={{ 
                      backgroundColor: '#fef6f6', 
                      p: 2, 
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}
                  >
                    {jobLogs.stderr}
                  </Box>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );

  const renderCreateJobPage = () => (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4">Create New Job</Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => setCurrentPage('home')}
        >
          Back to Jobs
        </Button>
      </Box>
      
      <Box component="form" onSubmit={handleCreateJob} sx={{ mb: 3 }}>
        <TextField
          label="Job Name"
          variant="outlined"
          value={newJobName}
          onChange={e => setNewJobName(e.target.value)}
          required
          fullWidth
          sx={{ mb: 3 }}
        />
        
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Script Type</InputLabel>
            <Select
              value={scriptType}
              onChange={handleScriptTypeChange}
              label="Script Type"
            >
              <MenuItem value="python">Python</MenuItem>
              <MenuItem value="bash">Bash</MenuItem>
            </Select>
            <FormHelperText>
              {scriptType === "python" ? "Python script will be executed using python3" : "Bash script will be executed as a shell script"}
            </FormHelperText>
          </FormControl>
          
          <Typography variant="subtitle1" gutterBottom>Script Code</Typography>
          <Box sx={{ border: '1px solid #ccc', borderRadius: 1, mb: 3 }}>
            <TextField
              value={newJobCode}
              onChange={(e) => setNewJobCode(e.target.value)}
              multiline
              rows={15}
              fullWidth
              sx={{
                fontFamily: 'monospace',
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                },
              }}
            />
          </Box>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Schedule Settings</Typography>
          
          <Box sx={{ mb: 2 }}>
            <DateTimePicker
              label="First Run Time (IST)"
              value={newJobScheduledTime}
              onChange={setNewJobScheduledTime}
              timezone="Asia/Kolkata"
              sx={{ width: '100%' }}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Switch 
                checked={isRecurring} 
                onChange={(e) => setIsRecurring(e.target.checked)} 
              />
            }
            label="Recurring Job"
          />
          
          {isRecurring && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  label="Frequency"
                >
                  <MenuItem value="HOURLY">Hourly</MenuItem>
                  <MenuItem value="DAILY">Daily</MenuItem>
                  <MenuItem value="WEEKLY">Weekly</MenuItem>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Every"
                type="number"
                inputProps={{ min: 1 }}
                value={recurrenceValue}
                onChange={(e) => setRecurrenceValue(e.target.value)}
                sx={{ width: 100 }}
              />
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography>
                  {recurrenceType === "HOURLY" && `hour${recurrenceValue > 1 ? 's' : ''}`}
                  {recurrenceType === "DAILY" && `day${recurrenceValue > 1 ? 's' : ''}`}
                  {recurrenceType === "WEEKLY" && `week${recurrenceValue > 1 ? 's' : ''}`}
                  {recurrenceType === "MONTHLY" && `month${recurrenceValue > 1 ? 's' : ''}`}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
          disabled={createLoading}
          sx={{ minWidth: 120 }}
        >
          {createLoading ? <CircularProgress size={24} /> : "Save Job"}
        </Button>
      </Box>
      
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError("")}> 
        <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
      </Snackbar>
    </Container>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {currentPage === 'home' ? renderHomePage() : renderCreateJobPage()}
    </LocalizationProvider>
  );
}

export default App;
