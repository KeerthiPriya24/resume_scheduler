import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.role) { setError('Please select a role'); return; }
        setError('');
        setLoading(true);
        try {
            const data = await register(form.name, form.email, form.password, form.role);
            navigate(data.user.role === 'recruiter' ? '/recruiter/dashboard' : '/jobs');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Join RecruitAI</h1>
                        <p>Create your account to get started</p>
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label>I am a</label>
                            <div className="role-selector">
                                <button type="button" className={`role-btn ${form.role === 'recruiter' ? 'active' : ''}`}
                                    onClick={() => setForm({ ...form, role: 'recruiter' })}>
                                    <span className="role-icon">R</span>
                                    <span className="role-label">Recruiter</span>
                                    <span className="role-desc">Post jobs & hire talent</span>
                                </button>
                                <button type="button" className={`role-btn ${form.role === 'jobseeker' ? 'active' : ''}`}
                                    onClick={() => setForm({ ...form, role: 'jobseeker' })}>
                                    <span className="role-icon">JS</span>
                                    <span className="role-label">Job Seeker</span>
                                    <span className="role-desc">Find your dream job</span>
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input id="name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-email">Email Address</label>
                            <input id="reg-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reg-password">Password</label>
                            <input id="reg-password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={6} />
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            {loading ? <span className="spinner-sm"></span> : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
