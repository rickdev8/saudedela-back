#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/836773f6967b5f3ca49bd11dd0f977cd97dc12d9f5ce89615a1f4fec222fdc06/contract';
import startContract from '../../snapshots/836773f6967b5f3ca49bd11dd0f977cd97dc12d9f5ce89615a1f4fec222fdc06/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9cb9d83126f1a1b71c9dc6cf890ba9d766ea574fcb8ff6c57f4603b18c364a10/contract';
import endContract from '../../snapshots/9cb9d83126f1a1b71c9dc6cf890ba9d766ea574fcb8ff6c57f4603b18c364a10/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'symptom_entries',
        column: col('energy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'symptom_entries',
        column: col('painIntensity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'symptom_entries',
        column: col('sleep', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'symptom_entries',
        constraint: 'symptom_entries_energy_check_ebb709b0',
        expression: "\"energy\" IN ('low', 'normal', 'high')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'symptom_entries',
        constraint: 'symptom_entries_painIntensity_check_0b22c285',
        expression: "\"painIntensity\" IN ('none', 'light', 'moderate', 'strong', 'very_strong')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'symptom_entries',
        constraint: 'symptom_entries_sleep_check_bd08b643',
        expression: "\"sleep\" IN ('bad', 'regular', 'good')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
