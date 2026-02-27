import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function SchedulingChatbot() {
    const { token } = useParams();
    const [interview, setInterview] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [slots, setSlots] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [step, setStep] = useState('greet'); // greet, availability, booking, confirmed
    const [bookedSlot, setBookedSlot] = useState(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        loadInterview();
    }, [token]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const loadInterview = async () => {
        try {
            const res = await axios.get(`/api/interviews/schedule/${token}`);
            setInterview(res.data);

            if (res.data.interview_status === 'confirmed') {
                try {
                    setBookedSlot(JSON.parse(res.data.selected_slot));
                } catch (e) {
                    setBookedSlot({ datetime: res.data.scheduled_at });
                }
                setStep('confirmed');
                addMessage('bot', 'INTERVIEW_CONFIRMED_CARD');
                setLoading(false);
                return;
            }

            setLoading(false);
            await botResponse(`Hi ${res.data.candidate_name}! 👋`);
            await botResponse(`Congratulations on being shortlisted for the **${res.data.job_title}** position.`);
            await botResponse(`I'm RecruitAI, your scheduling assistant. To get started, when are you generally free next week?`, true);
            setStep('availability');
        } catch (err) {
            setError('Invalid or expired scheduling link.');
            setLoading(false);
        }
    };

    const formatDate = (dateStr, options) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "TBD";
        return d.toLocaleDateString([], options);
    };

    const formatTime = (dateStr, options) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "TBD";
        return d.toLocaleTimeString([], options);
    };

    const addMessage = (role, text) => {
        setMessages(prev => [...prev, { role, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    };

    const botResponse = async (text, showOptions = false) => {
        setIsTyping(true);
        await new Promise(r => setTimeout(r, 1000));
        setIsTyping(false);
        addMessage('bot', text);
    };

    const handleSend = async (e, directText = null) => {
        if (e) e.preventDefault();
        const userText = directText || input.trim();
        if (!userText) return;

        setInput('');
        addMessage('user', userText);

        if (step === 'availability') {
            await botResponse('Processing your availability... 🕒');
            try {
                const res = await axios.post(`/api/interviews/availability/${interview.id}`, {
                    availability: userText
                });

                // Fetch matching slots
                const slotsRes = await axios.get(`/api/interviews/slots/${interview.id}`);
                setSlots(slotsRes.data);

                if (slotsRes.data.length > 0) {
                    await botResponse('I found some matching slots! Please select one that works best for you:');
                    setStep('booking');
                } else {
                    await botResponse("I couldn't find a direct match with our recruiter's calendar. Let me check with them and get back to you, or feel free to provide other options!");
                }
            } catch (err) {
                await botResponse('Sorry, I had trouble processing that. Could you try again or be more specific?');
            }
        }
    };

    const handleBookSlot = async (slot) => {
        try {
            await axios.post(`/api/interviews/book/${interview.id}`, { slot });
            setBookedSlot(slot);
            await botResponse(`Excellent choice! 🗓️`);
            addMessage('bot', 'INTERVIEW_CONFIRMED_CARD'); // Special marker for UI
            setStep('confirmed');
        } catch (err) {
            await botResponse('Sorry, that slot is no longer available. Please try another one.');
        }
    };

    const handleAlternative = async () => {
        setSlots([]);
        setStep('availability');
        await botResponse("No problem! Let's try again. When else are you free? Or feel free to be more specific.");
    };

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
    if (error) return <div className="page-container"><div className="alert alert-error">{error}</div></div>;

    const guidedOptions = [
        "Monday Morning", "Tuesday Afternoon", "Anytime Wednesday", "Thursday @ 10am", "I'm free all week"
    ];

    return (
        <div className="chatbot-page">
            <div className="chatbot-container glass">
                <div className="chatbot-header">
                    <div className="bot-avatar-container">
                        <div className="bot-avatar">🤖</div>
                        <div className="online-indicator"></div>
                    </div>
                    <div>
                        <h3>RecruitAI Scheduler</h3>
                        <p>{interview.job_title} Candidate Experience</p>
                    </div>
                </div>

                <div className="chat-window">
                    <div className="chat-date-separator"><span>Today</span></div>

                    {messages.map((m, i) => (
                        <div key={i} className={`message-group ${m.role}-group`}>
                            {m.role === 'bot' && <div className="chat-mini-avatar">🤖</div>}
                            <div className={`message-bubble ${m.role}-bubble`}>
                                {m.text === 'INTERVIEW_CONFIRMED_CARD' ? (
                                    <div className="booking-summary-card anim-slide-up">
                                        <h4>✅ Interview Booked</h4>
                                        <div className="summary-item"><strong>Job:</strong> {interview.job_title}</div>
                                        <div className="summary-item"><strong>Date:</strong> {formatDate(bookedSlot?.datetime || '', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                        <div className="summary-item"><strong>Time:</strong> {formatTime(bookedSlot?.datetime || '', { hour: '2-digit', minute: '2-digit' })}</div>
                                        <p className="summary-note">A confirmation email has been sent. Check your inbox for the meeting link.</p>
                                    </div>
                                ) : (
                                    <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                )}
                                <span className="message-time">{m.time}</span>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="message-group bot-group">
                            <div className="chat-mini-avatar">🤖</div>
                            <div className="message-bubble bot-bubble typing-bubble">
                                <div className="typing-indicator"><span></span><span></span><span></span></div>
                            </div>
                        </div>
                    )}

                    {step === 'availability' && messages.length > 2 && !isTyping && (
                        <div className="guided-flow">
                            <p className="guided-label">Quick select availability:</p>
                            <div className="option-chips">
                                {guidedOptions.map(opt => (
                                    <button key={opt} className="option-chip" onClick={() => handleSend(null, opt)}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'booking' && slots.length > 0 && !isTyping && (
                        <div className="slot-suggestions anim-fade-in">
                            <p className="guided-label">Pick a matching slot:</p>
                            <div className="slot-grid">
                                {slots.map((s, i) => (
                                    <button key={i} className="slot-btn-large" onClick={() => handleBookSlot(s)}>
                                        <span className="slot-date">{formatDate(s.datetime, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                        <span className="slot-time">{formatTime(s.datetime, { hour: '2-digit', minute: '2-digit' })}</span>
                                    </button>
                                ))}
                            </div>
                            <button className="btn btn-ghost btn-sm btn-block mt-3" onClick={handleAlternative}>
                                ❌ None of these work / Change my availability
                            </button>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {step !== 'confirmed' && (
                    <form onSubmit={handleSend} className="chat-input-area">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type a message or select an option..."
                            autoComplete="off"
                        />
                        <button type="submit" className="btn btn-primary btn-round" disabled={!input.trim()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
