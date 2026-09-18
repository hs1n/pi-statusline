import { beforeEach, describe, expect, test } from "bun:test";
import statusline from "../extensions/statusline.js";

interface EventHandlers {
  [eventName: string]: Function[];
}

function createMockExtensionAPI(gitOutput = "") {
  const handlers: EventHandlers = {};
  return {
    handlers,
    on(event: string, handler: Function) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    async emit(event: string, evObj: any, ctx: any) {
      for (const handler of handlers[event] ?? []) await handler(evObj, ctx);
    },
    async exec() {
      return { stdout: gitOutput, stderr: "", code: gitOutput ? 0 : 128, killed: false };
    },
  };
}

function createMockContext(cwd = "/test/dir") {
  const statuses = new Map<string, string>();
  const mockTheme = {
    fg(color: string, text: string) {
      return `[${color}]${text}[/${color}]`;
    },
  };

  return {
    statuses,
    ui: {
      theme: mockTheme,
      setStatus(key: string, text: string | undefined) {
        if (text === undefined) statuses.delete(key);
        else statuses.set(key, text);
      },
    },
    cwd,
  };
}

describe("statusline extension", () => {
  let mockPi: ReturnType<typeof createMockExtensionAPI>;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    statusline(mockPi as any);
  });

  test("registers all lifecycle handlers", () => {
    expect(mockPi.handlers["session_start"]).toBeDefined();
    expect(mockPi.handlers["turn_start"]).toBeDefined();
    expect(mockPi.handlers["tool_execution_start"]).toBeDefined();
    expect(mockPi.handlers["tool_execution_end"]).toBeDefined();
    expect(mockPi.handlers["turn_end"]).toBeDefined();
  });

  test("renders compact session and turn states without duplicating the footer", async () => {
    const ctx = createMockContext("/workspace/project");
    await mockPi.emit("session_start", { type: "session_start" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Ready");
    expect(ctx.statuses.get("statusline")).not.toContain("/workspace/project");

    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Processing...");
    expect(ctx.statuses.get("statusline")).not.toContain("/workspace/project");
  });

  test("renders tool names while accounting owns the count", async () => {
    const ctx = createMockContext();
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);

    await mockPi.emit("tool_execution_start", { toolCallId: "read-1", toolName: "read" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Running read (x1)");

    await mockPi.emit("tool_execution_start", { toolCallId: "write-1", toolName: "write" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Running write (x2)");
  });

  test("renders successful turn statistics from the accounting snapshot", async () => {
    const ctx = createMockContext();
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    await mockPi.emit("tool_execution_start", { toolCallId: "bash-1", toolName: "bash" }, ctx);
    await mockPi.emit("tool_execution_end", { toolCallId: "bash-1", toolName: "bash", isError: false }, ctx);
    await mockPi.emit("turn_end", { type: "turn_end" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toContain("Done (1)");
    expect(status).toContain("tools 0.00s");
    expect(status).toContain("✓");
  });

  test("renders an error when the accounting snapshot contains a tool error", async () => {
    const ctx = createMockContext();
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    await mockPi.emit("tool_execution_start", { toolCallId: "bash-1", toolName: "bash" }, ctx);
    await mockPi.emit("tool_execution_end", { toolCallId: "bash-1", toolName: "bash", isError: true }, ctx);
    await mockPi.emit("turn_end", { type: "turn_end" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toContain("Error (1) errors 1");
    expect(status).toContain("✗");
  });

  test("keeps Git status in the compact line", async () => {
    mockPi = createMockExtensionAPI("## main...origin/main [ahead 1, behind 2]\n M src/index.ts\n?? notes.md\n");
    statusline(mockPi as any);
    const ctx = createMockContext();

    await mockPi.emit("session_start", { type: "session_start" }, ctx);

    expect(ctx.statuses.get("statusline")).toContain("git:main *2 ↑1 ↓2");
  });

});
