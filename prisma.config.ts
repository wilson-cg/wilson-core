import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration. The datasource URL is read from DATABASE_URL
 * at runtime — Railway injects this automatically when a Postgres service
 * is linked to the app. Locally, set it via .env (see .env.example).
 *
 * See: https://pris.ly/d/config-datasource
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
