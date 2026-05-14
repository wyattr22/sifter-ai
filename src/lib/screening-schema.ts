import { z } from 'zod';

export const ScreeningSchema = z.object({
  decision: z.enum(['ADVANCE', 'HOLD', 'REJECT']),
  fitScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).min(1).max(6),
  gaps: z.array(z.string()).min(0).max(6),
  recruiterSummary: z.string().min(50).max(400),
  topReason: z.string().max(120),
  minutesSaved: z.number().int(),
});

export type Screening = z.infer<typeof ScreeningSchema>;
