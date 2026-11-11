import { readFileSync } from 'node:fs';
import { Client } from 'ssh2';
import type { ConnectConfig } from 'ssh2';
import type { ExecResult, SSHHostConfig } from './types.js';

function toConnectConfig(host: SSHHostConfig): ConnectConfig {
  const base: ConnectConfig = {
    host: host.host,
    port: host.port,
    username: host.user,
    readyTimeout: 15000,
  };

  if (host.privateKeyPath) {
    // Read as PEM string — avoids Buffer/NonSharedBuffer assignability
    // differences across @types/node versions.
    base.privateKey = readFileSync(host.privateKeyPath, 'utf8');
    if (host.passphrase) base.passphrase = host.passphrase;
  } else if (host.password) {
    base.password = host.password;
  }

  return base;
}

export function connect(host: SSHHostConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', (err) => reject(err))
      .connect(toConnectConfig(host));
  });
}

export function execCommand(conn: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;
      stream.on('data', (data: Buffer) => (stdout += data.toString('utf8')));
      stream.stderr.on('data', (data: Buffer) => (stderr += data.toString('utf8')));
      // The 'exit' event carries the real exit code; 'close' only tells us the
      // channel is done. Do NOT chain off stream.stderr here — handlers would
      // attach to the stderr side-stream instead of the exec stream.
      stream.on('exit', (code: number | null) => {
        exitCode = code;
      });
      stream.on('close', () => resolve({ stdout, stderr, exitCode }));
    });
  });
}

export async function withConnection<T>(
  host: SSHHostConfig,
  fn: (conn: Client) => Promise<T>
): Promise<T> {
  const conn = await connect(host);
  try {
    return await fn(conn);
  } finally {
    conn.end();
  }
}

export function sftpUpload(
  conn: Client,
  localPath: string,
  remotePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      sftp.fastPut(localPath, remotePath, (putErr) => {
        if (putErr) reject(putErr);
        else resolve();
      });
    });
  });
}

export function sftpDownload(
  conn: Client,
  remotePath: string,
  localPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      sftp.fastGet(remotePath, localPath, (getErr) => {
        if (getErr) reject(getErr);
        else resolve();
      });
    });
  });
}
