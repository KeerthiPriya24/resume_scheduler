import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
    const { API } = useAuth();
    const [profile, setProfile] = useState({
        name: '',
        bio: '',
        phone: '',
        location: '',
        company: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await API.get('/users/profile');
            setProfile(res.data);
        } catch (err) {
            console.error('Profile load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await API.put('/users/profile', profile);
            setMessage({ type: 'success', text: 'Profile updated successfully.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="page-container narrow">
            <div className="profile-card glass anim-fade-in">
                <div className="profile-header">
                    <div className="profile-avatar-large">
                        {profile.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h2>{profile.name}</h2>
                        <p className="text-muted">{profile.role?.charAt(0).toUpperCase() + profile.role?.slice(1)} • {profile.email}</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="profile-form">
                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            value={profile.name || ''}
                            onChange={e => setProfile({ ...profile, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                value={profile.phone || ''}
                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                placeholder="+1 234 567 890"
                            />
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <input
                                type="text"
                                value={profile.location || ''}
                                onChange={e => setProfile({ ...profile, location: e.target.value })}
                                placeholder="City, Country"
                            />
                        </div>
                    </div>

                    {profile.role === 'recruiter' && (
                        <div className="form-group">
                            <label>Company / Agency</label>
                            <input
                                type="text"
                                value={profile.company || ''}
                                onChange={e => setProfile({ ...profile, company: e.target.value })}
                                placeholder="Google, Meta, etc."
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Professional Bio</label>
                        <textarea
                            value={profile.bio || ''}
                            onChange={e => setProfile({ ...profile, bio: e.target.value })}
                            placeholder="Tell us about yourself..."
                            rows="4"
                        ></textarea>
                    </div>

                    {message && (
                        <div className={`alert alert-${message.type} anim-slide-up`}>
                            {message.text}
                        </div>
                    )}

                    <div className="form-footer">
                        <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                            {saving ? <span className="spinner-sm"></span> : 'Update Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
