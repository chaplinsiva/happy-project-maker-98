import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Pipeline, type StageState } from "@/components/careerpilot/Pipeline";
import {
  analyzeResume,
  analyzeSkillGap,
  buildApplicationKit,
  buildRoadmap,
  researchRole,
} from "@/lib/agents.functions";
import { AGENTS, type AgentId, type RunState, type SkillStatus } from "@/lib/careerpilot-types";
import { extractPdfText } from "@/lib/pdf-text";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerPilot AI — Resume to Career Roadmap in One Run" },
      {
        name: "description",
        content:
          "Upload your resume, name a target role, and watch five AI agents score your readiness, find skill gaps, and draft your application kit.",
      },
      { property: "og:title", content: "CareerPilot AI — Career Copilot Console" },
      {
        property: "og:description",
        content:
          "Five AI agents analyze your resume against a target role: readiness score, skill gaps, learning roadmap, and cover letter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Console,
});

const emptyStages: StageState = {
  resume: { status: "idle" },
  requirements: { status: "idle" },
  gap: { status: "idle" },
  roadmap: { status: "idle" },
  kit: { status: "idle" },
};

const statusColor: Record<SkillStatus, string> = {
  strong: "mint",
  partial: "amber",
  missing: "coral",
};

function barClass(status: SkillStatus) {
  return status === "strong" ? "bg-mint" : status === "partial" ? "bg-amber" : "bg-coral";
}

function textClass(status: SkillStatus) {
  return status === "strong" ? "text-mint" : status === "partial" ? "text-amber" : "text-coral";
}

function Console() {
  const runResume = useServerFn(analyzeResume);
  const runRole = useServerFn(researchRole);
  const runGap = useServerFn(analyzeSkillGap);
  const runRoadmap = useServerFn(buildRoadmap);
  const runKit = useServerFn(buildApplicationKit);

  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<StageState>(emptyStages);
  const [result, setResult] = useState<RunState>({});
  const [copied, setCopied] = useState(false);

  const mark = (id: AgentId, status: StageState[AgentId]["status"], note?: string) =>
    setStages((prev) => ({ ...prev, [id]: { status, note } }));

  async function start() {
    if (!file || !role.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult({});
    setStages(emptyStages);

    try {
      mark("resume", "running", "reading your PDF…");
      const resumeText = await extractPdfText(file);

      mark("resume", "running", "extracting profile…");
      const profile = await runResume({ data: { resumeText, role } });
      setResult((r) => ({ ...r, profile }));
      mark("resume", "done", `${profile.skills.length} skills found`);

      mark("requirements", "running");
      const requirements = await runRole({ data: { role, profile } });
      setResult((r) => ({ ...r, requirements }));
      mark("requirements", "done", `${requirements.mustHave.length} must-have skills`);

      mark("gap", "running");
      const gap = await runGap({ data: { profile, requirements } });
      setResult((r) => ({ ...r, gap }));
      mark("gap", "done", `${gap.matchScore}% match`);

      mark("roadmap", "running");
      const roadmap = await runRoadmap({ data: { role, gap } });
      setResult((r) => ({ ...r, roadmap }));
      mark("roadmap", "done", `${roadmap.steps.length} steps · ${roadmap.weeks} weeks`);

      mark("kit", "running");
      const kit = await runKit({ data: { role, profile, requirements, gap } });
      setResult((r) => ({ ...r, kit }));
      mark("kit", "done", "cover letter ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong during the run.";
      setError(message);
      setStages((prev) => {
        const next = { ...prev };
        for (const agent of AGENTS) {
          if (next[agent.id].status === "running") next[agent.id] = { status: "error", note: message };
        }
        return next;
      });
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setFile(null);
    setRole("");
    setResult({});
    setStages(emptyStages);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function copyLetter() {
    if (!result.kit) return;
    await navigator.clipboard.writeText(result.kit.coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const { profile, requirements, gap, roadmap, kit } = result;

  return (
    <div className="min-h-screen bg-ink text-white font-display antialiased">
      <header className="border-b border-edge">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md grid place-items-center bg-panel border border-edge">
              <span className="size-2.5 rounded-full bg-mint cp-pulse" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">
                CareerPilot <span className="text-mint">AI</span>
              </div>
              <div className="font-mono text-[10px] text-faint uppercase tracking-[0.22em]">
                Career Copilot Console
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-2 font-mono text-[11px] text-mut px-3 py-1.5 rounded-md border border-edge bg-panel">
              <span className="size-1.5 rounded-full bg-cyan cp-pulse" />
              {running ? "Agents working" : gap ? "Run complete" : "Standing by"}
            </span>
            {(gap || running) && (
              <button
                onClick={reset}
                disabled={running}
                className="px-3 py-1.5 rounded-md border border-edge bg-panel font-mono text-[11px] text-mut hover:text-white transition disabled:opacity-40"
              >
                New run
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Pipeline stages={stages} />

          <section className="bg-panel border border-edge rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold">Source Resume</span>
              <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">PDF</span>
            </div>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={running}
              className="w-full aspect-[4/5] bg-ink border border-edge border-dashed rounded-lg grid place-items-center px-4 text-center hover:border-mint/40 transition disabled:opacity-50"
            >
              <div>
                <div className="size-10 mx-auto rounded-full bg-mint/10 text-mint grid place-items-center text-lg">
                  ↑
                </div>
                <div className="mt-3 text-sm font-medium">
                  {file ? file.name : "Drop your resume PDF"}
                </div>
                <div className="font-mono text-[10px] text-faint mt-1">
                  {file ? `${Math.round(file.size / 1024)} KB · click to replace` : "click to browse"}
                </div>
              </div>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-mut">Candidate</span>
                <span className="font-mono">{profile?.candidateName ?? "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-mut">Target role</span>
                <span className="font-mono text-cyan">{role || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-mut">Sections parsed</span>
                <span className="font-mono">{profile?.sectionsParsed ?? "—"}</span>
              </div>
            </div>
          </section>

          {profile && (
            <section className="bg-panel border border-edge rounded-xl p-5">
              <div className="text-sm font-semibold mb-3">Extracted Profile</div>
              <p className="text-xs text-mut mb-3">{profile.headline}</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 rounded-md border border-edge bg-ink font-mono text-[10px] text-mut"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {!gap && (
            <section className="bg-panel border border-edge rounded-xl p-6">
              <div className="font-mono text-[11px] text-mint uppercase tracking-[0.25em]">
                Pre-flight
              </div>
              <h1 className="text-3xl font-semibold tracking-tight mt-1 max-w-xl">
                One resume, one role, five agents.
              </h1>
              <p className="text-sm text-mut mt-2 max-w-lg">
                CareerPilot reads your resume, works out what the role demands, scores the gap,
                plans the learning, and drafts your application — in a single run.
              </p>

              <div className="mt-6 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                <label className="block">
                  <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
                    Target role
                  </span>
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Full Stack Developer"
                    disabled={running}
                    className="mt-2 w-full bg-ink border border-edge rounded-lg px-4 py-3 text-sm outline-none focus:border-mint/50 placeholder:text-faint"
                  />
                </label>
                <button
                  onClick={start}
                  disabled={!file || !role.trim() || running}
                  className="px-5 py-3 rounded-lg bg-mint text-ink font-semibold text-sm hover:bg-mint/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {running ? "Running…" : "Run agents"}
                </button>
              </div>
              {!file && (
                <p className="font-mono text-[10px] text-faint mt-3">
                  Add a resume PDF on the left to begin.
                </p>
              )}
              {error && (
                <p className="mt-4 text-sm text-coral border border-coral/25 bg-coral/5 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}
            </section>
          )}

          {requirements && (
            <section className="bg-panel border border-edge rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Role Requirements</h2>
                <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
                  {requirements.experienceExpectation}
                </span>
              </div>
              <p className="text-sm text-mut mb-3">{requirements.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {requirements.mustHave.map((item) => (
                  <span
                    key={item}
                    className="px-2 py-1 rounded-md border border-cyan/25 bg-cyan/5 text-[11px] text-cyan"
                  >
                    {item}
                  </span>
                ))}
                {requirements.niceToHave.map((item) => (
                  <span
                    key={item}
                    className="px-2 py-1 rounded-md border border-edge bg-ink text-[11px] text-mut"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {gap && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] text-mint uppercase tracking-[0.25em]">
                    Consolidated report
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight mt-1">
                    You're <span className="text-mint">{gap.matchScore}%</span> ready for {role}
                  </h1>
                  <p className="text-sm text-mut mt-1 max-w-md">{gap.verdict}</p>
                </div>
                <button
                  onClick={reset}
                  className="px-4 py-2.5 rounded-lg bg-mint text-ink font-semibold text-sm hover:bg-mint/90 transition"
                >
                  Start a new run
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="font-mono text-[10px] text-faint uppercase tracking-[0.18em]">
                    Match
                  </div>
                  <div className="text-2xl font-semibold text-mint mt-1">
                    {gap.matchScore}
                    <span className="text-base">%</span>
                  </div>
                  <div className="text-[11px] text-mut mt-0.5">overall readiness</div>
                </div>
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="font-mono text-[10px] text-faint uppercase tracking-[0.18em]">
                    Skills covered
                  </div>
                  <div className="text-2xl font-semibold mt-1">
                    {gap.skillsCovered}
                    <span className="text-base text-mut">/{gap.skillsTotal}</span>
                  </div>
                  <div className="text-[11px] text-mut mt-0.5">
                    {gap.competencies.filter((c) => c.status !== "strong").length} gaps found
                  </div>
                </div>
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="font-mono text-[10px] text-faint uppercase tracking-[0.18em]">
                    Roadmap
                  </div>
                  <div className="text-2xl font-semibold mt-1">
                    {roadmap?.weeks ?? "—"}
                    <span className="text-base text-mut"> wks</span>
                  </div>
                  <div className="text-[11px] text-mut mt-0.5">
                    {roadmap ? `${roadmap.steps.length} steps planned` : "planning…"}
                  </div>
                </div>
                <div className="bg-panel border border-edge rounded-xl p-4">
                  <div className="font-mono text-[10px] text-faint uppercase tracking-[0.18em]">
                    Kit ready
                  </div>
                  <div className="text-2xl font-semibold text-cyan mt-1">
                    {kit ? 4 : 0}
                    <span className="text-base text-mut">/4</span>
                  </div>
                  <div className="text-[11px] text-mut mt-0.5">
                    {kit ? "all assets drafted" : "drafting…"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <section className="col-span-12 md:col-span-7 bg-panel border border-edge rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">Skill Gap Analysis</h2>
                    <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
                      competency vs role
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {gap.competencies.map((c) => (
                      <div key={c.name}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white">{c.name}</span>
                          <span className={`font-mono ${textClass(c.status)}`}>{c.score}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-edge overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass(c.status)}`}
                            style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
                          />
                        </div>
                        <div className="font-mono text-[10px] text-faint mt-1">{c.note}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="col-span-12 md:col-span-5 bg-panel border border-edge rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">Learning Roadmap</h2>
                    <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
                      {roadmap ? `${roadmap.weeks} weeks` : "pending"}
                    </span>
                  </div>
                  {roadmap ? (
                    <ol className="relative space-y-4 pl-1">
                      {roadmap.steps.map((step) => (
                        <li key={step.order} className="flex gap-3">
                          <span
                            className={`mt-1 size-5 shrink-0 rounded-full grid place-items-center font-mono text-[10px] bg-${statusColor[step.priority]}/15 ${textClass(step.priority)}`}
                          >
                            {step.order}
                          </span>
                          <div>
                            <div className="text-sm font-medium">{step.title}</div>
                            <div className="font-mono text-[10px] text-faint">
                              {step.detail} · {step.hours} hrs
                            </div>
                          </div>
                        </li>
                      ))}
                      <li className="flex gap-3">
                        <span className="mt-1 size-5 shrink-0 rounded-full grid place-items-center bg-edge text-faint font-mono text-[10px]">
                          ★
                        </span>
                        <div>
                          <div className="text-sm font-medium text-vio">
                            {roadmap.capstone.title}
                          </div>
                          <div className="font-mono text-[10px] text-faint">
                            {roadmap.capstone.detail}
                          </div>
                        </div>
                      </li>
                    </ol>
                  ) : (
                    <p className="font-mono text-[11px] text-faint">Learning agent is working…</p>
                  )}
                </section>
              </div>

              <section className="bg-panel border border-edge rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">Application Kit</h2>
                  <span className="font-mono text-[10px] text-faint uppercase tracking-[0.2em]">
                    tailored for {role}
                  </span>
                </div>
                {kit ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-edge bg-ink p-4">
                        <div className="text-xs font-medium text-mint mb-2">Resume Improvements</div>
                        <ul className="space-y-1.5">
                          {kit.resumeImprovements.map((item) => (
                            <li key={item} className="font-mono text-[10px] text-mut">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-edge bg-ink p-4">
                        <div className="text-xs font-medium text-cyan mb-2">Interview Topics</div>
                        <ul className="space-y-1.5">
                          {kit.interviewTopics.map((item) => (
                            <li key={item} className="font-mono text-[10px] text-mut">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-edge bg-ink p-4">
                        <div className="text-xs font-medium text-amber mb-2">Checklist</div>
                        <ul className="space-y-1.5">
                          {kit.checklist.map((item) => (
                            <li key={item} className="font-mono text-[10px] text-mut">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-edge bg-ink p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-medium text-mint">Cover Letter</div>
                        <button
                          onClick={copyLetter}
                          className="px-3 py-1.5 rounded-md border border-edge font-mono text-[10px] text-mut hover:text-white transition"
                        >
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm text-mut leading-relaxed whitespace-pre-line">
                        {kit.coverLetter}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="font-mono text-[11px] text-faint">Application agent is working…</p>
                )}
              </section>

              {error && (
                <p className="text-sm text-coral border border-coral/25 bg-coral/5 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
