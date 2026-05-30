// tests/workflow-tool.test.js
import { describe, expect, it, vi } from "vitest";
import { createWorkflowTool } from "../lib/tools/workflow-tool.js";

function makeCtx() {
  return { sessionManager: { getSessionFile: () => "/s.jsonl", getCwd: () => "/w" } };
}
const META = `export const meta = { name: 'demo', description: 'd' }\n`;

describe("workflow tool", () => {
  it("工具形状正确", () => {
    const tool = createWorkflowTool({ executeIsolated: async () => ({}) });
    expect(tool.name).toBe("workflow");
    expect(tool.parameters.properties.script).toBeTruthy();
  });

  it("execute 跑脚本，返回 result + agentsSpawned，并给 executeIsolated 正确 baseIsoOpts", async () => {
    const exec = vi.fn(async () => ({ replyText: "bug", error: null }));
    const tool = createWorkflowTool({ executeIsolated: exec, getAgentId: () => "a1", emitEvent: () => {} });
    const res = await tool.execute(
      "c1",
      { script: META + `const o=[]; while(o.length<2){o.push(await agent('x'))} return o` },
      undefined, undefined, makeCtx()
    );
    expect(res.details.result).toEqual(["bug", "bug"]);
    expect(res.details.agentsSpawned).toBe(2);
    expect(res.content[0].text).toMatch(/完成/);
    expect(exec.mock.calls[0][1]).toMatchObject({
      agentId: "a1", parentSessionPath: "/s.jsonl", cwd: "/w", subagentContext: true, emitEvents: true,
    });
  });

  it("脚本错误时返回 toolError，不抛", async () => {
    const tool = createWorkflowTool({ executeIsolated: async () => ({ replyText: "", error: null }), emitEvent: () => {} });
    const res = await tool.execute("c1", { script: `return 1` }, undefined, undefined, makeCtx());
    expect(res.details.error).toMatch(/执行失败/);
  });

  it("emitEvent 收到 workflow_progress（phase/log）", async () => {
    const evts = [];
    const tool = createWorkflowTool({
      executeIsolated: async () => ({ replyText: "ok", error: null }),
      emitEvent: (e, sp) => evts.push({ e, sp }),
    });
    await tool.execute("c1", { script: META + `phase('Find'); log('hi'); return await agent('x')` }, undefined, undefined, makeCtx());
    expect(evts.map((x) => x.e.type)).toContain("workflow_progress");
    expect(evts.find((x) => x.e.title === "Find")).toBeTruthy();
  });
});
