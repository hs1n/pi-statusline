import { describe, expect, test } from "bun:test";
import { createGitSnapshot, parseGitStatus } from "../extensions/git-snapshot.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function gitResult(stdout: string, overrides: Partial<{ stderr: string; code: number; killed: boolean }> = {}) {
  return {
    stdout,
    stderr: overrides.stderr ?? "",
    code: overrides.code ?? 0,
    killed: overrides.killed ?? false,
  };
}

const mainStatus = "## main...origin/main [ahead 1, behind 2]\n M src/index.ts\n?? notes.md\n";

describe("Git snapshot adapter", () => {
  test("parses branch, working-tree changes, and upstream counts", () => {
    expect(parseGitStatus(mainStatus)).toEqual({
      branch: "main",
      changed: 2,
      ahead: 1,
      behind: 2,
    });
  });

  test("executes the standard Git status command with a timeout", async () => {
    const calls: Array<{ command: string; args: string[]; options: { cwd: string; timeout: number } }> = [];
    const adapter = createGitSnapshot({
      timeoutMs: 750,
      execute: async (command, args, options) => {
        calls.push({ command, args, options });
        return gitResult(mainStatus);
      },
    });

    expect(await adapter.refresh("/repo")).toEqual({ branch: "main", changed: 2, ahead: 1, behind: 2 });
    expect(calls).toEqual([{
      command: "git",
      args: ["status", "--porcelain=v1", "--branch"],
      options: { cwd: "/repo", timeout: 750 },
    }]);
  });

  test("coalesces refreshes for the same cwd", async () => {
    const pending = deferred<ReturnType<typeof gitResult>>();
    let calls = 0;
    const adapter = createGitSnapshot({
      execute: async () => {
        calls += 1;
        return pending.promise;
      },
    });

    const first = adapter.refresh("/repo");
    const second = adapter.refresh("/repo");
    expect(calls).toBe(1);

    pending.resolve(gitResult(mainStatus));
    expect(await first).toEqual(await second);
  });

  test("lets the latest cwd win when refreshes overlap", async () => {
    const oldRequest = deferred<ReturnType<typeof gitResult>>();
    const newRequest = deferred<ReturnType<typeof gitResult>>();
    const adapter = createGitSnapshot({
      execute: async (_command, _args, options) => options.cwd === "/old" ? oldRequest.promise : newRequest.promise,
    });

    const oldResult = adapter.refresh("/old");
    const newResult = adapter.refresh("/new");
    newRequest.resolve(gitResult("## feature...origin/feature\n M app.ts\n"));
    expect(await newResult).toEqual({ branch: "feature", changed: 1, ahead: 0, behind: 0 });

    oldRequest.resolve(gitResult(mainStatus));
    expect(await oldResult).toEqual({ branch: "feature", changed: 1, ahead: 0, behind: 0 });
  });

  test("clears a snapshot for a confirmed non-Git directory", async () => {
    const results = [
      gitResult(mainStatus),
      gitResult("", { code: 128, stderr: "fatal: not a git repository (or any of the parent directories): .git" }),
    ];
    const adapter = createGitSnapshot({ execute: async () => results.shift()! });

    expect(await adapter.refresh("/repo")).not.toBeNull();
    expect(await adapter.refresh("/tmp")).toBeNull();
  });

  test("keeps the last snapshot for timeout and transient failures", async () => {
    const results = [
      gitResult(mainStatus),
      gitResult("", { code: 1, killed: true }),
      gitResult("", { code: 1, stderr: "fatal: temporary Git failure" }),
    ];
    const adapter = createGitSnapshot({ execute: async () => results.shift()! });

    const expected = { branch: "main", changed: 2, ahead: 1, behind: 2 };
    expect(await adapter.refresh("/repo")).toEqual(expected);
    expect(await adapter.refresh("/repo")).toEqual(expected);
    expect(await adapter.refresh("/repo")).toEqual(expected);
  });

  test("keeps the last snapshot when the command cannot start", async () => {
    let shouldThrow = false;
    const adapter = createGitSnapshot({
      execute: async () => {
        if (shouldThrow) throw new Error("spawn failed");
        return gitResult(mainStatus);
      },
    });

    const expected = { branch: "main", changed: 2, ahead: 1, behind: 2 };
    expect(await adapter.refresh("/repo")).toEqual(expected);
    shouldThrow = true;
    expect(await adapter.refresh("/repo")).toEqual(expected);
  });
});
