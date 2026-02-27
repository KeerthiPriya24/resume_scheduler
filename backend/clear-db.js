const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database', 'recruitment.db'));
db.pragma('foreign_keys = OFF');

db.exec(`
  DELETE FROM notifications;
  DELETE FROM interviews;
  DELETE FROM shortlists;
  DELETE FROM ai_scores;
  DELETE FROM applications;
  DELETE FROM recruiter_availability;
  DELETE FROM jobs;
  DELETE FROM users;
`);

db.pragma('foreign_keys = ON');

console.log('Users:', db.prepare('SELECT COUNT(*) as count FROM users').get());
console.log('Jobs:', db.prepare('SELECT COUNT(*) as count FROM jobs').get());
console.log('✅ All data cleared!');
db.close();
