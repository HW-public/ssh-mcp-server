export interface SSHHostConfig {
  name: string;
  host: string;
  port: number;
  user: string;
  /** Password authentication. Mutually exclusive with privateKeyPath. */
  password?: string;
  /** Absolute path to a private key file. Mutually exclusive with password. */
  privateKeyPath?: string;
  /** Passphrase of the private key, if any. */
  passphrase?: string;
}

/** Shape returned by list_hosts — never includes secrets. */
export interface HostInfo {
  name: string;
  host: string;
  port: number;
  user: string;
  auth: 'password' | 'privateKey';
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
