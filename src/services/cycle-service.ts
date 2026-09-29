import { db } from "../prisma/db"

export type DataCycle = {
  durationDays: number
  daysSelected: number[]
  regularity: string
}

export async function CycleService(userId: string, data: DataCycle) {
  const existing = await db.orm.public.CyclePattern
    .where({ userId })
    .first()

  const cycle = {
    userId,
    durationDays: data.durationDays,
    daysSelected: data.daysSelected,
    regularity: data.regularity,
  }

  if (existing) {
    const updated = await db.orm.public.CyclePattern
      .where({ userId })
      .update(cycle)

    return updated
  }

  const created = await db.orm.public.CyclePattern.create(cycle)
  return created
}

export async function getCyclePattern(userId: string) {
  const pattern = await db.orm.public.CyclePattern
    .where({ userId })
    .first()

  return pattern
}