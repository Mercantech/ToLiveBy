import { sql, and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { quotes } from "../db/schema.js";
import type { QuoteCategory } from "../types.js";
import { toQuotePublic } from "../types.js";

const categorySchema = z.enum(["general", "stoicism", "motivation", "discipline"]);

const createBodySchema = z.object({
  body: z.string().min(1),
  author: z.string().nullable().optional(),
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const patchBodySchema = createBodySchema.partial();

const MAX_BATCH = 100;

const batchBodySchema = z.object({
  quotes: z
    .array(createBodySchema)
    .min(1, { message: "At least one quote is required" })
    .max(MAX_BATCH, { message: `At most ${MAX_BATCH} quotes per request` }),
});

function parseCategory(q: unknown): QuoteCategory | undefined {
  if (q === undefined || q === "") return undefined;
  const r = categorySchema.safeParse(q);
  return r.success ? r.data : undefined;
}

export async function quoteRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { category?: string } }>(
    "/v1/quotes/random",
    async (request, reply) => {
      const category = parseCategory(request.query.category);
      const conditions = [eq(quotes.isActive, true)];
      if (category) {
        conditions.push(eq(quotes.category, category));
      }

      const rows = await db
        .select()
        .from(quotes)
        .where(and(...conditions))
        .orderBy(sql`random()`)
        .limit(1);

      const row = rows[0];
      if (!row) {
        return reply.code(404).send({
          error: "No quotes found",
          code: "QUOTE_NOT_FOUND",
        });
      }

      return { quote: toQuotePublic(row) };
    },
  );

  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      category?: string;
      includeInactive?: string;
    };
  }>("/v1/quotes", async (request, reply) => {
    const page = Math.max(1, Number(request.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 20) || 20));
    const offset = (page - 1) * limit;
    const category = parseCategory(request.query.category);
    const includeInactive =
      request.query.includeInactive === "true" ||
      request.query.includeInactive === "1";

    if (includeInactive) {
      await app.requireAdmin(request, reply);
      if (reply.sent || reply.raw.headersSent) {
        return;
      }
    }

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(quotes.isActive, true));
    }
    if (category) {
      conditions.push(eq(quotes.category, category));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const countRows = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(quotes)
      .where(whereClause);
    const total = countRows[0]?.total ?? 0;

    const rows = await db
      .select()
      .from(quotes)
      .where(whereClause)
      .orderBy(desc(quotes.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      quotes: rows.map((r) => ({
        ...toQuotePublic(r),
        isActive: r.isActive,
      })),
      page,
      limit,
      total,
    };
  });

  app.post<{ Body: unknown }>(
    "/v1/quotes",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid body",
          details: parsed.error.flatten(),
        });
      }

      const body = parsed.data;
      const inserted = await db
        .insert(quotes)
        .values({
          body: body.body,
          author: body.author ?? null,
          category: body.category ?? "general",
          tags: body.tags ?? [],
          isActive: body.isActive ?? true,
        })
        .returning();

      const row = inserted[0];
      if (!row) {
        return reply.code(500).send({ error: "Insert failed" });
      }

      return reply.code(201).send({
        quote: { ...toQuotePublic(row), isActive: row.isActive },
      });
    },
  );

  app.post<{ Body: unknown }>(
    "/v1/quotes/batch",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const parsed = batchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid body",
          details: parsed.error.flatten(),
        });
      }

      const items = parsed.data.quotes;
      const values = items.map((q) => ({
        body: q.body,
        author: q.author ?? null,
        category: q.category ?? "general",
        tags: q.tags ?? [],
        isActive: q.isActive ?? true,
      }));

      try {
        const inserted = await db.transaction(async (tx) => {
          return await tx.insert(quotes).values(values).returning();
        });

        return reply.code(201).send({
          count: inserted.length,
          quotes: inserted.map((row) => ({
            ...toQuotePublic(row),
            isActive: row.isActive,
          })),
        });
      } catch (e) {
        app.log.error(e, "batch insert failed");
        return reply.code(500).send({
          error: "Batch insert failed",
          code: "BATCH_INSERT_FAILED",
        });
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/v1/quotes/:id",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const id = request.params.id;
      const parsed = patchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid body",
          details: parsed.error.flatten(),
        });
      }

      const patch = parsed.data;
      const updates: Partial<typeof quotes.$inferInsert> = {};
      if (patch.body !== undefined) updates.body = patch.body;
      if (patch.author !== undefined) updates.author = patch.author;
      if (patch.category !== undefined) updates.category = patch.category;
      if (patch.tags !== undefined) updates.tags = patch.tags;
      if (patch.isActive !== undefined) updates.isActive = patch.isActive;

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await db
        .update(quotes)
        .set(updates)
        .where(eq(quotes.id, id))
        .returning();

      const row = updated[0];
      if (!row) {
        return reply.code(404).send({ error: "Quote not found" });
      }

      return {
        quote: { ...toQuotePublic(row), isActive: row.isActive },
      };
    },
  );

  app.delete<{ Params: { id: string }; Querystring: { hard?: string } }>(
    "/v1/quotes/:id",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const id = request.params.id;
      const hard =
        request.query.hard === "true" || request.query.hard === "1";

      if (hard) {
        const deleted = await db
          .delete(quotes)
          .where(eq(quotes.id, id))
          .returning({ id: quotes.id });
        if (!deleted.length) {
          return reply.code(404).send({ error: "Quote not found" });
        }
        return reply.code(204).send();
      }

      const updated = await db
        .update(quotes)
        .set({ isActive: false })
        .where(eq(quotes.id, id))
        .returning();

      if (!updated[0]) {
        return reply.code(404).send({ error: "Quote not found" });
      }

      return {
        quote: {
          ...toQuotePublic(updated[0]),
          isActive: updated[0].isActive,
        },
      };
    },
  );
}
