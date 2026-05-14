import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { CandidateProfileSchema } from '@/lib/candidate-schema';

export const runtime = 'nodejs';

// Concise prompt — fewer tokens = faster response
const SYSTEM_PROMPT = `You are a recruiter AI. Screen resumes blindly. Anonymize all person names → "Candidate", companies → [Company A/B/etc], schools → [University].

Score each dimension 0-100:
skillsScore: each required skill = 100/count(required) pts. Award only if CLEARLY present. Bonus skills add up to 15 extra.
experienceScore: years match → exact/above=70, 1yr short=55, 2yr short=40, 3+yr short=20. Level match → exact=+20, adjacent=+10, 2+ off=+0.
scaleScore: solo/toy=15, small startup=35, mid-company=55, large org=75, FAANG/unicorn scale=95
achievementScore: no metrics=15, vague=35, some numbers=55, clear business impact=75, exceptional quantified results=95
domainScore: exact industry=100, adjacent=75, different but transferable=50, unrelated=20
fitScore: round(skillsScore×0.30 + experienceScore×0.20 + scaleScore×0.20 + achievementScore×0.20 + domainScore×0.10)

Return ONLY a JSON object, no markdown:
{"yearsExperience":N,"careerLevel":"junior|mid|senior|lead|principal","requiredSkillsFound":["..."],"requiredSkillsMissing":["..."],"bonusSkills":["..."],"topAchievement":"anonymized achievement with metric","skillsScore":N,"experienceScore":N,"scaleScore":N,"achievementScore":N,"domainScore":N,"fitScore":N,"scoreBreakdown":"Skills N · Exp N · Scale N · Impact N · Domain N → fit N","advancePitch":"≤12 words best reason to advance","concernFlag":"≤12 words biggest gap or risk"}`;

function buildPrompt(jobDescription: string, resume: string) {
  return `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resume}`;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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

    // Process in parallel — caller controls concurrency by sending small batches
    const settled = await Promise.allSettled(
      resumes.map(async (resume, i) => {
        const result = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(jobDescription, resume),
          maxOutputTokens: 600,
        });

        const raw = stripFences(result.text);
        return CandidateProfileSchema.parse({ ...JSON.parse(raw), id: String(i + 1) });
      })
    );

    const candidates = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<typeof settled[0] extends PromiseFulfilledResult<infer T> ? T : never>).value);

    settled
      .filter(r => r.status === 'rejected')
      .forEach((r, i) => console.error(`Resume ${i} failed:`, (r as PromiseRejectedResult).reason?.message));

    return Response.json({ candidates });
  } catch (err) {
    console.error('Batch screen error:', err);
    return Response.json({ error: 'Screening failed.' }, { status: 500 });
  }
}
