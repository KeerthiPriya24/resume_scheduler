const { GoogleGenerativeAI } = require('@google/generative-ai');

const analyzeResume = async (jobDescription, requiredSkills, resumeText) => {
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback to mock scoring if no API key
    if (!apiKey) {
        console.log('⚠️  No GEMINI_API_KEY — using mock AI scoring');
        return generateMockScore(requiredSkills, resumeText);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are an expert recruiter AI. Analyze the following resume against the job description and required skills.

JOB DESCRIPTION:
${jobDescription}

REQUIRED SKILLS:
${Array.isArray(requiredSkills) ? requiredSkills.join(', ') : requiredSkills}

RESUME:
${resumeText}

Return ONLY a valid JSON object with no markdown formatting, no code blocks, just the raw JSON object with these exact fields:
{
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3"],
  "experience_score": 0.0 to 1.0,
  "role_score": 0.0 to 1.0,
  "overall_fit_score": 0.0 to 1.0,
  "summary": "2-3 sentence assessment of candidate fit"
}

Rules:
- matched_skills: skills from the required list found in the resume
- missing_skills: skills from the required list NOT found in the resume
- experience_score: how well the candidate's experience matches (0-1)
- role_score: how well the candidate fits the role (0-1)
- overall_fit_score: weighted average (0-1), consider skills match 40%, experience 30%, role fit 30%
- summary: brief professional assessment`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Parse JSON from response (handle possible markdown wrapping)
        let jsonStr = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);

        return {
            matched_skills: parsed.matched_skills || [],
            missing_skills: parsed.missing_skills || [],
            experience_score: Math.min(1, Math.max(0, parseFloat(parsed.experience_score) || 0)),
            role_score: Math.min(1, Math.max(0, parseFloat(parsed.role_score) || 0)),
            overall_fit_score: Math.min(1, Math.max(0, parseFloat(parsed.overall_fit_score) || 0)),
            summary: parsed.summary || 'Analysis complete.'
        };
    } catch (err) {
        console.error('Gemini AI error:', err.message);
        return generateMockScore(requiredSkills, resumeText);
    }
};

function generateMockScore(requiredSkills, resumeText) {
    // 1. More aggressive skill parsing
    let skills = [];
    if (Array.isArray(requiredSkills)) {
        // If it's a single string in an array, split it
        if (requiredSkills.length === 1 && typeof requiredSkills[0] === 'string' && requiredSkills[0].length > 50) {
            skills = requiredSkills[0].split(/[,\n•;]+/).map(s => s.trim()).filter(s => s.length > 2);
        } else {
            skills = requiredSkills;
        }
    } else if (typeof requiredSkills === 'string') {
        try {
            const parsed = JSON.parse(requiredSkills);
            skills = Array.isArray(parsed) ? parsed : [requiredSkills];
        } catch {
            skills = requiredSkills.split(/[,\n•;]+/).map(s => s.trim());
        }
    }

    skills = skills.filter(s => s.length > 0);

    const resumeLower = (resumeText || '').trim().toLowerCase();

    if (!resumeLower) {
        return {
            matched_skills: [],
            missing_skills: skills,
            experience_score: 0,
            role_score: 0,
            overall_fit_score: 0,
            summary: "⚠️ Analysis Failed: No text could be extracted from the uploaded resume."
        };
    }

    const matched = skills.filter(s => resumeLower.includes(s.toLowerCase()));
    const missing = skills.filter(s => !resumeLower.includes(s.toLowerCase()));

    const skillsRatio = skills.length > 0 ? matched.length / skills.length : 0;

    // 2. Deterministic "random" factor based on resume text hash to keep rankings stable
    const hash = resumeLower.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const stableRand = (hash % 100) / 100;

    const density = Math.min(1, resumeLower.split(' ').length / 400);
    const expScore = parseFloat((skillsRatio * 0.6 + density * 0.4).toFixed(2));
    const roleScore = parseFloat((skillsRatio * 0.7 + stableRand * 0.3).toFixed(2));
    const overall = parseFloat((skillsRatio * 0.5 + expScore * 0.25 + roleScore * 0.25).toFixed(2));

    return {
        matched_skills: matched,
        missing_skills: missing,
        experience_score: expScore,
        role_score: roleScore,
        overall_fit_score: overall,
        summary: `📊 Simulation Analysis: Identified ${matched.length}/${skills.length} matching keywords. Total resume length: ${resumeLower.split(' ').length} words.`
    };
}

const parseAvailability = async (availabilityText) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.log('⚠️ No GEMINI_API_KEY found in process.env');

        // Basic fallback parsing for demo/fallback
        const today = new Date();
        const slots = [];

        // Very basic regex-based fallback for "Monday", "Tuesday", etc.
        const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };
        const lower = availabilityText.toLowerCase();

        let foundDay = false;
        for (const [day, val] of Object.entries(dayMap)) {
            if (lower.includes(day)) {
                const d = new Date(today);
                let diff = val - today.getDay();
                if (diff <= 0) diff += 7; // Next week
                d.setDate(today.getDate() + diff);
                d.setHours(10, 0, 0, 0); // 10 AM
                slots.push({ datetime: d.toISOString(), duration: 60 });

                const d2 = new Date(d);
                d2.setHours(14, 0, 0, 0); // 2 PM
                slots.push({ datetime: d2.toISOString(), duration: 60 });
                foundDay = true;
                break;
            }
        }

        if (!foundDay) {
            // Default to tomorrow 10am
            const d = new Date(today);
            d.setDate(today.getDate() + 1);
            d.setHours(10, 0, 0, 0);
            slots.push({ datetime: d.toISOString(), duration: 60 });
        }

        return slots;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Convert the following natural language availability into a JSON array of ISO date-time slots. 
Current time is ${new Date().toISOString()}. 
Availability: "${availabilityText}"

Return ONLY a JSON array of objects, each with:
- "datetime": ISO string (e.g., "2024-05-20T09:00:00Z")
- "duration": 60

Rules:
1. If the user indicates they are NOT available, refuse to provide times, or say something like "none of these work", return an empty array: []
2. If the user says "Monday morning", pick the next Monday at 9:00 AM, 10:00 AM, and 11:00 AM.
3. If the user says "Anytime Wednesday", pick Wednesday at 10 AM, 2 PM, and 4 PM.
4. If they are general (e.g., "next week"), provide at least 3 varied slots across different days.
5. Be helpful and guess reasonable professional times (between 9 AM and 5 PM). 
6. Return MAX 5 slots.
7. ONLY return the raw JSON array, no markdown, no explanation.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        let jsonStr = text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        return JSON.parse(jsonStr);
    } catch (err) {
        console.error('Gemini availability parse error:', err.message);
        return [{ datetime: new Date(Date.now() + 86400000).toISOString(), duration: 60 }];
    }
};

module.exports = { analyzeResume, parseAvailability };
