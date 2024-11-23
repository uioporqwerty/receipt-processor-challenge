import Fastify from "fastify";

export function buildServer() {
  const fastify = Fastify({ logger: true });

  fastify.get("/health", async (request, reply) => {
    return { status: "ok" };
  });

  return fastify;
}

const start = async () => {
  const fastify = buildServer();
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`Server listening on http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
