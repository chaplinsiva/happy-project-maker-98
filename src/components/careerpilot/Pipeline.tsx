import { AGENTS, type AgentId } from "@/lib/careerpilot-types";

export type StageStatus = "idle" | "running" | "done" | "error";

export type StageState = Record<AgentId, { status: StageStatus; note?: string }>;

export function Pipeline({ stages }: { stages: StageState }) {
  return (
    <section className="bg-panel border border-edge rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Multi-Agent Workflow</div>
          <div className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
            5 agents · pipeline
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] border border-mint/30 text-mint bg-mint/5">
          LIVE
        </span>
      </div>
      <ol className="p-3 space-y-1">
        {AGENTS.map((agent, index) => {
          const state = stages[agent.id];
          const done = state.status === "done";
          const running = state.status === "running";
          const failed = state.status === "error";

          return (
            <li
              key={agent.id}
              className={
                done
                  ? "flex items-center gap-3 p-3 rounded-lg bg-edge/40"
                  : running
                    ? "flex items-center gap-3 p-3 rounded-lg bg-vio/5 border border-vio/20"
                    : failed
                      ? "flex items-center gap-3 p-3 rounded-lg bg-coral/5 border border-coral/20"
                      : "flex items-center gap-3 p-3 rounded-lg"
              }
            >
              <span
                className={
                  done
                    ? "size-6 rounded-md grid place-items-center bg-mint/15 text-mint font-mono text-xs"
                    : running
                      ? "size-6 rounded-md grid place-items-center bg-vio/15 text-vio font-mono text-xs"
                      : failed
                        ? "size-6 rounded-md grid place-items-center bg-coral/15 text-coral font-mono text-xs"
                        : "size-6 rounded-md grid place-items-center bg-edge text-faint font-mono text-xs"
                }
              >
                {done ? "✓" : running ? <span className="size-2 rounded-full bg-vio cp-pulse" /> : failed ? "!" : index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={
                    running
                      ? "text-sm font-medium text-vio"
                      : failed
                        ? "text-sm font-medium text-coral"
                        : done
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-mut"
                  }
                >
                  {agent.label}
                </div>
                <div className="font-mono text-[10px] text-faint truncate">
                  {state.note ??
                    (running ? `${agent.hint}…` : done ? "complete" : failed ? "failed" : "queued")}
                </div>
              </div>
              <span
                className={
                  done
                    ? "font-mono text-[10px] text-mint"
                    : running
                      ? "font-mono text-[10px] text-vio"
                      : failed
                        ? "font-mono text-[10px] text-coral"
                        : "font-mono text-[10px] text-faint"
                }
              >
                {done ? "DONE" : running ? "RUN" : failed ? "ERR" : "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
