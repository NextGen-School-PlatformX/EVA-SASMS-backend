import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  // In Prisma 7, for Migrate/CLI, we specify it here
  datasource: {
    url: process.env["DATABASE_URL"] || "file:./dev.db",
  },
});
