import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { CandidateProfileSchema } from '@/lib/candidate-schema';
import { z } from 'zod';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an expert recruiter AI screening candidates blindly to remove bias.

ANONYMIZATION (strictly required):
- Replace all person names with "Candidate"
- Replace ALL company names with [Company A], [Company B], etc.
- Replace ALL university/school names with [University]
- Keep all skills, technologies, years of experience, and quantified achievements

For the given resume and job description, extract a structured profile.
Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation:
{
  "yearsExperience": <number, total relevant work experience>,
  "careerLevel": "junior" | "mid" | "senior" | "lead" | "principal",
  "requiredSkillsFound": ["skill1", "skill2"],
  "requiredSkillsMissing": ["skill3"],
  "bonusSkills": ["extra relevant skill"],
  "topAchievement": "anonymized single best achievement with a metric",
  "technicalScore": <0-100, how well required technical skills are met>,
  "experienceScore": <0-100, how well experience level and years match>,
  "fitScore": <0-100, overall holistic fit>,
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
          maxOutputTokens: 600,
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
