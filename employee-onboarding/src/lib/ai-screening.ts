// AI screening for 1099 contractor applicants.
// Scores 0-100 across 5 dimensions. Replace the heuristic with an LLM call
// (OpenAI/Claude) by swapping the `screenApplicant` implementation.

export interface ScreeningInput {
  position: string;
  experience: string; // years
  skills: string; // comma-separated
  availability: string;
  hasTransport: boolean;
  hasInsurance: boolean;
  coverLetter?: string;
  references?: string;
}

export interface ScreeningResult {
  score: number; // 0-100
  summary: string;
  recommendation: "strong" | "moderate" | "weak";
  breakdown: {
    experience: number;
    skills: number;
    availability: number;
    logistics: number;
    communication: number;
  };
  strengths: string[];
  concerns: string[];
}

const POSITION_REQUIREMENTS: Record<string, { minExp: number; keywords: string[] }> = {
  "Floor Installer": { minExp: 2, keywords: ["flooring", "hardwood", "installation", "carpentry", "construction"] },
  "Court Striping Technician": { minExp: 1, keywords: ["striping", "painting", "athletics", "sports", "line marking"] },
  "Vinyl/Graphics Installer": { minExp: 1, keywords: ["vinyl", "wrap", "graphics", "signage", "installation"] },
  "Mural Painter": { minExp: 2, keywords: ["mural", "painting", "art", "fine art", "design"] },
  "General Laborer": { minExp: 0, keywords: ["construction", "labor", "physical", "outdoor"] },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreExperience(input: ScreeningInput, req: { minExp: number }): number {
  const yrs = parseFloat(input.experience || "0") || 0;
  if (yrs >= req.minExp + 3) return 25;
  if (yrs >= req.minExp + 1) return 20;
  if (yrs >= req.minExp) return 15;
  if (yrs >= req.minExp - 1) return 10;
  return 5;
}

function scoreSkills(input: ScreeningInput, req: { keywords: string[] }): number {
  const skills = (input.skills || "").toLowerCase();
  const cl = (input.coverLetter || "").toLowerCase();
  const text = skills + " " + cl;
  const matched = req.keywords.filter((k) => text.includes(k));
  const ratio = matched.length / Math.max(req.keywords.length, 1);
  if (ratio >= 0.8) return 25;
  if (ratio >= 0.6) return 20;
  if (ratio >= 0.4) return 15;
  if (ratio >= 0.2) return 10;
  return 5;
}

function scoreAvailability(input: ScreeningInput): number {
  const avail = (input.availability || "").toLowerCase();
  if (avail.includes("full") || avail.includes("any") || avail.includes("flex")) return 20;
  if (avail.includes("part") || avail.includes("weekend")) return 15;
  if (avail.includes("seasonal") || avail.includes("summer")) return 12;
  return 8;
}

function scoreLogistics(input: ScreeningInput): number {
  let score = 0;
  if (input.hasTransport) score += 10;
  if (input.hasInsurance) score += 10;
  return score;
}

function scoreCommunication(input: ScreeningInput): number {
  const cl = (input.coverLetter || "").trim();
  if (cl.length >= 200) return 10;
  if (cl.length >= 100) return 7;
  if (cl.length >= 40) return 5;
  return 2;
}

export function screenApplicant(input: ScreeningInput): ScreeningResult {
  const req = POSITION_REQUIREMENTS[input.position] || { minExp: 1, keywords: [] };
  const breakdown = {
    experience: scoreExperience(input, req),
    skills: scoreSkills(input, req),
    availability: scoreAvailability(input),
    logistics: scoreLogistics(input),
    communication: scoreCommunication(input),
  };
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = clamp(raw, 0, 100);

  const strengths: string[] = [];
  const concerns: string[] = [];

  if (breakdown.experience >= 20) strengths.push("Strong relevant experience");
  else if (breakdown.experience <= 10) concerns.push("Limited experience for this role");

  if (breakdown.skills >= 20) strengths.push("Skills match position requirements");
  else if (breakdown.skills <= 10) concerns.push("Few matching skills identified");

  if (breakdown.logistics >= 15) strengths.push("Has transport and insurance");
  else {
    if (!input.hasTransport) concerns.push("No reliable transportation");
    if (!input.hasInsurance) concerns.push("No liability insurance");
  }

  if (breakdown.availability >= 15) strengths.push("Good availability");
  if (breakdown.communication >= 7) strengths.push("Detailed cover letter provided");
  else concerns.push("Brief or missing cover letter");

  if (input.references) {
    try {
      const refs = JSON.parse(input.references);
      if (Array.isArray(refs) && refs.length >= 2) strengths.push("Multiple references provided");
      else concerns.push("Fewer than 2 references");
    } catch {
      concerns.push("References not in valid format");
    }
  } else {
    concerns.push("No references provided");
  }

  const recommendation: ScreeningResult["recommendation"] =
    score >= 75 ? "strong" : score >= 50 ? "moderate" : "weak";

  const summary = `Applicant scored ${score}/100 for ${input.position}. ` +
    `Experience: ${breakdown.experience}/25, Skills: ${breakdown.skills}/25, ` +
    `Availability: ${breakdown.availability}/20, Logistics: ${breakdown.logistics}/20, ` +
    `Communication: ${breakdown.communication}/10. Recommendation: ${recommendation}.`;

  return { score, summary, recommendation, breakdown, strengths, concerns };
}
