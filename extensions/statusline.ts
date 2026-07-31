import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Utility to create a status string with the provided template parts.
const renderStatus = (parts: string[]): string => parts.join(" ");

export default function (pi: ExtensionAPI) {
  let lastTurnTime: number | null = null;
  let toolRuns = 0;
  let hasErrorInTurn = false;

  const setStatus = (ctx: ExtensionContext, label: string) => {
    ctx.ui?.setStatus("statusline", label);
  };

  pi.on("session_start", async (_e, ctx) => {
    toolRuns = 0;
    hasErrorInTurn = false;
    const theme = ctx.ui?.theme;
    const model = ctx.model;
    const modelInfo = model ? `${model.provider}/${model.id}` : "unknown model";
    const level = ctx.thinkingLevel || "?";
    const statusText = theme
      ? theme.fg("dim", `Ready • ${modelInfo} • ${level}`)
      : `Ready • ${modelInfo} • ${level}`;
    setStatus(ctx, renderStatus([statusText]));
  });

  pi.on("turn_start", async (_e, ctx) => {
    lastTurnTime = Date.now();
    toolRuns = 0;
    hasErrorInTurn = false;
    const theme = ctx.ui?.theme;
    const dot = theme ? theme.fg("accent", "●") : "●";
    const cwd = theme ? theme.fg("dim", ctx.cwd) : ctx.cwd;
    const state = theme ? theme.fg("dim", "Processing...") : "Processing...";
    setStatus(ctx, renderStatus([dot, cwd, state]));
  });

  pi.on("tool_execution_start", async (ev, ctx) => {
    toolRuns += 1;
    const theme = ctx.ui?.theme;
    const dot = theme ? theme.fg("accent", "●") : "●";
    const cwd = theme ? theme.fg("dim", ctx.cwd) : ctx.cwd;
    const toolMsg = theme
      ? theme.fg("accent", `Running ${ev.toolName} (x${toolRuns})`)
      : `Running ${ev.toolName} (x${toolRuns})`;
    setStatus(ctx, renderStatus([dot, cwd, toolMsg]));
  });

  pi.on("tool_execution_end", async (ev, ctx) => {
    if (ev.isError) {
      hasErrorInTurn = true;
    }
  });

  pi.on("turn_end", async (_e, ctx) => {
    const elapsed = lastTurnTime ? (Date.now() - lastTurnTime) / 1000 : 0;
    const toolsUsed = toolRuns;
    toolRuns = 0;
    const theme = ctx.ui?.theme;
    const cwd = theme ? theme.fg("dim", ctx.cwd) : ctx.cwd;
    const timeStr = theme ? theme.fg("dim", `${elapsed.toFixed(2)}s`) : `${elapsed.toFixed(2)}s`;

    if (hasErrorInTurn) {
      const cross = theme ? theme.fg("error", "✗") : "✗";
      const errState = theme
        ? theme.fg("error", `Error${toolsUsed > 0 ? ` (${toolsUsed})` : ""}`)
        : `Error${toolsUsed > 0 ? ` (${toolsUsed})` : ""}`;
      setStatus(ctx, renderStatus([cross, cwd, errState, timeStr]));
    } else {
      const check = theme ? theme.fg("success", "✓") : "✓";
      const doneState = theme
        ? theme.fg("success", `Done${toolsUsed > 0 ? ` (${toolsUsed})` : ""}`)
        : `Done${toolsUsed > 0 ? ` (${toolsUsed})` : ""}`;
      setStatus(ctx, renderStatus([check, cwd, doneState, timeStr]));
    }
  });
}
