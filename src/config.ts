import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import type { SSHHostConfig } from './ssh/types.js';

export interface Config {
  defaultHostName?: string;
  defaultHost?: SSHHostConfig;
}

// Load .env found next to (or above) this file, so the bundled single-file
// release works regardless of the current working directory. Real environment
// variables always win over .env (dotenv default: no override).
function loadDotEnvUpwards(): void {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) {
      loadEnv({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  loadEnv();
}

loadDotEnvUpwards();

export function loadConfig(): Config {
  const host = process.env.SSH_DEFAULT_HOST;
  if (!host) {
    return {};
  }

  const user = process.env.SSH_DEFAULT_USER;
  if (!user) {
    throw new Error('SSH_DEFAULT_USER is required when SSH_DEFAULT_HOST is set');
  }

  const port = Number(process.env.SSH_DEFAULT_PORT || 22);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid SSH_DEFAULT_PORT: ${process.env.SSH_DEFAULT_PORT}`);
  }

  const privateKeyPath = process.env.SSH_DEFAULT_PRIVATE_KEY_PATH;
  if (privateKeyPath && !existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${privateKeyPath}`);
  }

  return {
    defaultHostName: process.env.SSH_DEFAULT_NAME || 'default',
    defaultHost: {
      name: process.env.SSH_DEFAULT_NAME || 'default',
      host,
      port,
      user,
      password: process.env.SSH_DEFAULT_PASSWORD || undefined,
      privateKeyPath: privateKeyPath || undefined,
      passphrase: process.env.SSH_DEFAULT_PASSPHRASE || undefined,
    },
  };
}
