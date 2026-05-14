import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { CandidateProfileSchema } from '@/lib/candidate-schema';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert recruiter AI screening candidates blindly to remove bias.

ANONYMIZATION (required):
- Replace all person names with "Candidate"
- Replace company names with [Company A], [Company B], etc.
- Replace university/school names with [University]
- Keep all skills, technologies, years of experience, and quantified numbers

FIVE SCORING DIMENSIONS — score each 0-100:

skillsScore: Required tech/tools coverage
- Divide 100 by the number of required skills. Award each share when that skill is CLEARLY present.
- Add up to 15 bonus points for closely adjacent skills.
- Example: 4 required skills = 25pts each. 3 found + 1 adjacent = 75 + 10 = 85.

experienceScore: Years of experience vs required + seniority level match
- Years match: within target range = 60pts; 1yr short = 45pts; 2yr short = 30pts; 3+yr short = 15pts; over-experienced = 55pts (consider overqualification risk).
- Level match: exact = +30pts; adjacent = +20pts; off by 2+ = +5pts.
- Junior applying to senior = max 30. Senior applying to junior = 55.

scaleScore: Scope and scale of past work
- 0-30: Solo projects / small startups (<10 people, toy traffic)
- 31-55: Small teams (10-50), moderate scale
- 56-75: Mid-size orgs (50-500), real production systems
- 76-90: Large orgs or scale (500+ people, >100k users/req/day, significant revenue impact)
- 91-100: Elite scale (millions of users, multi-billion $ impact, FAANG/equivalent)

achievementScore: Quality of quantified achievements
- 0-20: No metrics, vague claims ("worked on projects")
- 21-50: Some numbers but minor impact ("improved speed by 10%")
- 51-75: Clear wins with real metrics ("reduced latency 40%, saved $200k")
- 76-90: Strong measurable outcomes that changed the business
- 91-100: Exceptional, verifiable impact with specific numbers

domainScore: Industry and domain alignment
- 100: Exact industry match
- 75: Adjacent industry with highly transferable experience
- 50: Different industry, transferable skills
- 25: Unrelated industry, steep learning curve
- 0: No domain relevance

fitScore: Weighted composite
fitScore = round(skillsScore×0.30 + experienceScore×0.20 + scaleScore×0.20 + achievementScore×0.20 + domainScore×0.10)

scoreBreakdown: One concise line, e.g.:
"Skills 85 · Exp 70 · Scale 60 · Impact 80 · Domain 100 → fit 79"

Respond ONLY with a valid JSON object — no markdown, no code fences:
{
  "yearsExperience": <number>,
  "careerLevel": "junior"|"mid"|"senior"|"lead"|"principal",
  "requiredSkillsFound": ["skill1"],
  "requiredSkillsMissing": ["skill2"],
  "bonusSkills": ["bonus skill"],
  "topAchievement": "anonymized best achievement with metric",
  "skillsScore": <0-100>,
  "experienceScore": <0-100>,
  "scaleScore": <0-100>,
  "achievementScore": <0-100>,
  "domainScore": <0-100>,
  "fitScore": <0-100>,
  "scoreBreakdown": "Skills N · Exp N · Scale N · Impact N · Domain N → fit N",
  "advancePitch": "under 12 words: strongest reason to advance",
  "concernFlag": "under 12 words: biggest risk or gap"
}`;

function buildPrompt(jobDescription: string, resume: string) {
  return `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resume}`;
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
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

    // Process sequentially to avoid Groq rate limits, collect partial results
    const candidates = [];
    for (let i = 0; i < resumes.length; i++) {
      try {
        const result = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(jobDescription, resumes[i]),
          maxOutputTokens: 900,
        });

        const raw = stripFences(result.text);
        const parsed = CandidateProfileSchema.parse({
          ...JSON.parse(raw),
          id: String(i + 1),
        });
        candidates.push(parsed);
      } catch (err) {
        // Log but skip — don't fail entire batch for one bad parse
        console.error(`Resume ${i} failed:`, err instanceof Error ? err.message : err);
      }
    }

    return Response.json({ candidates });
  } catch (err) {
    console.error('Batch screen error:', err);
    return Response.json({ error: 'Screening failed. Check your GROQ_API_KEY.' }, { status: 500 });
  }
}
