import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { cerebras } from '@ai-sdk/cerebras';
import { createOpenAI } from '@ai-sdk/openai';
import { CandidateProfileSchema } from '@/lib/candidate-schema';

// All available providers — requests are distributed randomly across them,
// then fall through to the next on rate limit to maximize combined throughput.
// OLLAMA_MODEL (e.g. "llama3.1:8b") = fully local, zero data leaves the machine.
function buildProviderList() {
  const list = [];
  if (process.env.LOCAL_AI_MODEL) {
    const baseURL = process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:11434/v1';
    const local = createOpenAI({ baseURL, apiKey: 'local' });
    list.push(local(process.env.LOCAL_AI_MODEL));
  }
  if (process.env.CEREBRAS_API_KEY) list.push(cerebras('llama3.1-8b'));
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) list.push(google('gemini-1.5-flash'));
  if (process.env.GROQ_API_KEY) list.push(groq('llama-3.1-8b-instant'));
  if (list.length === 0) list.push(groq('llama-3.1-8b-instant')); // last resort
  return list;
}
const PROVIDERS = buildProviderList();

export const runtime = 'nodejs';

const MAX_RESUME_CHARS = 350;
const MAX_JD_CHARS = 200;

const SYSTEM_PROMPT = `Recruiter AI. Screen resumes vs job description. Anonymize: names=Candidate, companies=[Co], schools=[Univ].

skillsScore: coverage=(matched_required/total_required). score=round(coverage*70). Then: +5 per bonus skill (max+15). Then: -10 per missing required skill (floor 0). A candidate matching 1 of 5 required skills scores ~4. All required matched scores 70+. Bonus skills can push to 85.
experienceScore: exact=90, 1yr_short=65, 2yr_short=40, 3+yr_short=20, overqualified=60.
scaleScore: solo=15, startup=35, mid=55, large=75, FAANG=95.
achievementScore: none=15, vague=40, metrics=70, exceptional=95.
domainScore: exact=100, adjacent=75, different=45, unrelated=15.
fitScore=round(skills*.3+exp*.2+scale*.2+achieve*.2+domain*.1).
decision: ADVANCE=75+ HOLD=50-74 REJECT=<50.

recruiterSummary: 1 sentence, max 12 words. Lead with years and top skill. Proper capitalization. No apostrophes. Example: "6 years Python and Django, strong AWS, missing PostgreSQL."

Return ONLY a raw JSON array, no markdown. Schema: {"yearsExperience":N,"careerLevel":"junior|mid|senior|lead|principal","requiredSkillsFound":["3 max"],"requiredSkillsMissing":["3 max"],"bonusSkills":["2 max"],"topAchievement":"6 words max","skillsScore":N,"experienceScore":N,"scaleScore":N,"achievementScore":N,"domainScore":N,"fitScore":N,"decision":"ADVANCE|HOLD|REJECT","recruiterSummary":"12 words, proper caps","concernFlag":"5 words max"}`;

function buildPrompt(jobDescription: string, resumes: string[], requiredSkills?: string[], bonusSkills?: string[]): string {
  const jd = jobDescription.slice(0, MAX_JD_CHARS);
  const skillContext = requiredSkills?.length
    ? `\nRequired skills: ${requiredSkills.join(', ')}${bonusSkills?.length ? `\nBonus skills: ${bonusSkills.join(', ')}` : ''}`
    : '';
  const blocks = resumes
    .map((r, i) => `RESUME ${i + 1}:\n${r.slice(0, MAX_RESUME_CHARS)}`)
    .join('\n\n---\n\n');
  return `JOB DESCRIPTION:\n${jd}${skillContext}\n\n${blocks}\n\nReturn a JSON array of exactly ${resumes.length} objects in order.`;
}

function sanitizeJson(s: string): string {
  return s
    .replace(/[\x00-\x1F\x7F]/g, m => m === '\n' || m === '\r' || m === '\t' ? m : ' ')
    .replace(/,\s*([}\]])/g, '$1')   // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys
}

function extractJsonArray(text: string): unknown[] {
  const cleaned = sanitizeJson(
    text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  );
  // Try direct parse
  try {
    const p = JSON.parse(cleaned);
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') return [p];
  } catch { /* fall through */ }
  // Find first [...] block
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const p = JSON.parse(sanitizeJson(arrMatch[0]));
      if (Array.isArray(p)) return p;
    } catch { /* fall through */ }
  }
  // Last resort: pick out individual {} objects
  const objs: unknown[] = [];
  for (const m of cleaned.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)) {
    try { objs.push(JSON.parse(sanitizeJson(m[0]))); } catch { /* skip */ }
  }
  return objs;
}

async function callWithProviders(
  jobDescription: string,
  resumes: string[],
  providerIdx: number,
  attempt = 0,
  requiredSkills?: string[],
  bonusSkills?: string[],
): Promise<unknown[]> {
  const model = PROVIDERS[providerIdx % PROVIDERS.length];
  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(jobDescription, resumes, requiredSkills, bonusSkills),
      maxOutputTokens: Math.min(180 * resumes.length + 100, 1200),
    });
    const arr = extractJsonArray(text);
    if (arr.length > 0) return arr;
    throw new Error('Empty parse result');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes('429') || /rate.?limit/i.test(msg) || /too many/i.test(msg);
    if (isRateLimit) {
      const nextIdx = providerIdx + 1;
      if (nextIdx < PROVIDERS.length) {
        // Try next provider immediately before waiting
        return callWithProviders(jobDescription, resumes, nextIdx, 0, requiredSkills, bonusSkills);
      }
      // All providers hit — wait then cycle back from beginning
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        return callWithProviders(jobDescription, resumes, 0, attempt + 1, requiredSkills, bonusSkills);
      }
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const { jobDescription, resumes, requiredSkills, bonusSkills } = await request.json() as {
      jobDescription: string;
      resumes: string[];
      requiredSkills?: string[];
      bonusSkills?: string[];
    };

    if (!jobDescription?.trim() || !resumes?.length) {
      return Response.json({ error: 'Job description and at least one resume are required.' }, { status: 400 });
    }

    // Start from a random provider so concurrent requests spread across all keys
    const startIdx = Math.floor(Math.random() * PROVIDERS.length);
    const rawArray = await callWithProviders(jobDescription, resumes, startIdx, 0, requiredSkills, bonusSkills);

    const candidates = rawArray
      .slice(0, resumes.length)
      .map((raw, i) => {
        try {
          return CandidateProfileSchema.parse({ ...(raw as object), id: String(i + 1) });
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return Response.json({ candidates });
  } catch (err) {
    console.error('Batch screen error:', err);
    return Response.json({ error: 'Screening failed.' }, { status: 500 });
  }
}
