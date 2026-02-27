import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useAuth } from '../context/AuthContext';

export default function RecruiterDashboard() {
    const { API } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, jobsRes, interviewsRes, availRes] = await Promise.all([
                API.get('/dashboard/recruiter'),
                API.get('/jobs/recruiter/mine'),
                API.get('/dashboard/recruiter/interviews'),
                API.get('/dashboard/recruiter/availability')
            ]);
            setStats(statsRes.data);
            setJobs(jobsRes.data);
            setInterviews(interviewsRes.data);
            setAvailability(availRes.data);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const interviewsOnSelectedDate = interviews.filter(i => {
        const d = new Date(i.scheduled_at);
        return d.toDateString() === selectedDate.toDateString();
    });

    const availabilityOnSelectedDate = availability.filter(a => {
        if (a.specific_date) {
            return new Date(a.specific_date).toDateString() === selectedDate.toDateString();
        }
        // Recurring days
        return a.day_of_week === selectedDate.getDay();
    });

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    // ... continued in multi-replace to avoid massive blocks

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h1>Recruiter Dashboard</h1>
                <Link to="/recruiter/post-job" className="btn btn-primary">+ Post New Job</Link>
            </div>

            {stats && (
                <div className="stats-grid">
                    <div className="stat-card stat-blue">
                        <div className="stat-icon">📋</div>
                        <div className="stat-value">{stats.total_jobs}</div>
                        <div className="stat-label">Total Jobs</div>
                    </div>
                    <div className="stat-card stat-cyan">
                        <div className="stat-icon">📅</div>
                        <div className="stat-value">{stats.interviews_scheduled}</div>
                        <div className="stat-label">Interviews</div>
                    </div>
                    <div className="stat-card stat-emerald">
                        <div className="stat-icon">🎉</div>
                        <div className="stat-value">{stats.selected}</div>
                        <div className="stat-label">Hired</div>
                    </div>
                </div>
            )}

            <div className="dashboard-main-grid mt-4">
                <div className="section">
                    <h2>Your Job Postings</h2>
                    <div className="job-cards-grid">
                        {jobs.map(job => (
                            <div key={job.id} className="job-card" onClick={() => navigate(`/recruiter/pipeline/${job.id}`)}>
                                <div className="job-card-header">
                                    <h3>{job.title}</h3>
                                    <span className={`status-badge status-${job.job_status}`}>{job.job_status}</span>
                                </div>
                                <div className="job-card-meta">
                                    <span>📄 {job.application_count} applications</span>
                                    <span>🎯 {job.positions} positions</span>
                                </div>
                                <div className="job-card-footer">
                                    <span className="job-date">{new Date(job.created_at).toLocaleDateString()}</span>
                                    <span className="job-pipeline-link">View Pipeline →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dashboard-aside">
                    <div className="card glass">
                        <div className="card-header">
                            <h3>Interview Calendar</h3>
                        </div>
                        <div className="calendar-wrap">
                            <Calendar
                                onChange={setSelectedDate}
                                value={selectedDate}
                                tileClassName={({ date }) => {
                                    const dStr = date.toDateString();
                                    const hasInterview = interviews.some(i => new Date(i.scheduled_at).toDateString() === dStr);
                                    const hasAvail = availability.some(a => {
                                        if (a.specific_date) return new Date(a.specific_date).toDateString() === dStr;
                                        return a.day_of_week === date.getDay();
                                    });
                                    let classes = [];
                                    if (hasInterview) classes.push('has-interview');
                                    if (hasAvail) classes.push('is-available');
                                    return classes.join(' ');
                                }}
                            />
                        </div>
                        <div className="selected-date-interviews mt-4">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
                                <Link to="/recruiter/availability" className="btn-icon-sm" title="Edit Availability">⚙️</Link>
                            </div>

                            {interviewsOnSelectedDate.length > 0 && (
                                <div className="interview-mini-list mt-3">
                                    <div className="section-label">INTERVIEWS</div>
                                    {interviewsOnSelectedDate.map(i => (
                                        <div key={i.id} className="interview-mini-card">
                                            <div className="i-time">{new Date(i.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            <div className="i-body">
                                                <strong>{i.candidate_name}</strong>
                                                <p>{i.job_title}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {availabilityOnSelectedDate.length > 0 && (
                                <div className="avail-mini-list mt-3">
                                    <div className="section-label">AVAILABILITY</div>
                                    {availabilityOnSelectedDate.map((a, idx) => (
                                        <div key={idx} className="avail-block-mini">
                                            🕒 {a.start_time} - {a.end_time}
                                            {a.specific_date && <span className="custom-tag">Custom</span>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {interviewsOnSelectedDate.length === 0 && availabilityOnSelectedDate.length === 0 && (
                                <p className="text-muted mt-2">No activity or availability scheduled.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
