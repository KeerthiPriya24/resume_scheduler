import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PipelineView() {
    const { jobId } = useParams();
    const { API } = useAuth();
    const navigate = useNavigate();
    const [pipeline, setPipeline] = useState(null);
    const [applications, setApplications] = useState([]);
    const [shortlist, setShortlist] = useState(null);
    const [interviews, setInterviews] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadAll(); }, [jobId]);

    const loadAll = async () => {
        try {
            const [pRes, aRes] = await Promise.all([
                API.get(`/dashboard/pipeline/${jobId}`),
                API.get(`/applications/job/${jobId}`)
            ]);
            setPipeline(pRes.data);
            setApplications(aRes.data);
            try { const sRes = await API.get(`/shortlist/${jobId}`); setShortlist(sRes.data); } catch { }
            try { const iRes = await API.get(`/interviews/job/${jobId}`); setInterviews(iRes.data); } catch { }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const processAll = async () => {
        setProcessing(true);
        setMessage('');
        try {
            const res = await API.post(`/ai/process-all/${jobId}`);
            setMessage(`${res.data.results?.length || 0} applications processed by AI`);
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Processing failed'));
        } finally {
            setProcessing(false);
        }
    };

    const proposeShortlist = async () => {
        try {
            const res = await API.post(`/shortlist/propose/${jobId}`);
            setMessage(`${res.data.message}`);
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Failed'));
        }
    };

    const confirmShortlist = async () => {
        try {
            const res = await API.post(`/shortlist/confirm/${jobId}`);
            setMessage(`Shortlist confirmed. ${res.data.emails_sent || 0} scheduling emails sent.`);
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Failed'));
        }
    };

    const closeJob = async () => {
        if (!window.confirm("Are you sure you want to close this job? It will no longer be visible to job seekers.")) return;
        try {
            await API.put(`/jobs/${jobId}/status`, { status: 'closed' });
            setMessage('Job closed successfully.');
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Failed to close job'));
        }
    };

    const removeCandidate = async (appId) => {
        try {
            await API.delete(`/shortlist/remove/${jobId}/${appId}`);
            setMessage('Candidate removed, buffer promoted');
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Failed'));
        }
    };

    const makeDecision = async (interviewId, decision) => {
        try {
            const res = await API.put(`/interviews/decision/${interviewId}`, { decision });
            setMessage(`${res.data.message}`);
            loadAll();
        } catch (err) {
            setMessage('Error: ' + (err.response?.data?.error || 'Failed'));
        }
    };

    const shortlistIndividual = async (appId) => {
        try {
            const res = await API.post(`/shortlist/individual/${appId}`);
            setMessage(`${res.data.message}`);
            loadAll();
        } catch (err) {
            setMessage((err.response?.data?.error || 'Failed to shortlist'));
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
    if (!pipeline) return <div className="page-container"><h2>Job not found</h2></div>;

    const { job, counts } = pipeline;

    return (
        <div className="pipeline-page">
            <div className="pipeline-header">
                <button className="btn btn-ghost" onClick={() => navigate('/recruiter/dashboard')}>← Back</button>
                <div>
                    <h1>{job.title}</h1>
                    <p>Pipeline Manager • {job.positions} positions • Deadline: {job.confirmation_deadline_hours}m</p>
                </div>
                <span className={`status-badge status-${job.job_status}`}>{job.job_status}</span>
            </div>

            {message && <div className="alert alert-info">{message}</div>}

            {/* Pipeline Progress */}
            <div className="pipeline-progress">
                <div className="pipeline-step"><div className="step-count">{counts.total_applications}</div><div className="step-label">Applied</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="step-count">{counts.pending_ai}</div><div className="step-label">Pending AI</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="step-count">{counts.processed}</div><div className="step-label">Scored</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="step-count">{counts.shortlisted + counts.pending_confirmation}</div><div className="step-label">Shortlisted</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="step-count">{counts.interviews}</div><div className="step-label">Interviews</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="step-count">{counts.selected}</div><div className="step-label">Hired</div></div>
            </div>

            {/* Tabs */}
            <div className="pipeline-tabs">
                {['overview', 'candidates', 'shortlist', 'interviews', 'decisions'].map(tab => (
                    <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="pipeline-content">
                {activeTab === 'overview' && (
                    <div className="overview-grid">
                        <div className="overview-card">
                            <h3>Quick Actions</h3>
                            <div className="action-stack">
                                {counts.pending_ai > 0 && (
                                    <button className="btn btn-primary btn-full" onClick={processAll} disabled={processing}>
                                        {processing ? <span className="spinner-sm"></span> : `🤖 Process ${counts.pending_ai} Applications with AI`}
                                    </button>
                                )}
                                {counts.processed > 0 && counts.selected < job.positions && (!pipeline.shortlist || pipeline.shortlist.status !== 'proposed') && (
                                    <button className="btn btn-secondary btn-full" onClick={proposeShortlist}>Propose Shortlist</button>
                                )}
                                {pipeline.shortlist?.status === 'proposed' && (
                                    <button className="btn btn-success btn-full" onClick={confirmShortlist}>Confirm Shortlist</button>
                                )}
                                {job.job_status === 'open' && (
                                    <button className="btn btn-danger btn-full" onClick={closeJob}>Close Job Opening</button>
                                )}
                                {job.job_status === 'closed' && (
                                    <div className="alert alert-info" style={{ margin: 0 }}>This job is closed and hidden from public.</div>
                                )}
                            </div>
                        </div>
                        <div className="overview-card">
                            <h3>📈 Pipeline Stats</h3>
                            <div className="mini-stats">
                                <div><span>{counts.total_applications}</span>Total Applications</div>
                                <div><span>{counts.processed + counts.pending_confirmation + counts.shortlisted + counts.buffer}</span>AI Processed</div>
                                <div><span>{counts.buffer}</span>In Buffer</div>
                                <div><span>{counts.rejected}</span>Rejected</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'candidates' && (
                    <div className="candidates-table-wrap">
                        <div className="table-header-actions">
                            <h3>AI-Scored Candidates</h3>
                            {counts.pending_ai > 0 && (
                                <button className="btn btn-primary btn-sm" onClick={processAll} disabled={processing}>
                                    {processing ? 'Processing...' : `Process ${counts.pending_ai} Pending`}
                                </button>
                            )}
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Rank</th><th>Candidate</th><th>Score</th><th>Matched Skills</th><th>Missing</th><th>Experience</th><th>Status</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((app, idx) => (
                                    <tr key={app.id} className={`status-row-${app.status}`}>
                                        <td><span className="rank-badge">#{idx + 1}</span></td>
                                        <td><strong>{app.candidate_name}</strong><br /><small>{app.candidate_email}</small></td>
                                        <td>
                                            {app.overall_fit_score != null ? (
                                                <div className="score-bar">
                                                    <div className="score-fill" style={{ width: `${app.overall_fit_score * 100}%`, backgroundColor: app.overall_fit_score > 0.7 ? '#10b981' : app.overall_fit_score > 0.4 ? '#f59e0b' : '#ef4444' }}></div>
                                                    <span>{(app.overall_fit_score * 100).toFixed(0)}%</span>
                                                </div>
                                            ) : <span className="text-muted">Pending</span>}
                                        </td>
                                        <td><div className="mini-skills">{app.matched_skills?.map((s, i) => <span key={i} className="skill-tag-sm">{s}</span>)}</div></td>
                                        <td><div className="mini-skills">{app.missing_skills?.map((s, i) => <span key={i} className="skill-tag-sm missing">{s}</span>)}</div></td>
                                        <td>{app.experience_score != null ? (app.experience_score * 100).toFixed(0) + '%' : '-'}</td>
                                        <td><span className={`status-pill-sm status-${app.status}`}>{app.status?.replace(/_/g, ' ')}</span></td>
                                        <td>
                                            <div className="table-actions-mini">
                                                {app.resume_path && (
                                                    <a href={`http://localhost:4000/uploads/${app.resume_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                                                        Resume
                                                    </a>
                                                )}
                                                {['processed', 'ranked', 'buffer'].includes(app.status) && (
                                                    <button className="btn btn-primary btn-xs" onClick={() => shortlistIndividual(app.id)}>
                                                        ✨ Shortlist
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'shortlist' && (
                    <div className="shortlist-section">
                        {shortlist?.shortlist?.status === 'proposed' && (
                            <div className="shortlist-banner">
                                <p>Shortlist proposed — awaiting your confirmation</p>
                                <button className="btn btn-success" onClick={confirmShortlist}>Confirm Shortlist</button>
                            </div>
                        )}
                        {shortlist?.shortlist?.status === 'confirmed' && (
                            <div className="shortlist-banner confirmed">
                                <p>Shortlist confirmed at {new Date(shortlist.shortlist.confirmed_at).toLocaleString()}</p>
                            </div>
                        )}

                        <h3>⭐ Shortlisted ({shortlist?.shortlisted?.length || 0})</h3>
                        <div className="shortlist-cards">
                            {shortlist?.shortlisted?.map(c => (
                                <div key={c.id} className="shortlist-card">
                                    <div className="sc-header">
                                        <strong>{c.candidate_name}</strong>
                                        <span className="score-badge">{c.overall_fit_score ? (c.overall_fit_score * 100).toFixed(0) + '%' : 'N/A'}</span>
                                    </div>
                                    <p className="sc-email">{c.candidate_email}</p>
                                    <span className={`status-pill-sm status-${c.status}`}>{c.status?.replace(/_/g, ' ')}</span>
                                    {c.status !== 'rejected' && c.status !== 'selected' && (
                                        <button className="btn btn-danger btn-sm" onClick={() => removeCandidate(c.id)}>Remove</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <h3 style={{ marginTop: '2rem' }}>⏳ Buffer ({shortlist?.buffer?.length || 0})</h3>
                        <div className="shortlist-cards buffer">
                            {shortlist?.buffer?.map(c => (
                                <div key={c.id} className="shortlist-card buffer-card">
                                    <strong>{c.candidate_name}</strong>
                                    <span className="score-badge">{c.overall_fit_score ? (c.overall_fit_score * 100).toFixed(0) + '%' : 'N/A'}</span>
                                </div>
                            ))}
                            {(!shortlist?.buffer || shortlist.buffer.length === 0) && <p className="text-muted">No buffer candidates</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'interviews' && (
                    <div className="interviews-section">
                        <h3>Interview Schedule</h3>
                        {interviews.length === 0 ? (
                            <div className="empty-state-sm"><p>No interviews scheduled yet. Confirm the shortlist to begin scheduling.</p></div>
                        ) : (
                            <div className="interview-cards">
                                {interviews.map(i => (
                                    <div key={i.id} className="interview-card">
                                        <div className="ic-header">
                                            <strong>{i.candidate_name}</strong>
                                            <span className={`status-pill-sm status-${i.interview_status}`}>{i.interview_status?.replace(/_/g, ' ')}</span>
                                        </div>
                                        <p>{i.candidate_email}</p>
                                        {i.selected_slot && <p className="slot-info">{JSON.stringify(i.selected_slot)}</p>}
                                        {i.candidate_availability?.length > 0 && (
                                            <div className="avail-info"><strong>Availability:</strong> {i.candidate_availability.map((s, idx) => <span key={idx}>{s.datetime || JSON.stringify(s)}</span>)}</div>
                                        )}
                                        <p className="neg-rounds">Negotiation rounds: {i.negotiation_rounds}/{i.max_negotiation_rounds}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'decisions' && (
                    <div className="decisions-section">
                        <h3>🏆 Hiring Decisions</h3>
                        <p className="text-muted">Positions: {counts.selected} / {job.positions} filled</p>
                        {interviews.length === 0 ? (
                            <div className="empty-state-sm"><p>Complete interviews before making hiring decisions.</p></div>
                        ) : (
                            <div className="decision-cards">
                                {interviews.map(i => (
                                    <div key={i.id} className="decision-card">
                                        <div className="dc-info">
                                            <strong>{i.candidate_name}</strong>
                                            <span className={`status-pill-sm status-${i.application_status}`}>{i.application_status?.replace(/_/g, ' ')}</span>
                                        </div>
                                        {!['selected', 'rejected'].includes(i.application_status) && (
                                            <div className="dc-actions">
                                                <button className="btn btn-success btn-sm" onClick={() => makeDecision(i.id, 'selected')}>Select</button>
                                                <button className="btn btn-warning btn-sm" onClick={() => makeDecision(i.id, 'hold')}>Hold</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => makeDecision(i.id, 'rejected')}>Reject</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
