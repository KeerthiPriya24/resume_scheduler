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
`);

db.pragma('foreign_keys = ON');

const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
const jobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
const apps = db.prepare('SELECT COUNT(*) as count FROM applications').get();

console.log('✅ Applications reset complete!');
console.log(`   Users kept: ${users.count}`);
console.log(`   Jobs kept:  ${jobs.count}`);
console.log(`   Applications: ${apps.count} (cleared)`);
db.close();
