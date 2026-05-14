import { z } from 'zod';

export const CandidateProfileSchema = z.object({
  id: z.string(),
  yearsExperience: z.number(),
  careerLevel: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']),
  requiredSkillsFound: z.array(z.string()),
  requiredSkillsMissing: z.array(z.string()),
  bonusSkills: z.array(z.string()),
  topAchievement: z.string(),
  // Five scoring dimensions — all default to 0 so a missing field doesn't drop the candidate
  skillsScore: z.number().min(0).max(100).default(0).transform(Math.round),
  experienceScore: z.number().min(0).max(100).default(0).transform(Math.round),
  scaleScore: z.number().min(0).max(100).default(0).transform(Math.round),
  achievementScore: z.number().min(0).max(100).default(0).transform(Math.round),
  domainScore: z.number().min(0).max(100).default(0).transform(Math.round),
  fitScore: z.number().min(0).max(100).default(0).transform(Math.round),
  scoreBreakdown: z.string().default(''),
  advancePitch: z.string(),
  concernFlag: z.string(),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const ROUNDS = [
  { name: 'Technical', label: 'Round 1', focus: 'Skills & technical match', color: 'blue' as const },
  { name: 'Experience', label: 'Round 2', focus: 'Seniority, scale & impact', color: 'violet' as const },
  { name: 'Overall Fit', label: 'Round 3', focus: 'Would you interview them?', color: 'emerald' as const },
] as const;
