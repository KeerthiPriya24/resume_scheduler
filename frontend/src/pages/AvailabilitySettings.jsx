import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
    const [specificSlots, setSpecificSlots] = useState([]); // { specific_date, start_time, end_time }
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadAvailability();
    }, []);

    const loadAvailability = async () => {
        try {
            const res = await API.get('/dashboard/recruiter/availability');
            const data = res.data;

            // Recurring slots (those with day_of_week)
            const recurring = data.filter(s => s.day_of_week !== null && !s.specific_date);
            setSlots(recurring.length > 0 ? recurring : [
                { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 4, start_time: '09:00', end_time: '17:00' },
                { day_of_week: 5, start_time: '09:00', end_time: '17:00' }
            ]);

            // Specific slots
            const specific = data.filter(s => s.specific_date);
            setSpecificSlots(specific);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    // ... rest of the code updated in a later multi_replace or similar ...
    // Actually let's just do a multi_replace for the whole file logic to be safe

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

    const handleDateChange = (date) => {
        setSelectedDate(date);
    };

    const dateStr = selectedDate.toISOString().split('T')[0];
    const existingSpecific = specificSlots.find(s => s.specific_date === dateStr);

    const handleToggleSpecificDate = () => {
        if (existingSpecific) {
            setSpecificSlots(specificSlots.filter(s => s.specific_date !== dateStr));
        } else {
            setSpecificSlots([...specificSlots, { specific_date: dateStr, start_time: '09:00', end_time: '17:00' }]);
        }
    };

    const handleChangeSpecificTime = (field, value) => {
        setSpecificSlots(specificSlots.map(s => s.specific_date === dateStr ? { ...s, [field]: value } : s));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            // Merge recurring and specific slots for the backend
            const payload = [
                ...slots.map(s => ({ ...s, specific_date: null })),
                ...specificSlots
            ];
            await API.post('/interviews/recruiter-availability', { slots: payload });
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
        <div className="page-container">
            <div className="availability-layout">
                <div className="availability-main">
                    <div className="card glass anim-fade-in">
                        <div className="card-header">
                            <h2>📅 Weekly Recurring</h2>
                            <p className="text-muted">Set your regular working hours.</p>
                        </div>
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
                                                <span>-</span>
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
                    </div>
                </div>

                <div className="availability-side">
                    <div className="card glass anim-fade-in">
                        <div className="card-header">
                            <h2>🗓️ Specific Dates</h2>
                            <p className="text-muted">Override or add slots for specific days.</p>
                        </div>
                        <div className="calendar-wrap">
                            <Calendar
                                onChange={handleDateChange}
                                value={selectedDate}
                                tileClassName={({ date }) => {
                                    const dStr = date.toISOString().split('T')[0];
                                    return specificSlots.find(s => s.specific_date === dStr) ? 'has-specific' : null;
                                }}
                            />
                        </div>
                        <div className="specific-editor mt-4">
                            <h4>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
                            <div className="specific-controls mt-2">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        checked={!!existingSpecific}
                                        onChange={handleToggleSpecificDate}
                                    />
                                    <span className="checkmark"></span>
                                    <span>Set custom hours for this date</span>
                                </label>

                                {existingSpecific && (
                                    <div className="time-inputs mt-3 anim-slide-in">
                                        <div className="time-field">
                                            <label>Start</label>
                                            <input
                                                type="time"
                                                value={existingSpecific.start_time}
                                                onChange={e => handleChangeSpecificTime('start_time', e.target.value)}
                                            />
                                        </div>
                                        <div className="time-field">
                                            <label>End</label>
                                            <input
                                                type="time"
                                                value={existingSpecific.end_time}
                                                onChange={e => handleChangeSpecificTime('end_time', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {specificSlots.length > 0 && (
                            <div className="overrides-list mt-5">
                                <h3>Defined Overrides</h3>
                                <div className="mini-card-stack mt-2">
                                    {specificSlots.map(s => (
                                        <div key={s.specific_date} className="mini-override-card">
                                            <div className="override-info">
                                                <strong>{new Date(s.specific_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
                                                <span>{s.start_time} - {s.end_time}</span>
                                            </div>
                                            <button className="btn-icon-sm" onClick={() => setSpecificSlots(specificSlots.filter(x => x.specific_date !== s.specific_date))}>
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {message && <div className={`alert mt-4 ${message.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{message}</div>}

                    <div className="form-footer mt-4">
                        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save All Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
