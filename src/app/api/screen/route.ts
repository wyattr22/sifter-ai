import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { ScreeningSchema } from '@/lib/screening-schema';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert recruiter AI. Screen resumes against job descriptions and produce a decisive hiring recommendation.

DECISION RULES:
- ADVANCE: fitScore 75-100. Candidate clearly meets core requirements. Schedule the interview.
- HOLD: fitScore 50-74. Plausibly qualified but has meaningful gaps — recommend a phone screen to clarify.
- REJECT: fitScore 0-49. Missing required qualifications. Recommend passing on this candidate.

FIT SCORE CALCULATION:
- Required skills present: +40pts (proportional — missing any required skill is a heavy penalty)
- Years of experience match: +20pts
- Domain/industry match: +15pts
- Nice-to-have skills present: +15pts
- Education match (only if explicitly required): +10pts

OUTPUT RULES:
- strengths: Specific, concrete strengths from the resume matching this role. Name actual technologies, companies, or achievements.
- gaps: Only list real gaps for THIS specific job. Do not fabricate gaps.
- recruiterSummary: Write for a non-technical recruiter. No jargon. 2-4 sentences. Start with the decision rationale.
- topReason: A single sentence, max 15 words, stating the primary reason for your decision.
- minutesSaved: Always return 3.

Be decisive. HOLD is not a polite REJECT — only use HOLD when you genuinely need more information.

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation. Use exactly these fields:
{
  "decision": "ADVANCE" | "HOLD" | "REJECT",
  "fitScore": <integer 0-100>,
  "strengths": ["<string>", ...],
  "gaps": ["<string>", ...],
  "recruiterSummary": "<2-4 sentence plain English paragraph>",
  "topReason": "<single sentence, max 15 words>",
  "minutesSaved": 3
}`;

export async function POST(request: Request) {
  try {
    const { jobDescription, resumeText } = await request.json();

    if (!jobDescription?.trim() || !resumeText?.trim()) {
      return Response.json({ error: 'Both job description and resume are required.' }, { status: 400 });
    }

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      prompt: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resumeText}`,
      maxOutputTokens: 800,
    });

    // Strip any accidental markdown fences the model might add
    const raw = result.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = ScreeningSchema.parse(JSON.parse(raw));
    return Response.json(parsed);
  } catch (err) {
    console.error('Screening error:', err);
    return Response.json(
      { error: 'Screening failed. Check that your GROQ_API_KEY is set in .env.local.' },
      { status: 500 }
    );
  }
}
