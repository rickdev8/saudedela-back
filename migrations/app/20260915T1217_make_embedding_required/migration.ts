#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/836773f6967b5f3ca49bd11dd0f977cd97dc12d9f5ce89615a1f4fec222fdc06/contract';
import endContract from '../../snapshots/836773f6967b5f3ca49bd11dd0f977cd97dc12d9f5ce89615a1f4fec222fdc06/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5b89678f6e9a5e59f49a89e71e45f2ea21cd4b77b41cfa60b3aab2e05f98c5bc/contract';
import startContract from '../../snapshots/5b89678f6e9a5e59f49a89e71e45f2ea21cd4b77b41cfa60b3aab2e05f98c5bc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, placeholder } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dataTransform(endContract, 'handle-nulls-knowledge_chunks-embedding', {
        check: () => placeholder('handle-nulls-knowledge_chunks-embedding:check'),
        run: () => placeholder('handle-nulls-knowledge_chunks-embedding:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'knowledge_chunks', column: 'embedding' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
