#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/08681688c04aca0200abc921aa761e44c6c13f8f4a734db0ba439be1a6e91b8a/contract';
import startContract from '../../snapshots/08681688c04aca0200abc921aa761e44c6c13f8f4a734db0ba439be1a6e91b8a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/16c8ef53b3fa2b24741214711e90e3b95d745f983f60a81bc56580e25999e468/contract';
import endContract from '../../snapshots/16c8ef53b3fa2b24741214711e90e3b95d745f983f60a81bc56580e25999e468/contract.json' with { type: 'json' };
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
