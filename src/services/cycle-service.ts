
import { db } from "../prisma/db";

export type DataCycle = {
  durationDays: number;
  daysSelected: number[];
  regularity: string;
};

function calculateFertileWindow(durationDays: number) {
  if (durationDays < 21 || durationDays > 45) {
    return {
      ovulationDay: null,
      fertileDays: [],
      estimated: true,
      basedOn: "cycle-duration",
      message: "Duração do ciclo inválida para esta estimativa.",
    };
  }

  const ovulationDay = durationDays - 14;
  const startDay = Math.max(1, ovulationDay - 5);
  const endDay = Math.min(durationDays, ovulationDay + 1);

  const fertileDays: number[] = [];

  for (let day = startDay; day <= endDay; day++) {
    fertileDays.push(day);
  }

  return {
    ovulationDay,
    fertileDays,
    estimated: true,
    basedOn: "cycle-duration",
  };
}

function formatCycle(pattern: {
  durationDays: number;
  daysSelected: number[];
  regularity: string;
}) {
  return {
    ...pattern,
    fertileWindow: calculateFertileWindow(
      pattern.durationDays,
      pattern.daysSelected,
    ),
  };
}

export async function CycleService(
  userId: string,
  data: DataCycle,
) {
  const existing = await db.orm.public.CyclePattern
    .where({ userId })
    .first();

  const cycle = {
    userId,
    durationDays: data.durationDays,
    daysSelected: data.daysSelected,
    regularity: data.regularity,
  };

  if (existing) {
    await db.orm.public.CyclePattern
      .where({ userId })
      .update(cycle);

    const updated = await getCyclePattern(userId);

    return updated ? formatCycle(updated) : null;
  }

  const created = await db.orm.public.CyclePattern.create(cycle);

  return formatCycle(created);
}

export async function getCyclePattern(userId: string) {
  const pattern = await db.orm.public.CyclePattern
    .where({ userId })
    .first();

  if (!pattern) {
    return null;
  }

  return formatCycle(pattern);
}
