import { db } from "../prisma/db"

export type DataCycle = {
  daysSelected: number[]
  regularity: string
  cycleLengthDays: number
  lastPeriodStart?: string // "YYYY-MM-DD" (1º dia da última menstruação)
}

const MS_PER_DAY = 86_400_000

function parseStartDate(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error("A data de início da última menstruação é inválida.")
  }
  return date
}

// dia 1 do ciclo = primeiro dia da menstruação
function cycleDayToDate(start: Date, cycleDay: number) {
  return new Date(start.getTime() + (cycleDay - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

export function calculateFertility(
  cycleLengthDays: number,
  regularity: string,
  lastPeriodStart?: string
) {
  if (
    !Number.isInteger(cycleLengthDays) ||
    cycleLengthDays < 21 ||
    cycleLengthDays > 35
  ) {
    throw new Error("A duração do ciclo deve estar entre 21 e 35 dias.")
  }

  const start = parseStartDate(lastPeriodStart)

  // Fase lútea ~14 dias: ovulação ~14 dias antes da próxima menstruação
  const ovulationDay = cycleLengthDays - 14

  // Janela fértil: 5 dias antes da ovulação até 1 dia depois (7 dias)
  const fertileDays = Array.from(
    { length: 7 },
    (_, index) => ovulationDay - 5 + index
  )

  const isRegular = regularity?.toLowerCase() === "regular"

  return {
    cycleLengthDays,
    estimated: true,
    basedOn: "cycle-duration",
    confidence: isRegular ? "medium" : "low",
    ovulation: {
      cycleDay: ovulationDay,
      date: start ? cycleDayToDate(start, ovulationDay) : null,
    },
    fertilePeriod: {
      cycleDays: fertileDays,
      startDay: fertileDays[0],
      endDay: fertileDays[fertileDays.length - 1],
      startDate: start ? cycleDayToDate(start, fertileDays[0]) : null,
      endDate: start
        ? cycleDayToDate(start, fertileDays[fertileDays.length - 1])
        : null,
    },
    message:
      "Estimativa baseada na duração informada do ciclo. Não use como método contraceptivo.",
  }
}

function withFertility(pattern: any) {
  if (!pattern.cycleLengthDays) {
    return { ...pattern, ovulation: null, fertilePeriod: null }
  }

  const start = pattern.lastPeriodStart
    ? new Date(pattern.lastPeriodStart).toISOString().slice(0, 10)
    : undefined

  const fertility = calculateFertility(
    pattern.cycleLengthDays,
    pattern.regularity,
    start
  )

  return {
    ...pattern,
    ovulation: fertility.ovulation,
    fertilePeriod: fertility.fertilePeriod,
    confidence: fertility.confidence,
    message: fertility.message,
  }
}

export async function CycleService(userId: string, data: DataCycle) {
  if (
    !Array.isArray(data.daysSelected) ||
    data.daysSelected.length === 0 ||
    data.daysSelected.some(
      (day) => !Number.isInteger(day) || day < 1 || day > 31
    )
  ) {
    throw new Error("Os dias selecionados são inválidos.")
  }

  // valida antes de salvar (lança erro se algo estiver errado)
  calculateFertility(
    data.cycleLengthDays,
    data.regularity,
    data.lastPeriodStart
  )

  const existing = await db.orm.public.CyclePattern.where({ userId }).first()

  const cycle = {
    userId,
    durationDays: data.daysSelected.length,
    daysSelected: data.daysSelected,
    regularity: data.regularity,
    cycleLengthDays: data.cycleLengthDays,
    lastPeriodStart: data.lastPeriodStart
      ? new Date(`${data.lastPeriodStart}T00:00:00Z`)
      : null,
  }

  const saved = existing
    ? await db.orm.public.CyclePattern.where({ userId }).update(cycle)
    : await db.orm.public.CyclePattern.create(cycle)

  return withFertility(saved)
}

export async function getCyclePattern(userId: string) {
  const pattern = await db.orm.public.CyclePattern.where({ userId }).first()
  return pattern ? withFertility(pattern) : null
}