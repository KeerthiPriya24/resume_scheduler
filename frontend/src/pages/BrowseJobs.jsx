import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BrowseJobs() {
    const { API, user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadJobs(); }, []);

    const loadJobs = async (query = '') => {
        try {
            const res = await API.get(`/jobs${query ? `?search=${query}` : ''}`);
            setJobs(res.data);
        } catch (err) {
            console.error('Load jobs error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setLoading(true);
        loadJobs(search);
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="page-container">
            <div className="browse-header">
                <h1>Browse Open Positions</h1>
                <p>Find your next opportunity with AI-powered matching</p>
                <form onSubmit={handleSearch} className="search-bar">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search jobs by title, description, or skills..." />
                    <button type="submit" className="btn btn-primary">Search</button>
                </form>
            </div>

            <div className="jobs-count">{jobs.length} job{jobs.length !== 1 ? 's' : ''} found</div>

            {jobs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">—</div>
                    <h3>No jobs found</h3>
                    <p>Try adjusting your search criteria</p>
                </div>
            ) : (
                <div className="job-list">
                    {jobs.map(job => (
                        <div key={job.id} className="job-list-card">
                            <div className="job-list-main">
                                <h3>{job.title}</h3>
                                <p className="job-recruiter">Posted by {job.recruiter_name}</p>
                                <p className="job-desc">{job.description?.substring(0, 200)}...</p>
                                <div className="job-card-skills">
                                    {job.required_skills?.slice(0, 6).map((s, i) => (
                                        <span key={i} className="skill-tag">{s}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="job-list-side">
                                <div className="job-meta-item"><span className="meta-label">Experience</span><span className="meta-value">{job.experience_required}+ years</span></div>
                                <div className="job-meta-item"><span className="meta-label">Positions</span><span className="meta-value">{job.positions}</span></div>
                                <div className="job-meta-item"><span className="meta-label">Applications</span><span className="meta-value">{job.application_count}</span></div>
                                <Link to={`/job/${job.id}`} className="btn btn-primary btn-full">View & Apply</Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
