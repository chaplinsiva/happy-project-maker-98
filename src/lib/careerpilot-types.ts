export type ResumeProfile = {
  candidateName: string;
  headline: string;
  skills: string[];
  programmingLanguages: string[];
  education: string[];
  projects: string[];
  experience: string[];
  certifications: string[];
  sectionsParsed: number;
};

export type JobRequirements = {
  role: string;
  summary: string;
  mustHave: string[];
  niceToHave: string[];
  responsibilities: string[];
  experienceExpectation: string;
};

export type SkillStatus = "strong" | "partial" | "missing";

export type SkillGapReport = {
  matchScore: number;
  skillsCovered: number;
  skillsTotal: number;
  verdict: string;
  competencies: { name: string; score: number; status: SkillStatus; note: string }[];
};

export type LearningRoadmap = {
  weeks: number;
  courseCount: number;
  steps: { order: number; title: string; detail: string; hours: number; priority: SkillStatus }[];
  capstone: { title: string; detail: string };
};

export type ApplicationKit = {
  coverLetter: string;
  resumeImprovements: string[];
  interviewTopics: string[];
  checklist: string[];
};

export type RunState = {
  profile?: ResumeProfile;
  requirements?: JobRequirements;
  gap?: SkillGapReport;
  roadmap?: LearningRoadmap;
  kit?: ApplicationKit;
};

export const AGENTS = [
  { id: "resume", label: "Resume Analysis", hint: "parsing experience" },
  { id: "requirements", label: "Job Requirements", hint: "mapping role signals" },
  { id: "gap", label: "Skill Gap Analysis", hint: "scoring competencies" },
  { id: "roadmap", label: "Learning Roadmap", hint: "sequencing modules" },
  { id: "kit", label: "Application Kit", hint: "drafting materials" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];
