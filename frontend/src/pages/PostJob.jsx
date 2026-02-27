import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PostJob() {
    const { API } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '', description: '', experience_required: 0, positions: 1, confirmation_deadline_hours: 1
    });
    const [skillInput, setSkillInput] = useState('');
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const addSkill = () => {
        const s = skillInput.trim();
        if (s && !skills.includes(s)) {
            setSkills([...skills, s]);
            setSkillInput('');
        }
    };

    const removeSkill = (idx) => setSkills(skills.filter((_, i) => i !== idx));

    const getShortlistTarget = (H) => {
        if (H === 1) return 4;
        if (H >= 2 && H <= 5) return H * 3;
        return H * 2;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await API.post('/jobs', { ...form, required_skills: skills });
            navigate('/recruiter/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to post job');
        } finally {
            setLoading(false);
        }
    };

    const S = getShortlistTarget(parseInt(form.positions) || 1);

    return (
        <div className="page-container">
            <div className="form-page">
                <div className="form-header">
                    <h1>Post a New Job</h1>
                    <p>Fill in the details to create a job posting</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="post-job-form">
                    <div className="form-group">
                        <label htmlFor="job-title">Job Title *</label>
                        <input id="job-title" type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Frontend Developer" required />
                    </div>

                    <div className="form-group">
                        <label htmlFor="job-desc">Job Description *</label>
                        <textarea id="job-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the role, responsibilities, and requirements..." rows={6} required />
                    </div>

                    <div className="form-group">
                        <label>Required Skills</label>
                        <div className="skill-input-row">
                            <input type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                                placeholder="Add a skill..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                            <button type="button" className="btn btn-secondary" onClick={addSkill}>Add</button>
                        </div>
                        <div className="skills-list">
                            {skills.map((s, i) => (
                                <span key={i} className="skill-tag removable" onClick={() => removeSkill(i)}>{s} ×</span>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="experience">Experience Required (years)</label>
                            <input id="experience" type="number" min="0" value={form.experience_required}
                                onChange={e => setForm({ ...form, experience_required: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="positions">Number of Positions (H)</label>
                            <input id="positions" type="number" min="1" value={form.positions}
                                onChange={e => setForm({ ...form, positions: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="deadline">Confirmation Deadline (minutes)</label>
                            <input id="deadline" type="number" min="1" value={form.confirmation_deadline_hours}
                                onChange={e => setForm({ ...form, confirmation_deadline_hours: parseInt(e.target.value) || 1 })} />
                        </div>
                    </div>

                    <div className="shortlist-preview">
                        <div className="shortlist-formula">
                            <span className="formula-label">📊 Shortlist Formula</span>
                            <span className="formula-values">
                                H = {form.positions} positions → S = <strong>{S}</strong> candidates to shortlist
                            </span>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? <span className="spinner-sm"></span> : 'Post Job'}
                    </button>
                </form>
            </div>
        </div>
    );
}
