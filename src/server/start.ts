import { buildServer } from './app.ts';
import { parseServerConfig } from './config.ts';

async function start(): Promise<void> {
  const config = parseServerConfig(process.env);
  const app = await buildServer({ logger: true });
  await app.listen({
    host: config.host,
    port: config.port,
  });
  app.log.info(
    { host: config.host, port: config.port },
    `Strategy Doctor listening on http://${config.host}:${config.port}`,
  );
}

start().catch(error => {
  console.error('Strategy Doctor failed to start.', error);
  process.exitCode = 1;
});
