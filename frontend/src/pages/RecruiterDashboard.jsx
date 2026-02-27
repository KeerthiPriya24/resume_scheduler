import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RecruiterDashboard() {
    const { API } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, jobsRes] = await Promise.all([
                API.get('/dashboard/recruiter'),
                API.get('/jobs/recruiter/mine')
            ]);
            setStats(statsRes.data);
            setJobs(jobsRes.data);
        } catch (err) {
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

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
                    <div className="stat-card stat-green">
                        <div className="stat-icon">✅</div>
                        <div className="stat-value">{stats.open_jobs}</div>
                        <div className="stat-label">Open Jobs</div>
                    </div>
                    <div className="stat-card stat-purple">
                        <div className="stat-icon">📄</div>
                        <div className="stat-value">{stats.total_applications}</div>
                        <div className="stat-label">Applications</div>
                    </div>
                    <div className="stat-card stat-orange">
                        <div className="stat-icon">⭐</div>
                        <div className="stat-value">{stats.shortlisted}</div>
                        <div className="stat-label">Shortlisted</div>
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

            <div className="section">
                <h2>Your Job Postings</h2>
                {jobs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📝</div>
                        <h3>No jobs posted yet</h3>
                        <p>Start by posting your first job opening</p>
                        <Link to="/recruiter/post-job" className="btn btn-primary">Post a Job</Link>
                    </div>
                ) : (
                    <div className="job-cards-grid">
                        {jobs.map(job => (
                            <div key={job.id} className="job-card" onClick={() => navigate(`/recruiter/pipeline/${job.id}`)}>
                                <div className="job-card-header">
                                    <h3>{job.title}</h3>
                                    <span className={`status-badge status-${job.job_status}`}>{job.job_status}</span>
                                </div>
                                <p className="job-card-desc">{job.description?.substring(0, 120)}...</p>
                                <div className="job-card-meta">
                                    <span>📄 {job.application_count} applications</span>
                                    <span>🎯 {job.positions} positions</span>
                                    <span>⭐ {job.shortlisted_count || 0} shortlisted</span>
                                </div>
                                <div className="job-card-skills">
                                    {job.required_skills?.slice(0, 4).map((s, i) => (
                                        <span key={i} className="skill-tag">{s}</span>
                                    ))}
                                    {job.required_skills?.length > 4 && <span className="skill-tag-more">+{job.required_skills.length - 4}</span>}
                                </div>
                                <div className="job-card-footer">
                                    <span className="job-date">{new Date(job.created_at).toLocaleDateString()}</span>
                                    <span className="job-pipeline-link">View Pipeline →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
