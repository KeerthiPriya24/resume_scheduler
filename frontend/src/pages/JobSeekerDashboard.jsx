import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useAuth } from '../context/AuthContext';

export default function JobSeekerDashboard() {
    const { API, user } = useAuth();
    const [stats, setStats] = useState({ applied: 0, interviewing: 0, activeJobs: 0 });
    const [recentApps, setRecentApps] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [appRes, jobsRes, interviewsRes] = await Promise.all([
                API.get('/applications/mine'),
                API.get('/jobs?limit=5'),
                API.get('/dashboard/jobseeker/interviews')
            ]);

            setRecentApps(appRes.data.slice(0, 3));
            setInterviews(interviewsRes.data);
            setStats({
                applied: appRes.data.length,
                interviewing: appRes.data.filter(a => ['scheduling', 'confirmed'].includes(a.status)).length,
                activeJobs: jobsRes.data.length
            });
        } catch (err) {
            console.error('JobSeeker dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const interviewsOnSelectedDate = interviews.filter(i => {
        const d = new Date(i.scheduled_at);
        return d.toDateString() === selectedDate.toDateString();
    });

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.name}! 👋</h1>
                    <p>Track your applications and upcoming interviews.</p>
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
            </div>

            <div className="dashboard-main-grid mt-4">
                <section className="dashboard-section">
                    <h2>Recent Applications</h2>
                    <div className="app-stack">
                        {recentApps.length === 0 ? (
                            <p className="text-muted">You haven't applied to any jobs yet.</p>
                        ) : (
                            recentApps.map(app => (
                                <div key={app.id} className="mini-app-card">
                                    <div className="app-header">
                                        <strong>{app.job_title}</strong>
                                        <span className={`status-pill-sm status-${app.status}`}>{app.status}</span>
                                    </div>
                                    <small className="text-muted">Applied on {new Date(app.applied_at).toLocaleDateString()}</small>
                                </div>
                            ))
                        )}
                        {recentApps.length > 0 && <Link to="/my-applications" className="view-all-link">View all applications →</Link>}
                    </div>
                </section>

                <aside className="dashboard-aside">
                    <div className="card glass">
                        <div className="card-header">
                            <h3>Your Interview Calendar</h3>
                        </div>
                        <div className="calendar-wrap">
                            <Calendar
                                onChange={setSelectedDate}
                                value={selectedDate}
                                tileClassName={({ date }) => {
                                    const hasInterview = interviews.some(i => new Date(i.scheduled_at).toDateString() === date.toDateString());
                                    return hasInterview ? 'has-interview' : null;
                                }}
                            />
                        </div>
                        <div className="selected-date-interviews mt-4">
                            <h4>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
                            {interviewsOnSelectedDate.length === 0 ? (
                                <p className="text-muted mt-2">No interviews scheduled.</p>
                            ) : (
                                <div className="interview-mini-list mt-2">
                                    {interviewsOnSelectedDate.map(i => (
                                        <div key={i.id} className="interview-mini-card">
                                            <div className="i-time">{new Date(i.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            <div className="i-body">
                                                <strong>{i.job_title} Interview</strong>
                                                <p>Recruiter: {i.recruiter_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
