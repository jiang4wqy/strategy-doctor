import { fileURLToPath } from 'node:url';
import { McpClient } from '../data/mcp-client.ts';
import { refreshSnapshots } from '../data/refresh.ts';

const directory = fileURLToPath(new URL('../../examples/', import.meta.url));
const client = new McpClient({
  endpoint: process.env.MARKET_DATA_MCP_URL
    ?? 'https://datahub.noxiaohao.com/mcp',
  timeoutMs: 30_000,
});

refreshSnapshots(client, directory)
  .then(bundle => {
    console.log(
      `Refreshed five snapshots at ${bundle.technical.observedAt}`,
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Snapshot refresh failed: ${message}`);
    process.exitCode = 1;
  });
