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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    let skills = [];
    if (Array.isArray(requiredSkills)) {
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
            summary: "Analysis Failed: No text could be extracted from the uploaded resume."
        };
    }

    const matched = skills.filter(s => resumeLower.includes(s.toLowerCase()));
    const missing = skills.filter(s => !resumeLower.includes(s.toLowerCase()));
    const skillsRatio = skills.length > 0 ? matched.length / skills.length : 0;
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
        summary: `Simulation Analysis: Identified ${matched.length}/${skills.length} matching keywords. Total resume length: ${resumeLower.split(' ').length} words.`
    };
}


// ═══════════════════════════════════════════════════════════════════
// 2. LLM AVAILABILITY EXTRACTION (Step 2 of pipeline)
// ═══════════════════════════════════════════════════════════════════

const parseAvailability = async (availabilityText) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.log('⚠️ No GEMINI_API_KEY — using fallback parser');
        return fallbackParseAvailability(availabilityText);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const now = new Date();
        const prompt = `You are a scheduling assistant. Extract structured availability from a candidate's natural language input.

CURRENT DATE/TIME: ${now.toISOString()} (${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
TIMEZONE: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

CANDIDATE INPUT: "${availabilityText}"

TASK: Extract all available time slots from the input. Return a JSON object with:

{
  "slots": [
    { "datetime": "ISO-8601 string", "duration": 60 }
  ],
  "extracted_days": ["Monday", "Tuesday"],
  "extracted_times": ["morning", "after 4 PM"],
  "constraints": ["except Wednesday", "not before 10 AM"],
  "intent": "available" | "unavailable" | "reschedule" | "unclear"
}

RULES:
1. "intent" = "available" if the candidate is providing times they can meet.
   "intent" = "unavailable" if they say they can't meet or none work.
   "intent" = "reschedule" if they want to change a previously booked time.
   "intent" = "unclear" if the message is ambiguous or unrelated.

2. ONLY generate slots for times the candidate IS available.
3. Resolve relative dates (e.g. "next Monday", "this Friday", "tomorrow") to absolute dates based on CURRENT DATE above.
4. If candidate says "morning", use 9:00 AM, 10:00 AM, 11:00 AM.
   If "afternoon", use 1:00 PM, 2:00 PM, 3:00 PM.
   If "evening", use 4:00 PM, 5:00 PM.
   If "after X PM", start from X PM onward in 1-hr increments up to 6 PM.
5. All times must be within business hours: 9:00 AM – 6:00 PM.
6. Respect constraints (e.g., "except Wednesday" = skip Wednesday).
7. Maximum 5 slots.
8. Duration is always 60 minutes.
9. Return ONLY the raw JSON object. No markdown, no explanation.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        let jsonStr = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);

        console.log(`🧠 LLM Extraction:`, JSON.stringify({
            intent: parsed.intent,
            days: parsed.extracted_days,
            times: parsed.extracted_times,
            constraints: parsed.constraints,
            slot_count: parsed.slots?.length || 0
        }));

        // If intent is not "available", return empty
        if (parsed.intent === 'unavailable' || parsed.intent === 'unclear') {
            console.log(`⚠️ Intent="${parsed.intent}" — returning empty slots`);
            return [];
        }

        const rawSlots = parsed.slots || [];

        // ─── Step 3: Validation & Normalization Layer ────────────
        const validated = validateAndNormalizeSlots(rawSlots);
        console.log(`✅ Validated ${validated.length}/${rawSlots.length} slots`);

        return validated;

    } catch (err) {
        console.error('Gemini availability parse error:', err.message);
        return fallbackParseAvailability(availabilityText);
    }
};


// ═══════════════════════════════════════════════════════════════════
// 3. VALIDATION & NORMALIZATION LAYER (Step 3 of pipeline)
//    - JSON schema validation
//    - 24-hour time normalization
//    - Business-hour filtering (9 AM – 6 PM)
//    - Relative → absolute date resolution
//    - Past-date rejection
//    - Duplicate removal
// ═══════════════════════════════════════════════════════════════════

const validateAndNormalizeSlots = (slots) => {
    if (!Array.isArray(slots)) return [];

    const now = new Date();
    const seen = new Set();
    const validated = [];

    for (const slot of slots) {
        // Schema validation: must have datetime string
        if (!slot || typeof slot.datetime !== 'string') {
            console.log('  ⊘ Skipped: missing datetime');
            continue;
        }

        // Parse and validate date
        const dt = new Date(slot.datetime);
        if (isNaN(dt.getTime())) {
            console.log(`  ⊘ Skipped: invalid date "${slot.datetime}"`);
            continue;
        }

        // Reject past dates (must be at least 1 hour in the future)
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        if (dt < oneHourFromNow) {
            console.log(`  ⊘ Skipped: past date ${dt.toISOString()}`);
            continue;
        }

        // Business-hour filtering: 9:00 AM – 6:00 PM
        const hour = dt.getHours();
        if (hour < 9 || hour >= 18) {
            console.log(`  ⊘ Skipped: outside business hours (${hour}:00) for ${dt.toISOString()}`);
            continue;
        }

        // Normalize duration to 60 if missing or invalid
        const duration = (typeof slot.duration === 'number' && slot.duration > 0) ? slot.duration : 60;

        // Check end time doesn't exceed 6 PM
        const endHour = hour + (duration / 60);
        if (endHour > 18) {
            console.log(`  ⊘ Skipped: slot end (${endHour}:00) exceeds business hours`);
            continue;
        }

        // Deduplicate by rounded timestamp (round to nearest 15 min)
        const roundedMs = Math.round(dt.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const key = new Date(roundedMs).toISOString();
        if (seen.has(key)) {
            console.log(`  ⊘ Skipped: duplicate slot ${key}`);
            continue;
        }
        seen.add(key);

        // Normalize: zero out seconds and milliseconds
        dt.setSeconds(0, 0);

        validated.push({
            datetime: dt.toISOString(),
            duration: duration
        });
    }

    // Return max 5 slots, sorted chronologically
    return validated
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
        .slice(0, 5);
};


// ═══════════════════════════════════════════════════════════════════
// FALLBACK PARSER (when no API key)
// ═══════════════════════════════════════════════════════════════════

const fallbackParseAvailability = (text) => {
    const today = new Date();
    const slots = [];
    const lower = text.toLowerCase();

    const dayMap = { 'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6 };

    // Check for time preferences
    let hours = [10, 14]; // Default: 10 AM and 2 PM
    if (lower.includes('morning')) hours = [9, 10, 11];
    else if (lower.includes('afternoon')) hours = [13, 14, 15];
    else if (lower.includes('evening')) hours = [16, 17];

    // Extract "after X" pattern
    const afterMatch = lower.match(/after\s+(\d{1,2})\s*(am|pm)?/);
    if (afterMatch) {
        let h = parseInt(afterMatch[1]);
        if (afterMatch[2] === 'pm' && h < 12) h += 12;
        if (afterMatch[2] === 'am' && h === 12) h = 0;
        hours = [];
        for (let t = h; t < 18; t++) {
            if (t >= 9) hours.push(t);
        }
        if (hours.length > 3) hours = hours.slice(0, 3);
    }

    let foundDay = false;
    for (const [day, val] of Object.entries(dayMap)) {
        if (lower.includes(day)) {
            const d = new Date(today);
            let diff = val - today.getDay();
            if (diff <= 0) diff += 7;
            d.setDate(today.getDate() + diff);

            for (const h of hours) {
                d.setHours(h, 0, 0, 0);
                if (h >= 9 && h < 18) {
                    slots.push({ datetime: new Date(d).toISOString(), duration: 60 });
                }
            }
            foundDay = true;
        }
    }

    if (!foundDay) {
        // Default to next weekday
        const d = new Date(today);
        d.setDate(today.getDate() + 1);
        while (d.getDay() === 0 || d.getDay() === 6) {
            d.setDate(d.getDate() + 1);
        }
        for (const h of hours.slice(0, 2)) {
            d.setHours(h, 0, 0, 0);
            slots.push({ datetime: new Date(d).toISOString(), duration: 60 });
        }
    }

    return validateAndNormalizeSlots(slots);
};


module.exports = { analyzeResume, parseAvailability, validateAndNormalizeSlots };
