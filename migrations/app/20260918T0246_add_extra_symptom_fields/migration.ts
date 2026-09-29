#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2e0427897b27a7cecbb51f984b5727b68298eadb8ff826c65ccda648753b7b2f/contract';
import startContract from '../../snapshots/2e0427897b27a7cecbb51f984b5727b68298eadb8ff826c65ccda648753b7b2f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f2b4d24572a589ff1ad08bdbb96db739e3bbe81d7c06c8d723246e0a43d9a848/contract';
import endContract from '../../snapshots/f2b4d24572a589ff1ad08bdbb96db739e3bbe81d7c06c8d723246e0a43d9a848/contract.json' with { type: 'json' };
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
