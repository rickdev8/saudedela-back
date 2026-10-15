import 'dotenv/config';
import { Temporal } from '@js-temporal/polyfill';

if (!(globalThis as any).Temporal) {
  (globalThis as any).Temporal = Temporal;
}

import pgvector from '@prisma/orm-extension-pgvector/runtime';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

const url = process.env['DIRECT_URL'];
if (!url) {
  throw new Error('DIRECT_URL não está definida nas variáveis de ambiente');
}

export const db = postgres<Contract>({
  contractJson,
  url,
  extensions: [pgvector],
});

export const runtime = await db.connect();
