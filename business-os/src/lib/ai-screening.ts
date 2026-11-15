// AI screening for 1099 contractor applicants.
// Scores 0-100 across 5 dimensions. Replace heuristic with LLM call via callLLM().

export interface ScreeningInput {
  position: string; experience: string; skills: string; availability: string;
  hasTransport: boolean; hasInsurance: boolean; coverLetter?: string; references?: string;
}

export interface ScreeningResult {
  score: number; summary: string; recommendation: "strong" | "moderate" | "weak";
  breakdown: { experience: number; skills: number; availability: number; logistics: number; communication: number };
  strengths: string[]; concerns: string[];
}

const POSITION_REQUIREMENTS: Record<string, { minExp: number; keywords: string[] }> = {
  "Floor Installer": { minExp: 2, keywords: ["flooring", "hardwood", "installation", "carpentry", "construction"] },
  "Court Striping Technician": { minExp: 1, keywords: ["striping", "painting", "athletics", "sports", "line marking"] },
  "Vinyl/Graphics Installer": { minExp: 1, keywords: ["vinyl", "wrap", "graphics", "signage", "installation"] },
  "Mural Painter": { minExp: 2, keywords: ["mural", "painting", "art", "fine art", "design"] },
  "General Laborer": { minExp: 0, keywords: ["construction", "labor", "physical", "outdoor"] },
  "Project Coordinator": { minExp: 1, keywords: ["coordination", "scheduling", "management", "admin", "project"] },
};

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function scoreExperience(yrs: number, minExp: number): number {
  if (yrs >= minExp + 3) return 25; if (yrs >= minExp + 1) return 20; if (yrs >= minExp) return 15; if (yrs >= minExp - 1) return 10; return 5;
}

function scoreSkills(skills: string, cl: string, keywords: string[]): number {
  const text = (skills + " " + cl).toLowerCase();
  const matched = keywords.filter((k) => text.includes(k));
  const ratio = matched.length / Math.max(keywords.length, 1);
  if (ratio >= 0.8) return 25; if (ratio >= 0.6) return 20; if (ratio >= 0.4) return 15; if (ratio >= 0.2) return 10; return 5;
}

function scoreAvailability(avail: string): number {
  const a = (avail || "").toLowerCase();
  if (a.includes("full") || a.includes("any") || a.includes("flex")) return 20;
  if (a.includes("part") || a.includes("weekend")) return 15;
  if (a.includes("seasonal") || a.includes("summer")) return 12;
  return 8;
}

function scoreLogistics(transport: boolean, insurance: boolean): number {
  let s = 0; if (transport) s += 10; if (insurance) s += 10; return s;
}

function scoreCommunication(cl: string): number {
  if (cl.length >= 200) return 10; if (cl.length >= 100) return 7; if (cl.length >= 40) return 5; return 2;
}

export function screenApplicant(input: ScreeningInput): ScreeningResult {
  const req = POSITION_REQUIREMENTS[input.position] || { minExp: 1, keywords: [] };
  const yrs = parseFloat(input.experience || "0") || 0;
  const breakdown = {
    experience: scoreExperience(yrs, req.minExp),
    skills: scoreSkills(input.skills || "", input.coverLetter || "", req.keywords),
    availability: scoreAvailability(input.availability || ""),
    logistics: scoreLogistics(!!input.hasTransport, !!input.hasInsurance),
    communication: scoreCommunication(input.coverLetter || ""),
  };
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = clamp(raw, 0, 100);
  const strengths: string[] = []; const concerns: string[] = [];
  if (breakdown.experience >= 20) strengths.push("Strong relevant experience"); else if (breakdown.experience <= 10) concerns.push("Limited experience for this role");
  if (breakdown.skills >= 20) strengths.push("Skills match position requirements"); else if (breakdown.skills <= 10) concerns.push("Few matching skills identified");
  if (breakdown.logistics >= 15) strengths.push("Has transport and insurance");
  else { if (!input.hasTransport) concerns.push("No reliable transportation"); if (!input.hasInsurance) concerns.push("No liability insurance"); }
  if (breakdown.availability >= 15) strengths.push("Good availability");
  if (breakdown.communication >= 7) strengths.push("Detailed cover letter"); else concerns.push("Brief or missing cover letter");
  if (input.references) { try { const refs = JSON.parse(input.references); if (Array.isArray(refs) && refs.length >= 2) strengths.push("Multiple references"); else concerns.push("Fewer than 2 references"); } catch { concerns.push("References not in valid format"); } } else concerns.push("No references provided");

  const recommendation: ScreeningResult["recommendation"] = score >= 75 ? "strong" : score >= 50 ? "moderate" : "weak";
  const summary = `Applicant scored ${score}/100 for ${input.position}. Experience: ${breakdown.experience}/25, Skills: ${breakdown.skills}/25, Availability: ${breakdown.availability}/20, Logistics: ${breakdown.logistics}/20, Communication: ${breakdown.communication}/10. Recommendation: ${recommendation}.`;
  return { score, summary, recommendation, breakdown, strengths, concerns };
}