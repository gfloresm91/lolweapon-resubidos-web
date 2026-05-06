import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

export function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DATA_SOURCE=postgres.");
  }

  if (!globalForPrisma.__lolweaponPrisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    globalForPrisma.__lolweaponPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.__lolweaponPrisma;
}
