import { describe, test, expect, beforeEach } from "bun:test";
import statusline from "../extensions/statusline.js";

interface EventHandlers {
  [eventName: string]: Function[];
}

function createMockExtensionAPI() {
  const handlers: EventHandlers = {};
  return {
    handlers,
    on(event: string, handler: Function) {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
    },
    async emit(event: string, evObj: any, ctx: any) {
      if (handlers[event]) {
        for (const h of handlers[event]) {
          await h(evObj, ctx);
        }
      }
    }
  };
}

function createMockContext(options: { provider?: string; id?: string; level?: string; cwd?: string } = {}) {
  const statuses = new Map<string, string>();
  const mockTheme = {
    fg(color: string, text: string) {
      return `[${color}]${text}[/${color}]`;
    }
  };

  return {
    statuses,
    ui: {
      theme: mockTheme,
      setStatus(key: string, text: string | undefined) {
        if (text === undefined) {
          statuses.delete(key);
        } else {
          statuses.set(key, text);
        }
      }
    },
    model: options.provider && options.id ? { provider: options.provider, id: options.id } : undefined,
    thinkingLevel: options.level,
    cwd: options.cwd || "/test/dir"
  };
}

describe("statusline extension", () => {
  let mockPi: ReturnType<typeof createMockExtensionAPI>;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    statusline(mockPi as any);
  });

  test("registers all required event handlers", () => {
    expect(mockPi.handlers["session_start"]).toBeDefined();
    expect(mockPi.handlers["turn_start"]).toBeDefined();
    expect(mockPi.handlers["tool_execution_start"]).toBeDefined();
    expect(mockPi.handlers["tool_execution_end"]).toBeDefined();
    expect(mockPi.handlers["turn_end"]).toBeDefined();
  });

  test("handles session_start event correctly", async () => {
    const ctx = createMockContext({ provider: "anthropic", id: "claude-3-5-sonnet", level: "medium" });
    await mockPi.emit("session_start", { type: "session_start" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toBeDefined();
    expect(status).toContain("Ready • anthropic/claude-3-5-sonnet • medium");
  });

  test("handles session_start with missing model gracefully", async () => {
    const ctx = createMockContext({});
    await mockPi.emit("session_start", { type: "session_start" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toBeDefined();
    expect(status).toContain("Ready • unknown model • ?");
  });

  test("handles turn_start event correctly", async () => {
    const ctx = createMockContext({ cwd: "/workspace/project" });
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toBeDefined();
    expect(status).toContain("Processing...");
    expect(status).toContain("/workspace/project");
  });

  test("tracks tool execution start and counts invocations", async () => {
    const ctx = createMockContext({ cwd: "/workspace/project" });
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    
    await mockPi.emit("tool_execution_start", { toolName: "read" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Running read (x1)");

    await mockPi.emit("tool_execution_start", { toolName: "write" }, ctx);
    expect(ctx.statuses.get("statusline")).toContain("Running write (x2)");
  });

  test("handles turn_end event with success", async () => {
    const ctx = createMockContext({ cwd: "/workspace/project" });
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    await mockPi.emit("tool_execution_start", { toolName: "bash" }, ctx);
    await mockPi.emit("tool_execution_end", { toolName: "bash", isError: false }, ctx);
    await mockPi.emit("turn_end", { type: "turn_end" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toBeDefined();
    expect(status).toContain("Done (1)");
    expect(status).toContain("✓");
  });

  test("handles turn_end event with tool error", async () => {
    const ctx = createMockContext({ cwd: "/workspace/project" });
    await mockPi.emit("turn_start", { type: "turn_start" }, ctx);
    await mockPi.emit("tool_execution_start", { toolName: "bash" }, ctx);
    await mockPi.emit("tool_execution_end", { toolName: "bash", isError: true }, ctx);
    await mockPi.emit("turn_end", { type: "turn_end" }, ctx);

    const status = ctx.statuses.get("statusline");
    expect(status).toBeDefined();
    expect(status).toContain("Error (1)");
    expect(status).toContain("✗");
  });
});
