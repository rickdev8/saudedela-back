import { db } from "../prisma/db"

const painRank: Record<string, number> = { none: 0, light: 1, moderate: 2, strong: 3, very_strong: 4 }
const energyRank: Record<string, number> = { low: 1, normal: 3, high: 5 }
const sleepRank: Record<string, number> = { bad: 1, regular: 3, good: 5 }
const positiveMoods = ["Feliz", "Normal"]

const flowLabels: Record<string, string> = {
  none: "Sem fluxo",
  light: "Leve",
  medium: "Moderado",
  heavy: "Intenso",
}

function toDateKey(date: string | Date) {
  return new Date(date).toISOString().split("T")[0]
}

function getWeekdayLabel(date: string | Date) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  return days[new Date(date).getDay()]
}

export async function getDashboardData(userId: string, monthRef?: string) {
  const now = new Date()
  const referenceMonth = monthRef ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [year, month] = referenceMonth.split("-").map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)

  const allEntries = await db.orm.public.SymptomEntry
    .where({ userId })
    .orderBy((m) => m.date.desc())
    .limit(200)
    .all()

  const monthEntries = allEntries.filter((e: any) => {
    const d = new Date(e.date)
    return d >= monthStart && d <= monthEnd
  })

  // ---------- 1. Humor ao longo dos últimos 7 dias ----------
  const last7 = allEntries
    .filter((e: any) => new Date(e.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const moodTimeline = last7.map((e: any) => ({
    day: new Date(e.date).getDate().toString(),
    mood: e.mood ?? "Normal",
  }))

  // ---------- 2. Sintomas mais frequentes no mês ----------
  const symptomCounts: Record<string, number> = {}
  monthEntries.forEach((e: any) => {
    for (const s of e.symptoms ?? []) symptomCounts[s] = (symptomCounts[s] ?? 0) + 1
  })
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, days]) => ({ label, days }))

  // ---------- 3. Indicadores médios do mês ----------
  const withEnergy = monthEntries.filter((e: any) => e.energy)
  const withSleep = monthEntries.filter((e: any) => e.sleep)
  const withMood = monthEntries.filter((e: any) => e.mood)
  const withPain = monthEntries.filter((e: any) => e.painIntensity)

  const avgEnergy = withEnergy.length
    ? withEnergy.reduce((sum: number, e: any) => sum + (energyRank[e.energy] ?? 3), 0) / withEnergy.length
    : 0
  const avgSleep = withSleep.length
    ? withSleep.reduce((sum: number, e: any) => sum + (sleepRank[e.sleep] ?? 3), 0) / withSleep.length
    : 0
  const positiveMoodCount = withMood.filter((e: any) => positiveMoods.includes(e.mood)).length
  const positiveMoodScore = withMood.length ? Math.round((positiveMoodCount / withMood.length) * 5) : 0
  const painDaysCount = withPain.filter((e: any) => e.painIntensity !== "none").length

  const indicators = [
    { label: "Energia", value: Math.round(avgEnergy * 10) / 10, max: 5 },
    { label: "Sono", value: Math.round(avgSleep * 10) / 10, max: 5 },
    { label: "Humor positivo", value: positiveMoodScore, max: 5 },
    { label: "Dor (dias com registro)", value: painDaysCount, max: monthEntries.length || 1 },
  ]

  // ---------- 4. Fluxo menstrual: contagem de dias por intensidade ----------
  const flowCounts: Record<string, number> = { none: 0, light: 0, medium: 0, heavy: 0 }
  monthEntries.forEach((e: any) => {
    if (e.flow) flowCounts[e.flow] = (flowCounts[e.flow] ?? 0) + 1
  })
  const flowLevels = Object.entries(flowCounts).map(([key, value]) => ({
    label: flowLabels[key] ?? key,
    value,
  }))

  // ---------- 5. Heatmap de intensidade (nº de sintomas por dia) ----------
  const calendarData = monthEntries.map((e: any) => [
    toDateKey(e.date),
    (e.symptoms ?? []).length,
  ])

  return {
    referenceMonth,
    totalRegistros: monthEntries.length,
    moodTimeline,
    topSymptoms,
    indicators,
    flowLevels,
    calendarData,
  }
}