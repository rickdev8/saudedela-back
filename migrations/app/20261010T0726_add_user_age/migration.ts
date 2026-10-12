#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/08e3cbb9ed524e273ba5da7f3e8ed00aa80e41ef165219ab8d848efa06a0fec5/contract';
import startContract from '../../snapshots/08e3cbb9ed524e273ba5da7f3e8ed00aa80e41ef165219ab8d848efa06a0fec5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/895d8d41f11d11d7367804fb511a1bed7839c886f64fb4ca6e98a657d7ef4ab5/contract';
import endContract from '../../snapshots/895d8d41f11d11d7367804fb511a1bed7839c886f64fb4ca6e98a657d7ef4ab5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('age', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
