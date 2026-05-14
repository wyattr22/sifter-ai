import { z } from 'zod';

export const CandidateProfileSchema = z.object({
  id: z.string(),
  yearsExperience: z.number(),
  careerLevel: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']),
  requiredSkillsFound: z.array(z.string()),
  requiredSkillsMissing: z.array(z.string()),
  bonusSkills: z.array(z.string()),
  topAchievement: z.string(),
  technicalScore: z.number().int().min(0).max(100),
  experienceScore: z.number().int().min(0).max(100),
  fitScore: z.number().int().min(0).max(100),
  scoreBreakdown: z.string().default(''),
  advancePitch: z.string(),
  concernFlag: z.string(),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const ROUNDS = [
  { name: 'Technical', label: 'Round 1', focus: 'Required skills match', color: 'blue' as const },
  { name: 'Experience', label: 'Round 2', focus: 'Seniority & level', color: 'violet' as const },
  { name: 'Overall Fit', label: 'Round 3', focus: 'Would you interview them?', color: 'emerald' as const },
] as const;
