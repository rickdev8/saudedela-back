#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2e0427897b27a7cecbb51f984b5727b68298eadb8ff826c65ccda648753b7b2f/contract';
import endContract from '../../snapshots/2e0427897b27a7cecbb51f984b5727b68298eadb8ff826c65ccda648753b7b2f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5bc4226f3afcba4a111c3801b02f3777418f67ddb871b2f13818e783ef9600e5/contract';
import startContract from '../../snapshots/5bc4226f3afcba4a111c3801b02f3777418f67ddb871b2f13818e783ef9600e5/contract.json' with { type: 'json' };
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
