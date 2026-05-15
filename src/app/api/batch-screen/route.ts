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

const MAX_RESUME_CHARS = 1200;
const MAX_JD_CHARS = 400;

export interface ScoringWeights {
  skills: number;      // 0–100, must sum to 100 with others
  experience: number;
  scale: number;
  impact: number;
  domain: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = { skills: 30, experience: 20, scale: 20, impact: 20, domain: 10 };

const SYSTEM_PROMPT_BASE = `Recruiter AI. Screen resumes vs job description. Anonymize: names=Candidate, companies=[Co], schools=[Univ].

skillsScore: coverage=(matched_required/total_required). score=round(coverage*70)+bonus. Bonus: +5 per bonus skill found, max+15. Floor 0, ceiling 85. Examples: 0/5 required=0, 1/5=14, 3/5=42, 5/5=70, 5/5+3bonus=85. Scales correctly for any number of required skills.
experienceScore: exact=90, 1yr_short=65, 2yr_short=40, 3+yr_short=20, overqualified=60.
scaleScore: solo=15, startup=35, mid=55, large=75, FAANG=95.
achievementScore: none=15, vague=40, metrics=70, exceptional=95.
domainScore: exact=100, adjacent=75, different=45, unrelated=15.
decision: ADVANCE=75+ HOLD=50-74 REJECT=<50.

recruiterSummary: 1 sentence, max 15 words. State years, top matched skill, and the PRIMARY reason for the decision. If missing required skills, name them. Proper capitalization. No apostrophes. Examples: "6 years Python and Django, strong AWS, missing PostgreSQL and Redis." / "4 years React and TypeScript, no backend experience required." / "8 years Java but domain is finance not healthcare."

Return ONLY a raw JSON array, no markdown. Schema: {"yearsExperience":N,"careerLevel":"junior|mid|senior|lead|principal","requiredSkillsFound":["5 max"],"requiredSkillsMissing":["5 max"],"bonusSkills":["3 max"],"topAchievement":"6 words max","skillsScore":N,"experienceScore":N,"scaleScore":N,"achievementScore":N,"domainScore":N,"fitScore":N,"decision":"ADVANCE|HOLD|REJECT","recruiterSummary":"12 words, proper caps","concernFlag":"5 words max"}`;

function buildSystemPrompt(w: ScoringWeights): string {
  const s = w.skills / 100, e = w.experience / 100, sc = w.scale / 100, a = w.impact / 100, d = w.domain / 100;
  return `${SYSTEM_PROMPT_BASE}\nfitScore=round(skills*${s}+exp*${e}+scale*${sc}+achieve*${a}+domain*${d}).`;
}

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
  weights?: ScoringWeights,
): Promise<unknown[]> {
  const model = PROVIDERS[providerIdx % PROVIDERS.length];
  try {
    const { text } = await generateText({
      model,
      system: buildSystemPrompt(weights ?? DEFAULT_WEIGHTS),
      prompt: buildPrompt(jobDescription, resumes, requiredSkills, bonusSkills),
      maxOutputTokens: Math.min(200 * resumes.length + 100, 1200),
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
        return callWithProviders(jobDescription, resumes, nextIdx, 0, requiredSkills, bonusSkills, weights);
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        return callWithProviders(jobDescription, resumes, 0, attempt + 1, requiredSkills, bonusSkills, weights);
      }
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const { jobDescription, resumes, requiredSkills, bonusSkills, weights } = await request.json() as {
      jobDescription: string;
      resumes: string[];
      requiredSkills?: string[];
      bonusSkills?: string[];
      weights?: ScoringWeights;
    };

    if (!jobDescription?.trim() || !resumes?.length) {
      return Response.json({ error: 'Job description and at least one resume are required.' }, { status: 400 });
    }

    const startIdx = Math.floor(Math.random() * PROVIDERS.length);
    const rawArray = await callWithProviders(jobDescription, resumes, startIdx, 0, requiredSkills, bonusSkills, weights);

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
