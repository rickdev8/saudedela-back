#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/08e3cbb9ed524e273ba5da7f3e8ed00aa80e41ef165219ab8d848efa06a0fec5/contract';
import endContract from '../../snapshots/08e3cbb9ed524e273ba5da7f3e8ed00aa80e41ef165219ab8d848efa06a0fec5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f2b4d24572a589ff1ad08bdbb96db739e3bbe81d7c06c8d723246e0a43d9a848/contract';
import startContract from '../../snapshots/f2b4d24572a589ff1ad08bdbb96db739e3bbe81d7c06c8d723246e0a43d9a848/contract.json' with { type: 'json' };
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
        table: 'health_assessments',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('digestionSymptoms', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('energyLevel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('gynecologicalSymptoms', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('medications', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('moodChanges', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('otherNotes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('painLevel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('physicalSymptoms', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('recentBodyChanges', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('skinHairChanges', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('sleepQuality', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('urinarySymptoms', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'health_assessments_digestionSymptoms_elem_not_null_810e3000',
            'array_position("digestionSymptoms", NULL) IS NULL',
          ),
          checkExpression(
            'health_assessments_energyLevel_check_6e58d49d',
            "\"energyLevel\" IN ('low', 'normal', 'high')",
          ),
          checkExpression(
            'health_assessments_gynecologicalSymptoms_elem_not_null_985f1da4',
            'array_position("gynecologicalSymptoms", NULL) IS NULL',
          ),
          checkExpression(
            'health_assessments_moodChanges_elem_not_null_16682199',
            'array_position("moodChanges", NULL) IS NULL',
          ),
          checkExpression(
            'health_assessments_painLevel_check_54dca2c8',
            "\"painLevel\" IN ('none', 'light', 'moderate', 'strong', 'very_strong')",
          ),
          checkExpression(
            'health_assessments_physicalSymptoms_elem_not_null_02b013e7',
            'array_position("physicalSymptoms", NULL) IS NULL',
          ),
          checkExpression(
            'health_assessments_skinHairChanges_elem_not_null_44039bba',
            'array_position("skinHairChanges", NULL) IS NULL',
          ),
          checkExpression(
            'health_assessments_sleepQuality_check_1483a124',
            "\"sleepQuality\" IN ('bad', 'regular', 'good')",
          ),
          checkExpression(
            'health_assessments_urinarySymptoms_elem_not_null_85910797',
            'array_position("urinarySymptoms", NULL) IS NULL',
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'health_assessments',
        index: 'health_assessments_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'health_assessments',
        index: 'health_assessments_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'health_assessments',
        foreignKey: {
          name: 'health_assessments_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
