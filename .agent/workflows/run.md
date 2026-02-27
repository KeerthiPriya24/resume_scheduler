---
description: how to run the AI Recruitment Platform
---

Follow these steps to start the platform:

### 1. Start the Backend
Open a terminal and run:
```bash
cd backend
node server.js
```
The backend will run on `http://localhost:4000`.

### 2. Start the Frontend
Open a **new** terminal and run:
```bash
cd frontend
npm run dev
```
The frontend will run on `http://localhost:5173`.

### 🌐 Accessing the Platform
- **Recruiter Dashboard**: [http://localhost:5173/recruiter/dashboard](http://localhost:5173/recruiter/dashboard)
- **Job Seeker Dashboard**: [http://localhost:5173/jobseeker/dashboard](http://localhost:5173/jobseeker/dashboard)
- **API Health**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### 🔑 Initial Test Accounts
You can register a new account or use the test account created during setup:
- **Email**: `recruiter@test.com`
- **Password**: `test123456`
