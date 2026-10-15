#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5b89678f6e9a5e59f49a89e71e45f2ea21cd4b77b41cfa60b3aab2e05f98c5bc/contract';
import endContract from '../../snapshots/5b89678f6e9a5e59f49a89e71e45f2ea21cd4b77b41cfa60b3aab2e05f98c5bc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2ba61d04e022f35bff0d1788d0636ccf92c13f3f596683e7ec8edfd297bac787/contract';
import startContract from '../../snapshots/2ba61d04e022f35bff0d1788d0636ccf92c13f3f596683e7ec8edfd297bac787/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'cycle_patterns',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('daysSelected', 'int4[]', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1', many: true },
          }),
          col('durationDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('regularity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cycle_patterns_daysSelected_elem_not_null_525a5f89',
            'array_position("daysSelected", NULL) IS NULL',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cycle_patterns',
        constraint: 'cycle_patterns_userId_key',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cycle_patterns',
        foreignKey: {
          name: 'cycle_patterns_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
