import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 driver-adapter setup. Uses Postgres in every environment —
 * Railway injects DATABASE_URL automatically when you attach a Postgres
 * service. Locally, copy .env.example → .env.
 *
 * The client is lazy-initialized via a Proxy so Next.js can evaluate
 * pages at build time without DATABASE_URL being present (the connection
 * doesn't open until the first real query).
 *
 * Global caching avoids Next.js hot-reload exhausting the connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env or set it on your Railway service."
    );
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

function getOrCreate(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

// Lazy proxy — only creates the client (and validates DATABASE_URL) on
// first property access, not at module import. This lets Next.js's build
// step traverse the file without needing the env var.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getOrCreate(), prop, receiver);
  },
});
