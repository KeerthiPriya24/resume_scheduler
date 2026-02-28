import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function JobDetails() {
    const { id } = useParams();
    const { API, user } = useAuth();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resume, setResume] = useState(null);

    useEffect(() => {
        API.get(`/jobs/${id}`).then(res => setJob(res.data)).catch(() => navigate('/jobs'));
    }, [id]);

    const handleApply = async (e) => {
        e.preventDefault();
        setError('');
        setApplying(true);
        try {
            const formData = new FormData();
            if (resume) formData.append('resume', resume);
            await API.post(`/applications/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setApplied(true);
            setSuccess('Application submitted successfully! Your resume will be analyzed by AI.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to apply');
        } finally {
            setApplying(false);
        }
    };

    if (!job) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="page-container">
            <div className="job-detail">
                <div className="job-detail-header">
                    <div>
                        <h1>{job.title}</h1>
                        <p className="job-recruiter">Posted by <strong>{job.recruiter_name}</strong> • {new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`status-badge status-${job.job_status}`}>{job.job_status}</span>
                </div>

                <div className="job-detail-grid">
                    <div className="job-detail-main">
                        <section>
                            <h2>Job Description</h2>
                            <p className="job-full-desc">{job.description}</p>
                        </section>

                        <section>
                            <h2>Required Skills</h2>
                            <div className="job-card-skills">
                                {job.required_skills?.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
                                {(!job.required_skills || job.required_skills.length === 0) && <span className="text-muted">Not specified</span>}
                            </div>
                        </section>

                        <section className="job-info-grid">
                            <div className="info-card"><span className="info-label">Experience Required</span><span className="info-value">{job.experience_required}+ years</span></div>
                            <div className="info-card"><span className="info-label">Open Positions</span><span className="info-value">{job.positions}</span></div>
                            <div className="info-card"><span className="info-label">Applications</span><span className="info-value">{job.application_count}</span></div>
                        </section>
                    </div>

                    <div className="job-detail-sidebar">
                        {user?.role === 'jobseeker' && job.job_status === 'open' && !applied && (
                            <div className="apply-card">
                                <h3>Apply for this Position</h3>
                                {error && <div className="alert alert-error">{error}</div>}
                                <form onSubmit={handleApply}>
                                    <div className="form-group">
                                        <label htmlFor="resume-upload">Upload Resume (PDF) *</label>
                                        <div className="file-upload">
                                            <input id="resume-upload" type="file" accept=".pdf" onChange={e => setResume(e.target.files[0])} required />
                                            {resume && <span className="file-name">{resume.name}</span>}
                                        </div>
                                        {!resume && <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '5px' }}>Please select your resume to enable submission.</p>}
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-full" disabled={applying || !resume}>
                                        {applying ? <span className="spinner-sm"></span> : 'Submit Application'}
                                    </button>
                                </form>
                            </div>
                        )}
                        {applied && <div className="apply-card success-card"><h3>Applied!</h3><p>{success}</p></div>}
                        {!user && <div className="apply-card"><p>Please <a href="/login">sign in</a> as a job seeker to apply</p></div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
