// lib/tools/workflow-tool.js
import os from "node:os";
import { Type } from "../pi-sdk/index.js";
import { runWorkflowScript } from "../workflow/sandbox.js";
import { createHostApi } from "../workflow/host-api.js";
import { createLimiter } from "../workflow/concurrency.js";
import { getToolSessionPath, getToolSessionCwd } from "./tool-session.js";
import { toolOk, toolError } from "./tool-result.js";

const WORKFLOW_DEADLINE_MS = 5 * 60 * 1000;
const AGENT_TOTAL_BACKSTOP = 1000;

const WORKFLOW_DESCRIPTION = [
  "用一段确定性 JS 脚本编排多个子 agent（agent/parallel/pipeline）。",
  "适合：受控 fan-out、要保证不漏不偷懒、要立刻拿合成结果的任务。",
  "脚本必须以 `export const meta = { name, description }` 开头（纯字面量）。",
  "可用全局：agent(prompt, {model?, schema?, agentType?}) 同步返回结果（带 schema 返回校验对象）；",
  "parallel(thunks) 并发等齐（thunk 抛错落 null）；pipeline(items, ...stages) 每项独立穿过各 stage；log/phase/budget/args。",
  "脚本拿不到 require/process/fs/net；禁用 Math.random/Date.now。脚本的 return 值即工具结果。",
].join("\n");

/**
 * @param {{
 *   executeIsolated: (prompt: string, isoOpts: object) => Promise<object>,
 *   getSessionPath?: () => string|null,
 *   getParentCwd?: () => string|null,
 *   getAgentId?: () => string|undefined,
 *   emitEvent?: (event: object, sessionPath: string|null) => void,
 *   resolveAgentId?: (agentType?: string) => string|undefined,
 * }} deps
 */
export function createWorkflowTool(deps) {
  return {
    name: "workflow",
    label: "Workflow",
    description: WORKFLOW_DESCRIPTION,
    parameters: Type.Object({
      script: Type.String({ description: "编排脚本，以 export const meta = {...} 开头" }),
      // 若本项目 typebox 封装无 Type.Any，用 Type.Unknown()。
      args: Type.Optional(Type.Any({ description: "传给脚本 args 全局的参数" })),
    }),
    execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
      const parentSessionPath = getToolSessionPath(ctx) || deps.getSessionPath?.() || null;
      const cwd = getToolSessionCwd(ctx) || deps.getParentCwd?.() || null;
      const agentId = deps.getAgentId?.() || undefined;

      const maxConcurrent = Math.max(1, Math.min(16, os.cpus().length - 2));
      const limiter = createLimiter({ maxConcurrent, maxTotal: AGENT_TOTAL_BACKSTOP });

      const hostApi = createHostApi({
        executeIsolated: (prompt, isoOpts) => deps.executeIsolated(prompt, isoOpts),
        baseIsoOpts: { agentId, cwd, parentSessionPath, subagentContext: true, emitEvents: true },
        limiter,
        signal,
        onProgress: (evt) => deps.emitEvent?.({ ...evt, type: "workflow_progress" }, parentSessionPath),
        budget: { total: null, spent: () => 0, remaining: () => Infinity }, // 二期接真 usage 计量
        args: params.args,
        resolveAgentId: deps.resolveAgentId,
      });

      try {
        const { meta, result } = await runWorkflowScript(params.script, hostApi, {
          signal,
          deadlineMs: WORKFLOW_DEADLINE_MS,
        });
        const summary = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return toolOk(
          `workflow "${meta.name}" 完成，派出 ${limiter.totalSpawned} 个 agent。\n\n结果:\n${summary}`,
          { workflow: meta.name, agentsSpawned: limiter.totalSpawned, result }
        );
      } catch (err) {
        return toolError(`workflow 执行失败: ${err.message}`, { agentsSpawned: limiter.totalSpawned });
      }
    },
  };
}
