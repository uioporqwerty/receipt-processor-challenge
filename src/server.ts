import Fastify from "fastify";

const fastify = Fastify({ logger: true });

fastify.get("/healthcheck", async (request, reply) => {
  return { status: "ok" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`Server listening on http://localhost:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
