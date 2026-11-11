import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { HostRegistry } from './ssh/registry.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const registry = new HostRegistry();

  if (config.defaultHost) {
    registry.add(config.defaultHost);
    console.error(
      `Default host '${config.defaultHost.name}' (${config.defaultHost.host}:${config.defaultHost.port}) configured`
    );
  } else {
    console.error('No default host configured; use add_host to connect at runtime.');
  }

  const server = createServer(config, registry);
  await server.connect(new StdioServerTransport());
  console.error('ssh-mcp-server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
