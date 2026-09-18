export type TurnPhase = "idle" | "processing" | "tool" | "done" | "error";

export interface TurnSnapshot {
  phase: TurnPhase;
  toolCount: number;
  errorCount: number;
  toolElapsedMs: number;
  turnElapsedMs: number;
}

export interface TurnAccounting {
  reset(): TurnSnapshot;
  startTurn(): TurnSnapshot;
  startTool(toolCallId?: string): TurnSnapshot;
  endTool(toolCallId: string | undefined, isError: boolean): TurnSnapshot;
  endTurn(): TurnSnapshot;
  snapshot(): TurnSnapshot;
}

export interface TurnAccountingOptions {
  now?: () => number;
}

interface ActiveTool {
  startedAt: number;
}

const INITIAL_SNAPSHOT: TurnSnapshot = {
  phase: "idle",
  toolCount: 0,
  errorCount: 0,
  toolElapsedMs: 0,
  turnElapsedMs: 0,
};

const elapsedSince = (startedAt: number | null, now: number): number =>
  startedAt === null ? 0 : Math.max(0, now - startedAt);

export function createTurnAccounting(options: TurnAccountingOptions = {}): TurnAccounting {
  const now = options.now ?? (() => Date.now());
  let phase: TurnPhase = INITIAL_SNAPSHOT.phase;
  let turnStartedAt: number | null = null;
  let turnElapsedMs = INITIAL_SNAPSHOT.turnElapsedMs;
  let toolCount = INITIAL_SNAPSHOT.toolCount;
  let errorCount = INITIAL_SNAPSHOT.errorCount;
  let toolElapsedMs = INITIAL_SNAPSHOT.toolElapsedMs;
  let activeTools = new Map<string, ActiveTool>();
  let anonymousTools: number[] = [];

  const snapshot = (): TurnSnapshot => ({
    phase,
    toolCount,
    errorCount,
    toolElapsedMs,
    turnElapsedMs: turnStartedAt === null ? turnElapsedMs : elapsedSince(turnStartedAt, now()),
  });

  const reset = (): TurnSnapshot => {
    phase = INITIAL_SNAPSHOT.phase;
    turnStartedAt = null;
    turnElapsedMs = INITIAL_SNAPSHOT.turnElapsedMs;
    toolCount = INITIAL_SNAPSHOT.toolCount;
    errorCount = INITIAL_SNAPSHOT.errorCount;
    toolElapsedMs = INITIAL_SNAPSHOT.toolElapsedMs;
    activeTools = new Map();
    anonymousTools = [];
    return snapshot();
  };

  const startTurn = (): TurnSnapshot => {
    reset();
    phase = "processing";
    turnStartedAt = now();
    return snapshot();
  };

  const startTool = (toolCallId?: string): TurnSnapshot => {
    if (turnStartedAt === null) {
      return snapshot();
    }

    const startedAt = now();
    toolCount += 1;
    phase = "tool";
    if (toolCallId) {
      activeTools.set(toolCallId, { startedAt });
    } else {
      anonymousTools.push(startedAt);
    }
    return snapshot();
  };

  const endTool = (toolCallId: string | undefined, isError: boolean): TurnSnapshot => {
    let startedAt: number | undefined;
    if (toolCallId) {
      const activeTool = activeTools.get(toolCallId);
      if (!activeTool) return snapshot();
      startedAt = activeTool.startedAt;
      activeTools.delete(toolCallId);
    } else {
      startedAt = anonymousTools.shift();
      if (startedAt === undefined) return snapshot();
    }

    toolElapsedMs += Math.max(0, now() - startedAt);
    if (isError) errorCount += 1;

    phase = errorCount > 0 && activeTools.size === 0 && anonymousTools.length === 0 ? "error" : "processing";
    if (activeTools.size > 0 || anonymousTools.length > 0) phase = "tool";
    return snapshot();
  };

  const endTurn = (): TurnSnapshot => {
    turnElapsedMs = elapsedSince(turnStartedAt, now());
    phase = errorCount > 0 ? "error" : "done";
    turnStartedAt = null;
    activeTools = new Map();
    anonymousTools = [];
    return snapshot();
  };

  return { reset, startTurn, startTool, endTool, endTurn, snapshot };
}
