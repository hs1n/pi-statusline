export interface GitStatus {
  branch: string;
  changed: number;
  ahead: number;
  behind: number;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
}

export interface GitCommandOptions {
  cwd: string;
  timeout: number;
}

export type GitCommand = (
  command: string,
  args: string[],
  options: GitCommandOptions,
) => Promise<GitCommandResult>;

export interface GitSnapshotAdapter {
  refresh(cwd: string): Promise<GitStatus | null>;
}

export interface GitSnapshotOptions {
  execute: GitCommand;
  timeoutMs?: number;
}

type RefreshOutcome =
  | { kind: "snapshot"; value: GitStatus }
  | { kind: "none" }
  | { kind: "keep" };

export function parseGitStatus(output: string): GitStatus | null {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const header = lines.find((line) => line.startsWith("## "));
  if (!header) return null;

  const branchPart = header.slice(3).split("...")[0];
  const branch = branchPart || "HEAD (detached)";
  const ahead = Number(header.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(header.match(/behind (\d+)/)?.[1] ?? 0);

  return {
    branch,
    changed: lines.filter((line) => !line.startsWith("## ")).length,
    ahead,
    behind,
  };
}

function isNotGitRepository(result: GitCommandResult): boolean {
  return /not a git repository/i.test(`${result.stderr}\n${result.stdout}`);
}

function classify(result: GitCommandResult): RefreshOutcome {
  if (result.code === 0) {
    const snapshot = parseGitStatus(result.stdout);
    return snapshot ? { kind: "snapshot", value: snapshot } : { kind: "keep" };
  }

  if (!result.killed && isNotGitRepository(result)) return { kind: "none" };
  return { kind: "keep" };
}

export function createGitSnapshot(options: GitSnapshotOptions): GitSnapshotAdapter {
  const timeout = options.timeoutMs ?? 1000;
  let current: GitStatus | null = null;
  let requestId = 0;
  let inFlight: { cwd: string; promise: Promise<GitStatus | null> } | undefined;

  const refresh = (cwd: string): Promise<GitStatus | null> => {
    if (inFlight?.cwd === cwd) return inFlight.promise;

    const thisRequest = ++requestId;
    let commandResult: Promise<GitCommandResult>;
    try {
      commandResult = options.execute("git", ["status", "--porcelain=v1", "--branch"], { cwd, timeout });
    } catch {
      commandResult = Promise.reject(new Error("Git command could not start"));
    }

    let promise: Promise<GitStatus | null>;
    promise = commandResult
      .then((result) => {
        const outcome = classify(result);
        if (thisRequest === requestId) {
          if (outcome.kind === "snapshot") current = outcome.value;
          if (outcome.kind === "none") current = null;
        }
        return current;
      })
      .catch(() => current)
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = undefined;
      });

    inFlight = { cwd, promise };
    return promise;
  };

  return { refresh };
}
