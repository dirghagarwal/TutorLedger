import { PrismaClient } from "@prisma/client";
import { getRequestTeacherId } from "@/lib/auth/session";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createScopedClient> | undefined;
};

const ownedModels = new Set([
  "Student",
  "Schedule",
  "Session",
  "SessionNote",
  "Attachment",
  "Attendance",
  "Payment",
  "PaymentAllocation",
]);

function createScopedClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    name: "tutor-ledger-tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!ownedModels.has(model)) return query(args);

          const teacherId = await getRequestTeacherId();
          if (!teacherId) throw new Error("UNAUTHENTICATED");

          const a = args as Record<string, any>;

          if (["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"].includes(operation)) {
            a.where = { ...(a.where ?? {}), teacherId };
          } else if (["findUnique", "findUniqueOrThrow", "update", "delete"].includes(operation)) {
            a.where = { ...(a.where ?? {}), teacherId };
          } else if (operation === "updateMany" || operation === "deleteMany") {
            a.where = { ...(a.where ?? {}), teacherId };
          } else if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
            if (Array.isArray(a.data)) {
              a.data = a.data.map((row: Record<string, unknown>) => ({ ...row, teacherId }));
            } else {
              a.data = { ...(a.data ?? {}), teacherId };
            }
          } else if (operation === "upsert") {
            a.where = { ...(a.where ?? {}), teacherId };
            a.create = { ...(a.create ?? {}), teacherId };
          }

          return query(a);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createScopedClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
