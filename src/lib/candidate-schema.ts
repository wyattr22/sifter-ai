import { z } from 'zod';

const scoreField = z.coerce.number().min(0).max(100).default(0).transform(Math.round);

export const CandidateProfileSchema = z.object({
  id: z.string(),
  yearsExperience: z.coerce.number().default(0),
  careerLevel: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']).catch('mid'),
  requiredSkillsFound: z.array(z.string()).default([]),
  requiredSkillsMissing: z.array(z.string()).default([]),
  bonusSkills: z.array(z.string()).default([]),
  topAchievement: z.string().default(''),
  skillsScore: scoreField,
  experienceScore: scoreField,
  scaleScore: scoreField,
  achievementScore: scoreField,
  domainScore: scoreField,
  fitScore: scoreField,
  scoreBreakdown: z.string().default(''),
  decision: z.enum(['ADVANCE', 'HOLD', 'REJECT']).catch('HOLD'),
  recruiterSummary: z.string().default(''),
  advancePitch: z.string().default(''),
  concernFlag: z.string().default(''),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const ROUNDS = [
  {
    name: 'Technical', label: 'Round 1', focus: 'Skills & technical match', color: 'blue' as const,
    explain: 'Do they have the required skills? Cut anyone clearly missing core qualifications.',
  },
  {
    name: 'Experience', label: 'Round 2', focus: 'Seniority, scale & impact', color: 'violet' as const,
    explain: 'Skills matched — now check depth. Have they worked at meaningful scale and driven measurable results?',
  },
  {
    name: 'Overall Fit', label: 'Round 3', focus: 'Would you interview them?', color: 'emerald' as const,
    explain: 'Full picture visible. All five dimensions shown. Final call: advance to interview or pass?',
  },
] as const;
