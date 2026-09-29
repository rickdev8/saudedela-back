import 'dotenv/config';
import { Temporal } from '@js-temporal/polyfill';

if (!(globalThis as any).Temporal) {
  (globalThis as any).Temporal = Temporal;
}

import pgvector from '@prisma/orm-extension-pgvector/runtime';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  extensions: [pgvector],
});

export const runtime = await db.connect();