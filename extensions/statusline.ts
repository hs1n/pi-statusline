import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Utility to create a status string with the provided template parts.
const renderStatus = (parts: string[]): string => parts.join(" ");

export default function (pi: ExtensionAPI) {
  let lastTurnTime: number | null = null;
  let toolRuns = 0;
  const theme = pi.context?.ui?.theme ?? { fg: (_c,_t)=>'' };

  const set = (label: string) => pi.context?.ui?.setStatus("statusline", `${label} | other | ours`);

  pi.on("session_start", async (_e, ctx) => {
    toolRuns = 0;
    const model = ctx.model;
    const modelInfo = model ? `${model.provider}/${model.id}` : "unknown model";
    const level = ctx.thinkingLevel || "?";
    set(renderStatus([theme.fg("dim", `Ready • ${modelInfo} • ${level}`)]));
  });

  pi.on("turn_start", async (_e, ctx) => {
    lastTurnTime = Date.now();
    toolRuns = 0;
    set(
      renderStatus([
        theme.fg("accent", "●"),
        theme.fg("dim", ctx.cwd),
        theme.fg("dim", "Processing...")
      ])
    );
  });

  pi.on("turn_end", async (_e, ctx) => {
    const elapsed = lastTurnTime ? (Date.now() - lastTurnTime) / 1000 : 0;
    const toolsUsed = toolRuns;
    toolRuns = 0;
    set(
      renderStatus([
        theme.fg("success", "✓"),
        theme.fg("dim", ctx.cwd),
        theme.fg("success", `Done${toolsUsed > 0 ? ` (${toolsUsed})` : ``}`),
        theme.fg("dim", `${elapsed.toFixed(2)}s`)
      ])
    );
  });

  pi.on("tool_execution_start", async (ev, ctx) => {
    toolRuns += 1;
    set(
      renderStatus([
        theme.fg("accent", "●"),
        theme.fg("dim", ctx.cwd),
        theme.fg("accent", `Running ${ev.toolName} (x${toolRuns})`)
      ])
    );
  });

  pi.on("turn_error", async (ev, ctx) => {
    // Capture error during a turn and display a red X with message
    const errMsg = ev.error?.message || String(ev.error) || 'Unknown error';
    set(
      renderStatus([
        theme.fg("error", "✗"),
        theme.fg("dim", ctx.cwd),
        theme.fg("error", `Error: ${errMsg}`)
      ])
    );
  });
}
