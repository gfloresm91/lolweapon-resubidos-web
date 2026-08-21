import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DATA_SOURCE=postgres.");
  }

  if (!globalForPrisma.__lolweaponPrisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: positiveInteger(process.env.DATABASE_POOL_MAX, 12),
      connectionTimeoutMillis: positiveInteger(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 5000),
      idleTimeoutMillis: positiveInteger(process.env.DATABASE_IDLE_TIMEOUT_MS, 30000),
      statement_timeout: positiveInteger(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15000),
      query_timeout: positiveInteger(process.env.DATABASE_QUERY_TIMEOUT_MS, 15000),
      idle_in_transaction_session_timeout: positiveInteger(
        process.env.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
        15000,
      ),
    });
    globalForPrisma.__lolweaponPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.__lolweaponPrisma;
}
