import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { Config } from './config.js';
import { connect } from './ssh/client.js';
import {
  HostRegistry,
  validateAndBuildHost,
  type AddHostInput,
} from './ssh/registry.js';
import type { SSHHostConfig } from './ssh/types.js';
import { downloadFile, runCommand, uploadFile } from './tools/index.js';

const HOST_DESCRIPTION =
  'Name of the SSH host to use (see list_hosts). ' +
  'Defaults to the configured default host, if only one is configured.';

const executeCommandTool: Tool = {
  name: 'execute_command',
  description: 'Execute a command on a remote host over SSH.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      host: {
        type: 'string',
        description: HOST_DESCRIPTION,
      },
    },
    required: ['command'],
  },
};

const uploadFileTool: Tool = {
  name: 'upload_file',
  description: 'Upload a local file to a remote host over SFTP.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      local_path: {
        type: 'string',
        description: 'Absolute path of the local file, e.g. "C:\\tmp\\a.txt".',
      },
      remote_path: {
        type: 'string',
        description: 'Absolute target path on the remote host, e.g. "/tmp/a.txt".',
      },
      host: {
        type: 'string',
        description: HOST_DESCRIPTION,
      },
    },
    required: ['local_path', 'remote_path'],
  },
};

const downloadFileTool: Tool = {
  name: 'download_file',
  description: 'Download a file from a remote host over SFTP.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      remote_path: {
        type: 'string',
        description: 'Absolute path of the file on the remote host.',
      },
      local_path: {
        type: 'string',
        description: 'Absolute path to save the file locally, e.g. "C:\\tmp\\a.txt".',
      },
      host: {
        type: 'string',
        description: HOST_DESCRIPTION,
      },
    },
    required: ['remote_path', 'local_path'],
  },
};

const addHostTool: Tool = {
  name: 'add_host',
  description:
    'Connect to an additional SSH host at runtime — no server restart needed. ' +
    'The new host can then be used via the host parameter of all other tools. ' +
    'Note: credentials passed here are visible in session logs; prefer environment variables for permanent hosts.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Unique name for the new host, e.g. "h3c-ubuntu" or "aliyun-prod".',
      },
      host: {
        type: 'string',
        description: 'Hostname or IP address.',
      },
      user: {
        type: 'string',
        description: 'SSH username. Required.',
      },
      port: {
        type: 'number',
        description: 'SSH port. Default: 22.',
      },
      password: {
        type: 'string',
        description: 'Password for password authentication. Mutually exclusive with private_key_path.',
      },
      private_key_path: {
        type: 'string',
        description: 'Absolute path to a private key file, e.g. "C:\\Users\\you\\.ssh\\id_ed25519".',
      },
      passphrase: {
        type: 'string',
        description: 'Passphrase of the private key, if any.',
      },
    },
    required: ['name', 'host', 'user'],
  },
};

const listHostsTool: Tool = {
  name: 'list_hosts',
  description: 'List all configured SSH hosts (never includes passwords).',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

// Declared as individually-typed constants rather than one annotated array
// literal: some TS versions infer a union of object types for the literal and
// fail to assign it to Tool[].
const tools: Tool[] = [
  executeCommandTool,
  uploadFileTool,
  downloadFileTool,
  addHostTool,
  listHostsTool,
];

export function createServer(config: Config, registry: HostRegistry): Server {
  const server = new Server(
    {
      name: 'ssh-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  function availableHosts(): string {
    return registry.names().join(', ') || '(none)';
  }

  function resolveHost(host?: string): SSHHostConfig {
    const name = host ?? config.defaultHostName;

    if (!name) {
      throw new Error(`host is required. Available hosts: ${availableHosts()}`);
    }

    const target = registry.get(name);
    if (!target) {
      throw new Error(
        `Host '${name}' is not configured. Available hosts: ${availableHosts()}`
      );
    }

    return target;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const hostArg = args?.host as string | undefined;

    try {
      let content: string;

      switch (name) {
        case 'execute_command': {
          const target = resolveHost(hostArg);
          content = await runCommand(target, args?.command as string);
          break;
        }
        case 'upload_file': {
          const target = resolveHost(hostArg);
          content = await uploadFile(
            target,
            args?.local_path as string,
            args?.remote_path as string
          );
          break;
        }
        case 'download_file': {
          const target = resolveHost(hostArg);
          content = await downloadFile(
            target,
            args?.remote_path as string,
            args?.local_path as string
          );
          break;
        }
        case 'add_host': {
          const input: AddHostInput = {
            name: args?.name as string,
            host: args?.host as string,
            user: args?.user as string,
            port: typeof args?.port === 'number' ? args.port : undefined,
            password: args?.password as string | undefined,
            privateKeyPath: args?.private_key_path as string | undefined,
            passphrase: args?.passphrase as string | undefined,
          };
          const built = validateAndBuildHost(input);
          // Verify connectivity before registering, so list_hosts only shows working hosts.
          await connect(built);
          registry.add(built);
          console.error(`Host '${built.name}' (${built.host}:${built.port}) connected`);
          content = JSON.stringify(
            {
              name: built.name,
              host: built.host,
              port: built.port,
              user: built.user,
              auth: built.privateKeyPath ? 'privateKey' : 'password',
              message: 'Connected successfully',
            },
            null,
            2
          );
          break;
        }
        case 'list_hosts': {
          content = JSON.stringify(registry.list(), null, 2);
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
