import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function JobSeekerDashboard() {
    const { API, user } = useAuth();
    const [stats, setStats] = useState({ applied: 0, interviewing: 0, rejected: 0, activeJobs: 0 });
    const [recentApps, setRecentApps] = useState([]);
    const [recommendedJobs, setRecommendedJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [appRes, jobsRes] = await Promise.all([
                    API.get('/applications/mine'),
                    API.get('/jobs?limit=5')
                ]);

                const apps = appRes.data;
                setRecentApps(apps.slice(0, 3));
                setRecommendedJobs(jobsRes.data.slice(0, 3));

                setStats({
                    applied: apps.length,
                    interviewing: apps.filter(a => ['scheduling', 'confirmed'].includes(a.status)).length,
                    rejected: apps.filter(a => a.status === 'rejected').length,
                    activeJobs: jobsRes.data.length
                });
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.name}! 👋</h1>
                    <p>Here's what's happening with your applications today.</p>
                </div>
                <Link to="/jobs" className="btn btn-primary">Browse All Jobs</Link>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-blue">
                    <div className="stat-icon">📄</div>
                    <div className="stat-value">{stats.applied}</div>
                    <div className="stat-label">Applications</div>
                </div>
                <div className="stat-card stat-cyan">
                    <div className="stat-icon">📅</div>
                    <div className="stat-value">{stats.interviewing}</div>
                    <div className="stat-label">Interviews</div>
                </div>
                <div className="stat-card stat-emerald">
                    <div className="stat-icon">🏢</div>
                    <div className="stat-value">{stats.activeJobs}</div>
                    <div className="stat-label">Open Positions</div>
                </div>
            </div>

            <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <section className="dashboard-section">
                    <h2>Recent Applications</h2>
                    <div className="app-stack">
                        {recentApps.length === 0 ? (
                            <p className="text-muted">You haven't applied to any jobs yet.</p>
                        ) : (
                            recentApps.map(app => (
                                <div key={app.id} className="mini-app-card" style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong>{app.job_title}</strong>
                                        <span className={`status-pill-sm status-${app.status}`} style={{ fontSize: '0.7rem' }}>{app.status}</span>
                                    </div>
                                    <small style={{ color: 'var(--text-muted)' }}>Applied on {new Date(app.applied_at).toLocaleDateString()}</small>
                                </div>
                            ))
                        )}
                        {recentApps.length > 0 && <Link to="/my-applications" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>View all applications →</Link>}
                    </div>
                </section>

                <section className="dashboard-section">
                    <h2>Recommended for You</h2>
                    <div className="job-stack">
                        {recommendedJobs.map(job => (
                            <div key={job.id} className="mini-job-card" style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                                <strong>{job.title}</strong>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{job.recruiter_name} • {job.experience_required}+ yrs exp</p>
                                <Link to={`/job/${job.id}`} style={{ color: 'var(--accent)', fontSize: '0.8rem', display: 'block', marginTop: '8px' }}>View Details</Link>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
