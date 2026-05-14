import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { CandidateProfileSchema } from '@/lib/candidate-schema';

export const runtime = 'nodejs';

// Ultra-concise prompt — minimize tokens per call
const SYSTEM_PROMPT = `Recruiter AI. Anonymize: names→"Candidate", companies→[Company A/B], schools→[University]. Keep skills/years/numbers.

Score 0-100 each, then output ONLY a raw JSON object (no markdown, no fences):
skillsScore: matched required skills / total required * 85, bonus skills +5 each (max 15 bonus)
experienceScore: exact years+level=90, 1yr short=65, 2yr short=40, 3+yr short=20, overqualified=60
scaleScore: solo/toy=15, small startup=35, mid-company=55, large org=75, FAANG-scale=95
achievementScore: no numbers=15, vague claims=40, clear metrics=70, exceptional impact=95
domainScore: exact industry=100, adjacent=75, different=45, unrelated=15
fitScore=round(skillsScore*0.3+experienceScore*0.2+scaleScore*0.2+achievementScore*0.2+domainScore*0.1)

{"yearsExperience":N,"careerLevel":"junior|mid|senior|lead|principal","requiredSkillsFound":["skill"],"requiredSkillsMissing":["skill"],"bonusSkills":["skill"],"topAchievement":"anonymized+metric","skillsScore":N,"experienceScore":N,"scaleScore":N,"achievementScore":N,"domainScore":N,"fitScore":N,"scoreBreakdown":"Skills N·Exp N·Scale N·Impact N·Domain N→fit N","advancePitch":"12 words max","concernFlag":"12 words max"}`;

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
          model: groq('llama-3.1-8b-instant'),
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

    const errors = settled
      .filter(r => r.status === 'rejected')
      .map((r, i) => {
        const msg = (r as PromiseRejectedResult).reason?.message ?? 'unknown';
        console.error(`Resume ${i} failed: ${msg}`);
        return msg;
      });

    return Response.json({ candidates, debug_errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error('Batch screen error:', err);
    return Response.json({ error: 'Screening failed.' }, { status: 500 });
  }
}
