import { execCommand, sftpDownload, sftpUpload, withConnection } from '../ssh/client.js';
import type { ExecResult, SSHHostConfig } from '../ssh/types.js';

export async function runCommand(
  host: SSHHostConfig,
  command: string
): Promise<string> {
  const result: ExecResult = await withConnection(host, (conn) =>
    execCommand(conn, command)
  );
  return JSON.stringify(result, null, 2);
}

export async function uploadFile(
  host: SSHHostConfig,
  localPath: string,
  remotePath: string
): Promise<string> {
  await withConnection(host, (conn) => sftpUpload(conn, localPath, remotePath));
  return JSON.stringify(
    { localPath, remotePath, host: host.name, message: 'Upload complete' },
    null,
    2
  );
}

export async function downloadFile(
  host: SSHHostConfig,
  remotePath: string,
  localPath: string
): Promise<string> {
  await withConnection(host, (conn) =>
    sftpDownload(conn, remotePath, localPath)
  );
  return JSON.stringify(
    { remotePath, localPath, host: host.name, message: 'Download complete' },
    null,
    2
  );
}
