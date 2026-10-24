import { z } from "zod"

export const CycleSchema = z.object({
  daysSelected: z
    .array(z.number().int().min(1).max(31))
    .min(1, "Selecione ao menos um dia")
    .max(15, "Selecione no máximo 15 dias"),
  regularity: z.string().min(1),
  cycleLengthDays: z
    .number({ error: "Informe a duração do ciclo" })
    .int()
    .min(21, "A duração do ciclo deve estar entre 21 e 35 dias")
    .max(35, "A duração do ciclo deve estar entre 21 e 35 dias"),
  lastPeriodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida, use AAAA-MM-DD")
    .optional(),
})

export type CycleInput = z.infer<typeof CycleSchema>