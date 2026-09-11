import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import type {
  ApplicationKit,
  JobRequirements,
  LearningRoadmap,
  ResumeProfile,
  SkillGapReport,
} from "./careerpilot-types";

const MODEL = "openai/gpt-6-astra";

function extractJson<T>(text: string): T {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("The AI returned a response we couldn't read. Try running again.");
  }
}

function friendlyError(error: unknown): Error {
  const status =
    (error as { statusCode?: number })?.statusCode ??
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status;

  if (status === 429) {
    return new Error("Too many requests right now. Wait a moment and run this step again.");
  }
  if (status === 402) {
    return new Error("The AI credits for this app have run out. Add credits to continue.");
  }
  if (status === 403) {
    return new Error("AI access is blocked for this workspace. Check the workspace AI settings.");
  }
  if (status === 401) {
    return new Error("The AI connection isn't configured correctly.");
  }
  if (error instanceof Error) return error;
  return new Error("The AI step failed unexpectedly.");
}

async function runAgent(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The AI connection isn't configured correctly.");

  const { createLovableResponsesProvider } = await import("./ai-gateway.server");
  const lovable = createLovableResponsesProvider(apiKey);

  try {
    const result = streamText({
      model: lovable.responses(MODEL),
      system,
      prompt,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
        },
      },
    });
    return await result.text;
  } catch (error) {
    throw friendlyError(error);
  }
}

const JSON_RULE =
  "Reply with a single valid JSON object and nothing else. No markdown fences, no commentary.";

export const analyzeResume = createServerFn({ method: "POST" })
  .inputValidator((input: { resumeText: string; role: string }) => {
    if (!input?.resumeText?.trim()) throw new Error("No readable text found in that PDF.");
    return { resumeText: input.resumeText.slice(0, 24000), role: input.role.slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const text = await runAgent(
      `You are the Resume Analysis agent in a career-guidance workflow. ${JSON_RULE}`,
      `Extract a structured profile from this resume. Target role: ${data.role}.

Return JSON with this exact shape:
{"candidateName":string,"headline":string,"skills":string[],"programmingLanguages":string[],"education":string[],"projects":string[],"experience":string[],"certifications":string[],"sectionsParsed":number}

Keep each array to at most 10 short entries. Use "Unknown" if a name is not present.

RESUME TEXT:
${data.resumeText}`,
    );
    return extractJson<ResumeProfile>(text);
  });

export const researchRole = createServerFn({ method: "POST" })
  .inputValidator((input: { role: string; profile: ResumeProfile }) => input)
  .handler(async ({ data }) => {
    const text = await runAgent(
      `You are the Job Research agent in a career-guidance workflow. ${JSON_RULE}`,
      `Describe what employers typically require for the role "${data.role}" today, for a candidate whose headline is "${data.profile.headline}".

Return JSON with this exact shape:
{"role":string,"summary":string,"mustHave":string[],"niceToHave":string[],"responsibilities":string[],"experienceExpectation":string}

mustHave: 6-10 concrete skills or technologies. niceToHave and responsibilities: up to 6 entries each. summary: one sentence.`,
    );
    return extractJson<JobRequirements>(text);
  });

export const analyzeSkillGap = createServerFn({ method: "POST" })
  .inputValidator((input: { profile: ResumeProfile; requirements: JobRequirements }) => input)
  .handler(async ({ data }) => {
    const text = await runAgent(
      `You are the Skill Gap agent in a career-guidance workflow. ${JSON_RULE}`,
      `Compare the candidate against the role requirements and score each required competency 0-100.

Return JSON with this exact shape:
{"matchScore":number,"skillsCovered":number,"skillsTotal":number,"verdict":string,"competencies":[{"name":string,"score":number,"status":"strong"|"partial"|"missing","note":string}]}

Use status "strong" for 75+, "partial" for 40-74, "missing" below 40. Include 6-10 competencies drawn from the role's must-have list. matchScore is the overall readiness percentage. verdict is one encouraging sentence. note is at most 12 words.

CANDIDATE: ${JSON.stringify(data.profile)}

ROLE REQUIREMENTS: ${JSON.stringify(data.requirements)}`,
    );
    return extractJson<SkillGapReport>(text);
  });

export const buildRoadmap = createServerFn({ method: "POST" })
  .inputValidator((input: { role: string; gap: SkillGapReport }) => input)
  .handler(async ({ data }) => {
    const text = await runAgent(
      `You are the Learning agent in a career-guidance workflow. ${JSON_RULE}`,
      `Build a prioritized learning roadmap that closes the candidate's gaps for "${data.role}", weakest and most important first.

Return JSON with this exact shape:
{"weeks":number,"courseCount":number,"steps":[{"order":number,"title":string,"detail":string,"hours":number,"priority":"strong"|"partial"|"missing"}],"capstone":{"title":string,"detail":string}}

Give 4-6 steps. detail is at most 12 words listing the concrete topics. priority mirrors the gap severity the step addresses.

SKILL GAP REPORT: ${JSON.stringify(data.gap)}`,
    );
    return extractJson<LearningRoadmap>(text);
  });

export const buildApplicationKit = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      role: string;
      profile: ResumeProfile;
      requirements: JobRequirements;
      gap: SkillGapReport;
    }) => input,
  )
  .handler(async ({ data }) => {
    const text = await runAgent(
      `You are the Application agent in a career-guidance workflow. ${JSON_RULE}`,
      `Produce application materials for "${data.role}".

Return JSON with this exact shape:
{"coverLetter":string,"resumeImprovements":string[],"interviewTopics":string[],"checklist":string[]}

coverLetter: 180-220 words, first person, specific to this candidate's real strengths, no placeholders in square brackets except the company name as [Company]. Each array: 4-6 short entries.

CANDIDATE: ${JSON.stringify(data.profile)}
ROLE REQUIREMENTS: ${JSON.stringify(data.requirements)}
SKILL GAP: ${JSON.stringify(data.gap)}`,
    );
    return extractJson<ApplicationKit>(text);
  });
