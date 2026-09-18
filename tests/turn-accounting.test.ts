import { describe, expect, test } from "bun:test";
import { createTurnAccounting } from "../extensions/turn-accounting.js";

function createFakeClock() {
  let current = 0;
  return {
    now: () => current,
    advance(milliseconds: number) {
      current += milliseconds;
    },
  };
}

describe("turn accounting", () => {
  test("tracks one turn and its tool statistics through a snapshot", () => {
    const clock = createFakeClock();
    const accounting = createTurnAccounting({ now: clock.now });

    expect(accounting.startTurn()).toMatchObject({ phase: "processing", toolCount: 0 });
    clock.advance(250);
    expect(accounting.startTool("read")).toMatchObject({ phase: "tool", toolCount: 1 });
    clock.advance(1250);
    expect(accounting.endTool("read", false)).toMatchObject({
      phase: "processing",
      toolCount: 1,
      errorCount: 0,
      toolElapsedMs: 1250,
    });

    clock.advance(500);
    expect(accounting.endTurn()).toEqual({
      phase: "done",
      toolCount: 1,
      errorCount: 0,
      toolElapsedMs: 1250,
      turnElapsedMs: 2000,
    });
  });

  test("sums independent tool durations when tools overlap", () => {
    const clock = createFakeClock();
    const accounting = createTurnAccounting({ now: clock.now });
    accounting.startTurn();

    accounting.startTool("a");
    clock.advance(100);
    accounting.startTool("b");
    clock.advance(300);
    accounting.endTool("b", false);
    clock.advance(100);
    accounting.endTool("a", false);

    expect(accounting.endTurn()).toMatchObject({
      phase: "done",
      toolCount: 2,
      toolElapsedMs: 800,
    });
  });

  test("records errors and fails soft for unmatched tool events", () => {
    const clock = createFakeClock();
    const accounting = createTurnAccounting({ now: clock.now });
    accounting.startTurn();

    expect(accounting.endTool("missing", true)).toMatchObject({ errorCount: 0, toolElapsedMs: 0 });
    accounting.startTool("known");
    clock.advance(50);
    accounting.endTool("known", true);

    expect(accounting.endTurn()).toMatchObject({ phase: "error", errorCount: 1, toolElapsedMs: 50 });
  });

  test("cleans unfinished tools at turn end", () => {
    const clock = createFakeClock();
    const accounting = createTurnAccounting({ now: clock.now });
    accounting.startTurn();
    accounting.startTool("unfinished");
    clock.advance(100);

    expect(accounting.endTurn()).toMatchObject({ phase: "done", toolCount: 1, toolElapsedMs: 0 });
    expect(accounting.snapshot().phase).toBe("done");
  });
});
