const db = require('../database/init');

const getProfile = (req, res) => {
    try {
        const user = db.prepare('SELECT id, name, email, role, bio, phone, location, company, avatar_path, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Server error fetching profile.' });
    }
};

const updateProfile = (req, res) => {
    try {
        const { name, bio, phone, location, company } = req.body;

        db.prepare(`
            UPDATE users 
            SET name = ?, bio = ?, phone = ?, location = ?, company = ?, created_at = created_at
            WHERE id = ?
        `).run(name, bio, phone, location, company, req.user.id);

        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error updating profile.' });
    }
};

module.exports = { getProfile, updateProfile };
