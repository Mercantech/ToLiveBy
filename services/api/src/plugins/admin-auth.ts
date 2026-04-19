import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    requireAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export async function registerAdminAuth(app: FastifyInstance) {
  const requireAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || expected.length < 8) {
      app.log.error("ADMIN_API_KEY is missing or too short");
      return reply.code(503).send({
        error: "Server misconfiguration",
        code: "ADMIN_NOT_CONFIGURED",
      });
    }

    const headerKey = request.headers["x-admin-key"];
    const key =
      typeof headerKey === "string" ? headerKey : Array.isArray(headerKey) ? headerKey[0] : undefined;

    if (key !== expected) {
      return reply.code(401).send({
        error: "Unauthorized",
        code: "INVALID_ADMIN_KEY",
      });
    }
  };

  app.decorate("requireAdmin", requireAdmin);
}
