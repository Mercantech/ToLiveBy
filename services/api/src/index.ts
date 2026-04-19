import "dotenv/config";
import cors from "@fastify/cors";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "./db/index.js";
import { registerAdminAuth } from "./plugins/admin-auth.js";
import { quoteRoutes } from "./routes/quotes.js";
import { seedIfEmpty } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

function parseCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw === "*") {
    return true;
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function runMigrations() {
  const migrationsFolder = path.join(__dirname, "..", "drizzle");
  await migrate(db, { migrationsFolder });
}

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: parseCorsOrigins(),
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Admin-Key"],
});

await registerAdminAuth(app);

app.get("/health", async () => ({ status: "ok" }));

await quoteRoutes(app);

await runMigrations();
await seedIfEmpty();

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  await pool.end();
  process.exit(1);
}

const shutdown = async () => {
  try {
    await app.close();
  } finally {
    await pool.end();
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
