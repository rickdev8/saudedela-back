import { z } from "zod"

const painLabelToValue = {
    "Nenhuma": "none", "Leve": "light", "Moderada": "moderate", "Forte": "strong", "Muito forte": "very_strong",
} as const

const energyLabelToValue = {
    "Baixa": "low", "Normal": "normal", "Alta": "high",
} as const

const sleepLabelToValue = {
    "Ruim": "bad", "Regular": "regular", "Bom": "good",
} as const

export const createAssessmentSchema = z.object({
    physicalSymptoms: z.array(z.string()).default([]),
    painLevel: z.enum(["Nenhuma", "Leve", "Moderada", "Forte", "Muito forte"]).nullable().default(null)
        .transform((v) => (v ? painLabelToValue[v] : null)),
    energyLevel: z.enum(["Baixa", "Normal", "Alta"]).nullable().default(null)
        .transform((v) => (v ? energyLabelToValue[v] : null)),
    sleepQuality: z.enum(["Ruim", "Regular", "Bom"]).nullable().default(null)
        .transform((v) => (v ? sleepLabelToValue[v] : null)),
    digestionSymptoms: z.array(z.string()).default([]),
    urinarySymptoms: z.array(z.string()).default([]),
    gynecologicalSymptoms: z.array(z.string()).default([]),
    moodChanges: z.array(z.string()).default([]),
    skinHairChanges: z.array(z.string()).default([]),
    recentBodyChanges: z.string().nullable().default(null),
    medications: z.string().nullable().default(null),
    otherNotes: z.string().nullable().default(null),
})