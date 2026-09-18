import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createGitSnapshot, type GitStatus } from "./git-snapshot.js";
import { createTurnAccounting } from "./turn-accounting.js";

const renderStatus = (parts: string[]): string => parts.filter(Boolean).join(" ");

function formatGitStatus(status: GitStatus): string {
  const parts = [`git:${status.branch}`];
  if (status.changed > 0) parts.push(`*${status.changed}`);
  if (status.ahead > 0) parts.push(`↑${status.ahead}`);
  if (status.behind > 0) parts.push(`↓${status.behind}`);
  return parts.join(" ");
}

export default function (pi: ExtensionAPI) {
  let gitStatus: GitStatus | null = null;
  const git = createGitSnapshot({
    execute: (command, args, options) => pi.exec(command, args, options),
  });
  const accounting = createTurnAccounting({ now: Date.now });

  const setStatus = (ctx: ExtensionContext, label: string) => {
    ctx.ui?.setStatus("statusline", label);
  };

  const themeText = (ctx: ExtensionContext, color: string, text: string): string =>
    ctx.ui?.theme ? ctx.ui.theme.fg(color as any, text) : text;

  const statusParts = (ctx: ExtensionContext, state: string): string[] => {
    const dot = themeText(ctx, "accent", "●");
    const gitText = gitStatus ? themeText(ctx, "muted", formatGitStatus(gitStatus)) : "";
    return [dot, gitText, state];
  };

  const refreshGit = async (ctx: ExtensionContext): Promise<void> => {
    gitStatus = await git.refresh(ctx.cwd);
  };

  pi.on("session_start", async (_e, ctx) => {
    accounting.reset();
    await refreshGit(ctx);
    setStatus(ctx, renderStatus(statusParts(ctx, themeText(ctx, "dim", "Ready"))));
  });

  pi.on("turn_start", async (_e, ctx) => {
    accounting.startTurn();
    await refreshGit(ctx);
    setStatus(ctx, renderStatus(statusParts(ctx, themeText(ctx, "dim", "Processing..."))));
  });

  pi.on("tool_execution_start", async (ev, ctx) => {
    const snapshot = accounting.startTool(ev.toolCallId);
    const toolMsg = themeText(ctx, "accent", `Running ${ev.toolName} (x${snapshot.toolCount})`);
    setStatus(ctx, renderStatus(statusParts(ctx, toolMsg)));
  });

  pi.on("tool_execution_end", async (ev, _ctx) => {
    accounting.endTool(ev.toolCallId, ev.isError);
  });

  pi.on("turn_end", async (_ev, ctx) => {
    const snapshot = accounting.endTurn();
    await refreshGit(ctx);

    const timeStr = themeText(ctx, "dim", `${(snapshot.turnElapsedMs / 1000).toFixed(2)}s`);
    const stats = `${snapshot.toolCount > 0 ? ` (${snapshot.toolCount})` : ""}${snapshot.errorCount > 0 ? ` errors ${snapshot.errorCount}` : ""}${snapshot.toolCount > 0 ? ` tools ${(snapshot.toolElapsedMs / 1000).toFixed(2)}s` : ""}`;
    const state = snapshot.phase === "error"
      ? themeText(ctx, "error", `Error${stats}`)
      : themeText(ctx, "success", `Done${stats}`);
    const marker = snapshot.phase === "error" ? themeText(ctx, "error", "✗") : themeText(ctx, "success", "✓");
    setStatus(ctx, renderStatus([marker, gitStatus ? themeText(ctx, "muted", formatGitStatus(gitStatus)) : "", state, timeStr]));
  });
}
