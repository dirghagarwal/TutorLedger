import { PrismaClient } from "@prisma/client";

const globalForRawPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
};

export const rawPrisma =
  globalForRawPrisma.rawPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForRawPrisma.rawPrisma = rawPrisma;
}
