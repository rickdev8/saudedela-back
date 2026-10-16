import { db } from "../prisma/db"

export type FlowLevel = "none" | "light" | "medium" | "heavy"

export type PainIntensity =
  | "none"
  | "light"
  | "moderate"
  | "strong"
  | "very_strong"

export type EnergyLevel = "low" | "normal" | "high"

export type SleepQuality = "bad" | "regular" | "good"

export type SymptomEntry = {
  id: string
  date: string
  flow: FlowLevel | null
  painIntensity: PainIntensity | null
  energy: EnergyLevel | null
  sleep: SleepQuality | null
  mood: string | null
  notes: string | null
  symptoms: string[]
  createdAt: string
}

const flowLabels: Record<string, string> = {
  none: "Sem fluxo",
  light: "Leve",
  medium: "Moderado",
  heavy: "Intenso",
}

const painLabels: Record<string, string> = {
  none: "Nenhuma",
  light: "Leve",
  moderate: "Moderada",
  strong: "Forte",
  very_strong: "Muito forte",
}

const energyLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
}

const sleepLabels: Record<string, string> = {
  bad: "Ruim",
  regular: "Regular",
  good: "Bom",
}

// Minúsculas e sem acentos para facilitar a busca
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export type SymptomEntryInput = Omit<
  SymptomEntry,
  "id" | "createdAt"
>

export async function SymptomService(
  userId: string,
  data: SymptomEntryInput
) {
  // Normaliza os dados de energia antes de salvar.
  // Os valores permitidos pelo banco são:
  // low, normal e high.
  const energyAliases: Record<string, EnergyLevel> = {
    "abaixo do normal": "low",
    baixa: "low",
    low: "low",
    boa: "high",
    alta: "high",
    high: "high",
    normal: "normal",
  }

  const normalizedEnergy =
    data.energy == null
      ? null
      : energyAliases[normalize(data.energy)] ?? data.energy

  if (
    normalizedEnergy !== null &&
    !["low", "normal", "high"].includes(normalizedEnergy)
  ) {
    throw new Error(
      `Nível de energia inválido: ${normalizedEnergy}`
    )
  }

  const symptom = {
    userId,
    date: data.date,
    flow: data.flow,
    painIntensity: data.painIntensity,
    energy: normalizedEnergy,
    sleep: data.sleep,
    mood: data.mood,
    notes: data.notes,
    symptoms: data.symptoms,
  }

  const existing = await db.orm.public.SymptomEntry
    .where({ userId, date: data.date })
    .first()

  if (existing) {
    const updated = await db.orm.public.SymptomEntry
      .where({ id: existing.id })
      .update(symptom)

    return updated
  }

  const created =
    await db.orm.public.SymptomEntry.create(symptom)

  return created
}

type ListEntriesFilters = {
  page?: number
  search?: string
  flow?: string
  painIntensity?: string
  energy?: string
  sleep?: string
  dateFrom?: string
  dateTo?: string
}

const PAGE_SIZE = 10

export async function listSymptomEntries(
  userId: string,
  filters: ListEntriesFilters = {}
) {
  const {
    page = 1,
    search,
    flow,
    painIntensity,
    energy,
    sleep,
    dateFrom,
    dateTo,
  } = filters

  const allEntries = await db.orm.public.SymptomEntry
    .where({ userId })
    .orderBy((m) => m.date.desc())
    .all()

  const searchTokens = search
    ? normalize(search).split(/\s+/).filter(Boolean)
    : []

  const filtered = allEntries.filter((entry: any) => {
    if (flow && entry.flow !== flow) return false

    if (
      painIntensity &&
      entry.painIntensity !== painIntensity
    ) {
      return false
    }

    if (energy && entry.energy !== energy) return false

    if (sleep && entry.sleep !== sleep) return false

    if (
      dateFrom &&
      new Date(entry.date) < new Date(dateFrom)
    ) {
      return false
    }

    if (
      dateTo &&
      new Date(entry.date) > new Date(dateTo)
    ) {
      return false
    }

    if (searchTokens.length > 0) {
      const haystack = normalize(
        [
          entry.mood ?? "",
          entry.notes ?? "",
          entry.flow
            ? flowLabels[entry.flow] ?? entry.flow
            : "",
          entry.painIntensity
            ? painLabels[entry.painIntensity] ??
              entry.painIntensity
            : "",
          entry.energy
            ? energyLabels[entry.energy] ?? entry.energy
            : "",
          entry.sleep
            ? sleepLabels[entry.sleep] ?? entry.sleep
            : "",
          ...(entry.symptoms ?? []),
        ].join(" ")
      )

      // Todas as palavras digitadas precisam aparecer.
      if (
        !searchTokens.every((token) =>
          haystack.includes(token)
        )
      ) {
        return false
      }
    }

    return true
  })

  const totalCount = filtered.length
  const offset = (page - 1) * PAGE_SIZE
  const items = filtered.slice(offset, offset + PAGE_SIZE)

  return {
    entries: items,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages:
        Math.ceil(totalCount / PAGE_SIZE) || 1,
    },
  }
}
