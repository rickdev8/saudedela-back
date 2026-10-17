import { db } from "../prisma/db"

export type DataCycle = {
  durationDays: number
  daysSelected: number[]
  regularity: string
  cycleLengthDays: number
}

function calculateFertileWindow(cycleLengthDays: number) {
  if (
    !Number.isInteger(cycleLengthDays) ||
    cycleLengthDays < 21 ||
    cycleLengthDays > 35
  ) {
    throw new Error(
      "A duração do ciclo deve estar entre 21 e 35 dias."
    )
  }

  const ovulationDay = cycleLengthDays - 14

  const fertileDays = Array.from(
    { length: 7 },
    (_, index) => ovulationDay - 5 + index
  )

  return {
    cycleLengthDays,
    ovulationDay,
    fertileDays,
    estimated: true,
    basedOn: "cycle-duration",
    message:
      "Janela fértil estimada com base na duração informada do ciclo.",
  }
}

export async function CycleService(
  userId: string,
  data: DataCycle
) {
  if (
    !Array.isArray(data.daysSelected) ||
    data.daysSelected.some(
      (day) =>
        !Number.isInteger(day) ||
        day < 1 ||
        day > 31
    )
  ) {
    throw new Error("Os dias selecionados são inválidos.")
  }

  const fertileWindow = calculateFertileWindow(
    data.cycleLengthDays
  )

  const existing = await db.orm.public.CyclePattern
    .where({ userId })
    .first()

  const cycle = {
    userId,
    durationDays: data.daysSelected.length,
    daysSelected: data.daysSelected,
    regularity: data.regularity,
    fertileWindow,
  }

  if (existing) {
    return await db.orm.public.CyclePattern
      .where({ userId })
      .update(cycle)
  }

  return await db.orm.public.CyclePattern.create(cycle)
}

export async function getCyclePattern(userId: string) {
  return await db.orm.public.CyclePattern
    .where({ userId })
    .first()
}