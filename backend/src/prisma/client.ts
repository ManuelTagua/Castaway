import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

import { PrismaClient } from '@prisma/client';

dotenv.config();

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:root@localhost:5432/castaway_db?schema=public',
});

export const prisma = new PrismaClient({ adapter });
