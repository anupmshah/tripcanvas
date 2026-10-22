import { PrismaClient, Prisma } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
export type Db = PrismaClient | Prisma.TransactionClient;

/** PostgreSQL serializable transactions must be retried after a rolled-back conflict. */
export async function retryConflict<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); } catch (e) {
      if ((e as { code?: string }).code !== "P2034" || attempt >= 2) throw e;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}
