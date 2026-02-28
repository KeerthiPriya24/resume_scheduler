import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <span className="brand-icon">●</span>
                    <span className="brand-text">Recruit<span className="brand-highlight">AI</span></span>
                </Link>

                <div className="navbar-links">
                    {!user ? (
                        <>
                            <Link to="/login" className="nav-link">Login</Link>
                            <Link to="/register" className="nav-link nav-link-primary">Get Started</Link>
                        </>
                    ) : user.role === 'recruiter' ? (
                        <>
                            <Link to="/recruiter/dashboard" className="nav-link">Dashboard</Link>
                            <Link to="/recruiter/availability" className="nav-link">Availability</Link>
                            <Link to="/profile" className="nav-link">Profile</Link>
                            <div className="nav-user">
                                <span className="nav-user-badge recruiter-badge">{user.name}</span>
                                <button onClick={handleLogout} className="nav-link nav-logout">Logout</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/jobseeker/dashboard" className="nav-link">Dashboard</Link>
                            <Link to="/jobs" className="nav-link">Browse Jobs</Link>
                            <Link to="/my-applications" className="nav-link">My Applications</Link>
                            <Link to="/profile" className="nav-link">Profile</Link>
                            <div className="nav-user">
                                <span className="nav-user-badge seeker-badge">{user.name}</span>
                                <button onClick={handleLogout} className="nav-link nav-logout">Logout</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
