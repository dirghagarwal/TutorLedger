/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { PrismaClient } from "@prisma/client";
import { getRequestTeacherId } from "@/lib/auth/session";

const globalForTenantPrisma = globalThis as unknown as {
  tenantPrisma: ReturnType<typeof createTenantPrisma> | undefined;
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

function createTenantPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    name: "tutor-ledger-tenant-scope",
    query: {
      $allModels: {
        async $allOperations(context: any) {
          const { model, operation, args, query } = context;
          if (!ownedModels.has(model)) return query(args);

          const teacherId = await getRequestTeacherId();
          if (!teacherId) throw new Error("UNAUTHENTICATED");

          if (["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy", "update", "delete", "updateMany", "deleteMany"].includes(operation)) {
            args.where = { ...(args.where ?? {}), teacherId };
          } else if (["create", "createMany", "createManyAndReturn"].includes(operation)) {
            args.data = Array.isArray(args.data)
              ? args.data.map((row: Record<string, unknown>) => ({ ...row, teacherId }))
              : { ...(args.data ?? {}), teacherId };
          } else if (operation === "upsert") {
            args.where = { ...(args.where ?? {}), teacherId };
            args.create = { ...(args.create ?? {}), teacherId };
          }

          return query(args);
        },
      },
    },
  });
}

export const tenantPrisma: PrismaClient = (globalForTenantPrisma.tenantPrisma ?? createTenantPrisma()) as unknown as PrismaClient;

// Reuse the tenant-scoped client in warm production runtimes too. The extension
// still resolves the current request's teacher ID per operation, so the singleton
// does not weaken tenant isolation.
globalForTenantPrisma.tenantPrisma = tenantPrisma as unknown as ReturnType<typeof createTenantPrisma>;
