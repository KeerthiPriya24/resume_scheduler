import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import RecruiterDashboard from './pages/RecruiterDashboard';
import PostJob from './pages/PostJob';
import JobSeekerDashboard from './pages/JobSeekerDashboard';
import BrowseJobs from './pages/BrowseJobs';
import JobDetails from './pages/JobDetails';
import MyApplications from './pages/MyApplications';
import PipelineView from './pages/PipelineView';
import SchedulingChatbot from './pages/SchedulingChatbot';

import AvailabilitySettings from './pages/AvailabilitySettings';
import Profile from './pages/Profile';

export default function App() {
    const { user } = useAuth();

    return (
        <div className="app">
            <Navbar />
            <main className="main-content">
                <Routes>
                    <Route path="/login" element={user ? <Navigate to={user.role === 'recruiter' ? '/recruiter/dashboard' : '/jobseeker/dashboard'} /> : <Login />} />
                    <Route path="/register" element={user ? <Navigate to={user.role === 'recruiter' ? '/recruiter/dashboard' : '/jobseeker/dashboard'} /> : <Register />} />

                    {/* Recruiter Routes */}
                    <Route path="/recruiter/dashboard" element={<ProtectedRoute role="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
                    <Route path="/recruiter/post-job" element={<ProtectedRoute role="recruiter"><PostJob /></ProtectedRoute>} />
                    <Route path="/recruiter/pipeline/:jobId" element={<ProtectedRoute role="recruiter"><PipelineView /></ProtectedRoute>} />
                    <Route path="/recruiter/availability" element={<ProtectedRoute role="recruiter"><AvailabilitySettings /></ProtectedRoute>} />

                    {/* Job Seeker Routes */}
                    <Route path="/jobseeker/dashboard" element={<ProtectedRoute role="jobseeker"><JobSeekerDashboard /></ProtectedRoute>} />
                    <Route path="/jobs" element={<BrowseJobs />} />
                    <Route path="/job/:id" element={<JobDetails />} />
                    <Route path="/my-applications" element={<ProtectedRoute role="jobseeker"><MyApplications /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                    {/* Public Routes */}
                    <Route path="/schedule/:token" element={<SchedulingChatbot />} />

                    {/* Default redirect */}
                    <Route path="/" element={<Navigate to={user ? (user.role === 'recruiter' ? '/recruiter/dashboard' : '/jobseeker/dashboard') : '/login'} />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}
