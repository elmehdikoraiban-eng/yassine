import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrisma> };
const writeOperators = ["create", "createMany", "upsert", "connectOrCreate"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWriteWrapper(value: Record<string, unknown>) {
  return writeOperators.some((operator) => operator in value);
}

function tenantizeRecord(record: Record<string, unknown>, cabinetId: string, nested: boolean) {
  const result: Record<string, unknown> = {
    ...record,
    ...(nested ? { cabinet: { connect: { id: cabinetId } } } : { cabinetId }),
  };
  for (const [key, value] of Object.entries(record)) {
    if (isRecord(value) && isWriteWrapper(value)) result[key] = tenantizeWrite(value, cabinetId);
  }
  return result;
}

function tenantizeWrite(value: unknown, cabinetId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => isRecord(item) ? tenantizeRecord(item, cabinetId, true) : item);
  if (!isRecord(value)) return value;

  if (isWriteWrapper(value)) {
    const result = { ...value };
    if ("create" in result) result.create = tenantizeWrite(result.create, cabinetId);
    if ("createMany" in result && isRecord(result.createMany)) {
      result.createMany = { ...result.createMany, data: tenantizeWrite(result.createMany.data, cabinetId) };
    }
    if ("upsert" in result) {
      const upserts = Array.isArray(result.upsert) ? result.upsert : [result.upsert];
      const updated = upserts.map((entry) => isRecord(entry) ? { ...entry, create: isRecord(entry.create) ? tenantizeRecord(entry.create, cabinetId, true) : entry.create } : entry);
      result.upsert = Array.isArray(result.upsert) ? updated : updated[0];
    }
    if ("connectOrCreate" in result) {
      const entries = Array.isArray(result.connectOrCreate) ? result.connectOrCreate : [result.connectOrCreate];
      const updated = entries.map((entry) => isRecord(entry) ? { ...entry, create: isRecord(entry.create) ? tenantizeRecord(entry.create, cabinetId, true) : entry.create } : entry);
      result.connectOrCreate = Array.isArray(result.connectOrCreate) ? updated : updated[0];
    }
    return result;
  }

  return tenantizeRecord(value, cabinetId, true);
}

function createPrisma() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const requestHeaders = await headers();
          const isPlatformAdmin = requestHeaders.get("x-platform-admin") === "1";
          const cabinetId = requestHeaders.get("x-cabinet-id");

          if (isPlatformAdmin) return query(args);
          const scopedArgs = args as Record<string, unknown>;
          if (model === "Cabinet") {
            if (operation === "create" && !cabinetId) return query(args);
            if (!cabinetId) throw new Error("Session de cabinet manquante.");
            if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany"].includes(operation)) {
              scopedArgs.where = { AND: [isRecord(scopedArgs.where) ? scopedArgs.where : {}, { id: cabinetId }] };
            }
            return query(scopedArgs);
          }
          if (!cabinetId) {
            if (model === "User" && operation === "findUnique") return query(args);
            throw new Error("Session de cabinet manquante.");
          }

          if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
            scopedArgs.where = { AND: [isRecord(scopedArgs.where) ? scopedArgs.where : {}, { cabinetId }] };
          }
          if (operation === "create") scopedArgs.data = tenantizeRecord(scopedArgs.data as Record<string, unknown>, cabinetId, false);
          if (operation === "createMany") {
            const manyData = scopedArgs.data;
            scopedArgs.data = Array.isArray(manyData) ? manyData.map((item) => isRecord(item) ? tenantizeRecord(item, cabinetId, false) : item) : isRecord(manyData) ? tenantizeRecord(manyData, cabinetId, false) : manyData;
          }
          if (operation === "upsert" && isRecord(scopedArgs.create)) scopedArgs.create = tenantizeRecord(scopedArgs.create, cabinetId, false);
          return query(scopedArgs);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
