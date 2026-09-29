import { z } from "zod"

export const CycleSchema = z.object({
  durationDays: z.number().int().min(1).max(15),
  daysSelected: z.array(z.number().int().min(1).max(31)).min(1, "Selecione ao menos um dia"),
  regularity: z.string(),
})