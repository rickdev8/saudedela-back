import { db } from "../prisma/db"

export type FlowLevel = "none" | "light" | "medium" | "heavy"
export type PainIntensity = "none" | "light" | "moderate" | "strong" | "very_strong"
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

export type SymptomEntryInput = Omit<SymptomEntry, "id" | "createdAt">

export async function SymptomService(userId: string, data: SymptomEntryInput) {
  const existing = await db.orm.public.SymptomEntry
    .where({ userId, date: data.date })
    .first()

  const symptom = {
    userId,
    date: data.date,
    flow: data.flow,
    painIntensity: data.painIntensity,
    energy: data.energy,
    sleep: data.sleep,
    mood: data.mood,
    notes: data.notes,
    symptoms: data.symptoms,
  }

  if (existing) {
    const updated = await db.orm.public.SymptomEntry
      .where({ id: existing.id })
      .update(symptom)

    return updated
  }

  const created = await db.orm.public.SymptomEntry.create(symptom)
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

export async function listSymptomEntries(userId: string, filters: ListEntriesFilters = {}) {
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

  const searchTerm = search?.toLowerCase().trim()

  const filtered = allEntries.filter((entry: any) => {
    if (flow && entry.flow !== flow) return false
    if (painIntensity && entry.painIntensity !== painIntensity) return false
    if (energy && entry.energy !== energy) return false
    if (sleep && entry.sleep !== sleep) return false

    if (dateFrom) {
      const entryDate = new Date(entry.date)
      if (entryDate < new Date(dateFrom)) return false
    }
    if (dateTo) {
      const entryDate = new Date(entry.date)
      if (entryDate > new Date(dateTo)) return false
    }

    if (searchTerm) {
      const haystack = [
        entry.mood ?? "",
        entry.notes ?? "",
        ...(entry.symptoms ?? []),
      ]
        .join(" ")
        .toLowerCase()

      if (!haystack.includes(searchTerm)) return false
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
      totalPages: Math.ceil(totalCount / PAGE_SIZE) || 1,
    },
  }
}