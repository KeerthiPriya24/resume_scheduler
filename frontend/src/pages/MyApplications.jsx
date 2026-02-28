import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MyApplications() {
    const { API } = useAuth();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get('/applications/mine').then(res => setApplications(res.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const statusColors = {
        pending_ai_processing: { color: '#f59e0b', label: 'Pending Review' },
        processed: { color: '#3b82f6', label: 'Reviewed' },
        ranked: { color: '#8b5cf6', label: 'Ranked' },
        pending_confirmation: { color: '#f97316', label: 'Pending Confirmation' },
        shortlisted: { color: '#10b981', label: 'Shortlisted' },
        buffer: { color: '#6b7280', label: 'In Waitlist' },
        scheduling: { color: '#06b6d4', label: 'Scheduling' },
        confirmed: { color: '#059669', label: 'Interview Confirmed' },
        selected: { color: '#22c55e', label: 'Selected' },
        rejected: { color: '#ef4444', label: 'Not Selected' },
        escalated: { color: '#dc2626', label: 'Needs Attention' }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="page-container">
            <div className="section-header">
                <h1>My Applications</h1>
                <p>Track the status of all your job applications</p>
            </div>

            {applications.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📫</div>
                    <h3>No applications yet</h3>
                    <p>Browse jobs and start applying!</p>
                    <a href="/jobs" className="btn btn-primary">Browse Jobs</a>
                </div>
            ) : (
                <div className="applications-list">
                    {applications.map(app => {
                        const statusInfo = statusColors[app.status] || { color: '#6b7280', label: app.status };
                        return (
                            <div key={app.id} className="application-card">
                                <div className="app-card-main">
                                    <h3>{app.job_title}</h3>
                                    <p className="app-desc">{app.job_description?.substring(0, 150)}...</p>
                                    <div className="app-card-meta">
                                        <span>Applied {new Date(app.applied_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="app-card-status">
                                    <span className="status-pill" style={{ backgroundColor: statusInfo.color }}>{statusInfo.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
