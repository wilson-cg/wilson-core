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

// Module-level cache — guarantees one client per process in production
// (Next.js dev's HMR is what globalForPrisma protects against).
let _client: PrismaClient | undefined;

function getOrCreate(): PrismaClient {
  if (_client) return _client;
  if (globalForPrisma.prisma) {
    _client = globalForPrisma.prisma;
    return _client;
  }
  _client = createPrisma();
  // Cache in BOTH production and dev. Without this, every property access
  // through the Proxy below would spawn a fresh PrismaClient (and a fresh
  // pg Pool). That breaks $transaction with P2028 "Transaction not found"
  // because the transaction is opened on one client but internal state
  // checks land on a different client. Connection-pool exhaustion is the
  // other symptom.
  globalForPrisma.prisma = _client;
  return _client;
}

// Lazy proxy — only creates the client (and validates DATABASE_URL) on
// first property access, not at module import. This lets Next.js's build
// step traverse the file without needing the env var. After the first
// access, every call returns the same cached PrismaClient.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getOrCreate();
    const value = Reflect.get(client, prop);
    // Bind methods to the real client so `this` is correct inside Prisma
    // (especially for $transaction, which captures `this` for engine state).
    return typeof value === "function" ? value.bind(client) : value;
  },
});
