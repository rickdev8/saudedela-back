import { z } from "zod"

const flowLabelToValue = {
  "Sem fluxo": "none",
  "Leve": "light",
  "Moderado": "medium",
  "Intenso": "heavy",
} as const

const painLabelToValue = {
  "Nenhuma": "none",
  "Leve": "light",
  "Moderada": "moderate",
  "Forte": "strong",
  "Muito forte": "very_strong",
} as const

const energyLabelToValue = {
  "Baixa": "low",
  "Normal": "normal",
  "Alta": "high",
} as const

const sleepLabelToValue = {
  "Ruim": "bad",
  "Regular": "regular",
  "Bom": "good",
} as const

export const createEntrySchema = z.object({
  date: z.string().min(1, "Informe a data"),
  flow: z
    .enum(["Sem fluxo", "Leve", "Moderado", "Intenso"])
    .nullable()
    .default(null)
    .transform((label) => (label ? flowLabelToValue[label] : null)),
  painIntensity: z
    .enum(["Nenhuma", "Leve", "Moderada", "Forte", "Muito forte"])
    .nullable()
    .default(null)
    .transform((label) => (label ? painLabelToValue[label] : null)),
  energy: z
    .enum(["Baixa", "Normal", "Alta"])
    .nullable()
    .default(null)
    .transform((label) => (label ? energyLabelToValue[label] : null)),
  sleep: z
    .enum(["Ruim", "Regular", "Bom"])
    .nullable()
    .default(null)
    .transform((label) => (label ? sleepLabelToValue[label] : null)),
  mood: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  symptoms: z.array(z.string()).default([]),
})

export const listEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().optional(),
  flow: z.enum(["none", "light", "medium", "heavy"]).optional(),
  painIntensity: z.enum(["none", "light", "moderate", "strong", "very_strong"]).optional(),
  energy: z.enum(["low", "normal", "high"]).optional(),
  sleep: z.enum(["bad", "regular", "good"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})