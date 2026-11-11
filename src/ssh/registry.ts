import type { HostInfo, SSHHostConfig } from './types.js';

export interface AddHostInput {
  name: string;
  host: string;
  user: string;
  port?: number;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export class HostRegistry {
  private hosts = new Map<string, SSHHostConfig>();

  add(config: SSHHostConfig): void {
    this.hosts.set(config.name, config);
  }

  get(name: string): SSHHostConfig | undefined {
    return this.hosts.get(name);
  }

  names(): string[] {
    return [...this.hosts.keys()];
  }

  list(): HostInfo[] {
    return this.names().map((name) => {
      const h = this.hosts.get(name)!;
      return {
        name: h.name,
        host: h.host,
        port: h.port,
        user: h.user,
        auth: h.privateKeyPath ? 'privateKey' : 'password',
      };
    });
  }
}

export function validateAndBuildHost(input: AddHostInput): SSHHostConfig {
  if (!input.name) throw new Error('name is required');
  if (!input.host) throw new Error('host is required');
  if (!input.user) throw new Error('user is required');
  if (input.password && input.privateKeyPath) {
    throw new Error('password and privateKeyPath are mutually exclusive');
  }

  const port = input.port ?? 22;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${input.port}`);
  }

  return {
    name: input.name,
    host: input.host,
    port,
    user: input.user,
    password: input.password || undefined,
    privateKeyPath: input.privateKeyPath || undefined,
    passphrase: input.passphrase || undefined,
  };
}
