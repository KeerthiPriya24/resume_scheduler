import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DAYS = [
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' },
    { id: 6, name: 'Saturday' },
    { id: 0, name: 'Sunday' }
];

export default function AvailabilitySettings() {
    const { API } = useAuth();
    const navigate = useNavigate();
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadAvailability();
    }, []);

    const loadAvailability = async () => {
        try {
            // We'll reuse the stats endpoint or a new one to get current availability if needed
            // For now, let's just start with a clean state or assume we can fetch it
            setSlots([
                { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 4, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 5, start_time: '09:00', end_time: '17:00' }
            ]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleDay = (dayId) => {
        if (slots.find(s => s.day_of_week === dayId)) {
            setSlots(slots.filter(s => s.day_of_week !== dayId));
        } else {
            setSlots([...slots, { day_of_week: dayId, start_time: '09:00', end_time: '17:00' }]);
        }
    };

    const handleChangeTime = (dayId, field, value) => {
        setSlots(slots.map(s => s.day_of_week === dayId ? { ...s, [field]: value } : s));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await API.post('/interviews/recruiter-availability', { slots });
            setMessage('✅ Availability updated successfully!');
            setTimeout(() => navigate('/recruiter/dashboard'), 1500);
        } catch (err) {
            setMessage('❌ Failed to update availability.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

    return (
        <div className="page-container narrow">
            <div className="card glass anim-fade-in">
                <div className="card-header">
                    <h2>📅 Interview Availability</h2>
                    <p className="text-muted">Set your weekly recurring working hours for interviews.</p>
                </div>

                <form onSubmit={handleSave} className="availability-form">
                    <div className="days-list">
                        {DAYS.map(day => {
                            const active = slots.find(s => s.day_of_week === day.id);
                            return (
                                <div key={day.id} className={`day-row ${active ? 'active' : ''}`}>
                                    <div className="day-info">
                                        <label className="checkbox-container">
                                            <input
                                                type="checkbox"
                                                checked={!!active}
                                                onChange={() => handleToggleDay(day.id)}
                                            />
                                            <span className="checkmark"></span>
                                            <span className="day-name">{day.name}</span>
                                        </label>
                                    </div>

                                    {active && (
                                        <div className="time-inputs anim-slide-in">
                                            <input
                                                type="time"
                                                value={active.start_time}
                                                onChange={e => handleChangeTime(day.id, 'start_time', e.target.value)}
                                            />
                                            <span>to</span>
                                            <input
                                                type="time"
                                                value={active.end_time}
                                                onChange={e => handleChangeTime(day.id, 'end_time', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {!active && <span className="closed-label">Unavailable</span>}
                                </div>
                            );
                        })}
                    </div>

                    {message && <div className={`alert ${message.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{message}</div>}

                    <div className="form-footer">
                        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Availability'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
