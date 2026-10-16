// schemas/SymptomsSchema.ts
import { z } from "zod"

onst flowMap = { "Sem fluxo": "none", "Leve": "light", "Moderado": "medium", "Intenso": "heavy" } as const
const painMap = { "Nenhuma": "none", "Leve": "light", "Moderada": "moderate", "Forte": "strong", "Muito forte": "very_strong" } as const
const energyMap = { "Baixa": "low", "Normal": "normal", "Alta": "high" } as const
const sleepMap = { "Ruim": "bad", "Regular": "regular", "Bom": "good" } as const


function labelEnum<T extends Record<string, string>>(map: T) {
  return z
    .enum(Object.keys(map) as [keyof T & string, ...(keyof T & string)[]])
    .nullable()
    .default(null)
    .transform((label) => (label ? map[label] : null))
}

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
  "Abaixo do normal": "Below normal",
  "Boa": "Good",
  "Baixa": "low",
  "Normal": "normal",
  "Alta": "high",
} as const

const sleepLabelToValue = {
  "Ruim": "bad",
  "Regular": "regular",
  "Bom": "good",
} as const

// minúsculas, sem acento, sem espaços nas pontas
function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function optionField<T extends string>(
  map: Record<string, T>,
  aliases: Record<string, T> = {}
) {
  const lookup = new Map<string, T>()

  for (const [label, value] of Object.entries(map)) {
    lookup.set(normalize(label), value) // "Baixa" -> low
    lookup.set(normalize(value), value) // "low"   -> low
  }
  for (const [alias, value] of Object.entries(aliases)) {
    lookup.set(normalize(alias), value)
  }

  return z.any().transform((raw, ctx): T | null => {
    if (raw === null || raw === undefined) return null
    if (typeof raw !== "string" || raw.trim() === "") return null

    const found = lookup.get(normalize(raw))
    if (!found) {
      ctx.addIssue({
        code: "custom",
        message: `Valor inválido: "${raw}". Esperado: ${Object.keys(map).join(" | ")}`,
      })
      return z.NEVER
    }
    return found
  })
}

export const createEntrySchema = z.object({
  date: z.string().min(1, "Informe a data"),
  flow: labelEnum(flowMap),
  painIntensity: labelEnum(painMap),
  energy: labelEnum(energyMap),
  sleep: labelEnum(sleepMap),
  mood: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  symptoms: z.array(z.string()).default([]),
})

export const listEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().optional(),
  flow: z.enum(["none", "light", "medium", "heavy"]).optional(),
  painIntensity: z
    .enum(["none", "light", "moderate", "strong", "very_strong"])
    .optional(),
  energy: z.enum(["low", "normal", "high"]).optional(),
  sleep: z.enum(["bad", "regular", "good"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
