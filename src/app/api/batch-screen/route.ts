import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { CandidateProfileSchema } from '@/lib/candidate-schema';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert recruiter AI screening candidates blindly to remove bias.

ANONYMIZATION (strictly required):
- Replace all person names with "Candidate"
- Replace ALL company names with [Company A], [Company B], etc.
- Replace ALL university/school names with [University]
- Keep all skills, technologies, years of experience, and quantified achievements

SCORING FORMULA — follow this exactly for consistent, explainable scores:

technicalScore (0–100):
- Divide 80 points equally among the required skills listed in the job description.
- Award each point block only when the skill is CLEARLY present in the resume.
- Award up to 20 additional points for bonus/adjacent skills that add value.
- Example: 5 required skills = 16pts each. 3 found = 48pts + 8pts bonus = 56.

experienceScore (0–100):
- Years of experience vs required years: exact match or above = 70pts; within 1yr under = 55pts; 2yrs under = 40pts; 3+yrs under = 20pts.
- Career level match: exact level = +20pts; adjacent level (e.g. senior for lead role) = +10pts; off by 2+ levels = 0pts.
- Direct domain/industry experience: +10pts.

fitScore (0–100):
- fitScore = round(technicalScore × 0.50 + experienceScore × 0.35 + impactScore × 0.15)
- impactScore (0–100): quality of achievements — strong quantified metrics = 80–100, some metrics = 50–70, vague = 20–40.

scoreBreakdown: ONE concise line explaining the fit score. Examples:
"4/5 skills · 6y exp (req 5+) · strong scale metrics"
"2/4 skills missing Python & AWS · 3y under required · generic achievements"
"All skills present · over-experienced by 3y · impressive at [Company A]"

Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation:
{
  "yearsExperience": <number, total relevant work experience>,
  "careerLevel": "junior" | "mid" | "senior" | "lead" | "principal",
  "requiredSkillsFound": ["skill1", "skill2"],
  "requiredSkillsMissing": ["skill3"],
  "bonusSkills": ["extra relevant skill"],
  "topAchievement": "anonymized single best achievement with a metric",
  "technicalScore": <0-100, computed per formula above>,
  "experienceScore": <0-100, computed per formula above>,
  "fitScore": <0-100, computed per formula above>,
  "scoreBreakdown": "one-line explanation of the fit score",
  "advancePitch": "under 12 words: strongest reason to advance",
  "concernFlag": "under 12 words: biggest risk or gap"
}`;

function buildPrompt(jobDescription: string, resume: string) {
  return `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resume}`;
}

export async function POST(request: Request) {
  try {
    const { jobDescription, resumes } = await request.json() as {
      jobDescription: string;
      resumes: string[];
    };

    if (!jobDescription?.trim() || !resumes?.length) {
      return Response.json({ error: 'Job description and at least one resume are required.' }, { status: 400 });
    }

    const results = await Promise.all(
      resumes.map(async (resume, i) => {
        const result = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(jobDescription, resume),
          maxOutputTokens: 700,
        });

        const raw = result.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const parsed = CandidateProfileSchema.parse({
          ...JSON.parse(raw),
          id: String(i + 1),
        });
        return parsed;
      })
    );

    return Response.json({ candidates: results });
  } catch (err) {
    console.error('Batch screen error:', err);
    return Response.json({ error: 'Screening failed. Check your GROQ_API_KEY.' }, { status: 500 });
  }
}
