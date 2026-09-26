import { PrismaClient } from "@prisma/client";

const globalForRawPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
};

export const rawPrisma =
  globalForRawPrisma.rawPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse the client in warm Next.js/Vercel runtimes to avoid creating a fresh
// database pool on every serverless invocation.
globalForRawPrisma.rawPrisma = rawPrisma;
