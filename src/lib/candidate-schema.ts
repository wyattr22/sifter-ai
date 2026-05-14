import { z } from 'zod';

export const CandidateProfileSchema = z.object({
  id: z.string(),
  yearsExperience: z.number(),
  careerLevel: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']),
  requiredSkillsFound: z.array(z.string()),
  requiredSkillsMissing: z.array(z.string()),
  bonusSkills: z.array(z.string()),
  topAchievement: z.string(),
  // Five scoring dimensions
  skillsScore: z.number().int().min(0).max(100),       // Required tech/tools coverage
  experienceScore: z.number().int().min(0).max(100),   // Years + seniority match
  scaleScore: z.number().int().min(0).max(100),        // Team/system/revenue scale
  achievementScore: z.number().int().min(0).max(100),  // Quantified impact quality
  domainScore: z.number().int().min(0).max(100),       // Industry/domain alignment
  fitScore: z.number().int().min(0).max(100),          // Weighted composite
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
