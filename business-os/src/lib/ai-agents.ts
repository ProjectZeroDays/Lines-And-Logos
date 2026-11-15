// AI Agent utilities for Business OS.
// Supports: OpenAI (OPENAI_API_KEY) or Anthropic (ANTHROPIC_API_KEY) for LLM-powered agents.
// Falls back to heuristic logic if no API key configured.

export async function callLLM(prompt: string, systemPrompt?: string): Promise<string | null> {
  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (e) { console.error("OpenAI error:", e); }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
          max_tokens: 500,
          system: systemPrompt || "You are a helpful business assistant.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text || null;
      }
    } catch (e) { console.error("Anthropic error:", e); }
  }

  return null; // Fallback to heuristic
}

// ========== Lead Scoring Agent ==========
export function leadScoreAgent(lead: { company: string; type: string; source: string; notes?: string }): { score: number; tier: string; summary: string } {
  let score = 40;
  const text = (lead.notes || "").toLowerCase();
  if (lead.type === "school-district") score += 20;
  if (lead.type === "private-school") score += 15;
  if (lead.type === "church") score += 12;
  if (lead.type === "ymca") score += 15;
  if (lead.type === "parks") score += 10;
  if (lead.source === "referral") score += 15;
  if (lead.source === "inbound") score += 10;
  if (text.includes("bond") || text.includes("capital") || text.includes("renovation")) score += 10;
  if (text.includes("budget") || text.includes("funding")) score += 5;
  score = Math.min(100, Math.max(0, score));
  const tier = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";
  return { score, tier, summary: `Lead scored ${score}/100 (${tier}) for ${lead.company}. Source: ${lead.source}, Type: ${lead.type}.` };
}

export async function leadScoreAgentAsync(lead: { company: string; type: string; source: string; notes?: string }): Promise<{ score: number; tier: string; summary: string }> {
  const llm = await callLLM(
    `Score this lead 0-100 for a Memphis-based facility branding/athletic surface company. Company: ${lead.company}, Type: ${lead.type}, Source: ${lead.source}, Notes: ${lead.notes || "none"}. Return JSON: {"score": N, "tier": "hot/warm/cold", "summary": "one sentence"}`,
    "You are a B2B lead scoring agent. Return only valid JSON."
  );
  if (llm) {
    try {
      const parsed = JSON.parse(llm.replace(/```json|```/g, "").trim());
      return { score: parsed.score || 50, tier: parsed.tier || "warm", summary: parsed.summary || "LLM-scored lead." };
    } catch { /* fall through */ }
  }
  return leadScoreAgent(lead);
}

// ========== Job Dispatch Agent ==========
export function jobDispatchAgent(job: { type: string; location?: string; crewDays?: number }, contractors: { id: string; name: string; skills: string; location: string; available: boolean }[]): string | null {
  const eligible = contractors.filter((c) => c.available && c.skills.toLowerCase().includes(job.type.split("-")[0]));
  if (eligible.length === 0) return null;
  return eligible[0].id;
}

// ========== Invoice Reminder Agent ==========
export function invoiceReminderAgent(daysOverdue: number): { type: string; tone: string; message: string } {
  if (daysOverdue <= 0) return { type: "none", tone: "none", message: "" };
  if (daysOverdue <= 7) return { type: "friendly", tone: "friendly", message: "Friendly reminder: your invoice is due. Let us know if you have any questions!" };
  if (daysOverdue <= 14) return { type: "firm", tone: "firm", message: "Your invoice is now 2 weeks overdue. Please remit payment at your earliest convenience." };
  return { type: "final", tone: "final", message: "FINAL NOTICE: Your invoice is significantly overdue. Please contact us immediately to resolve." };
}

// ========== Health Score Agent ==========
export function healthScoreAgent(account: { lastTouch?: Date; hasOverdueInvoice: boolean; jobCount: number; nps?: number }): { score: number; health: string; risks: string[] } {
  let score = 50;
  const risks: string[] = [];
  if (account.lastTouch) {
    const daysSince = (Date.now() - new Date(account.lastTouch).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 90) { score -= 20; risks.push("No contact in 90+ days"); }
    else if (daysSince > 60) { score -= 10; risks.push("No contact in 60+ days"); }
    else score += 10;
  } else { score -= 15; risks.push("Never contacted"); }
  if (account.hasOverdueInvoice) { score -= 25; risks.push("Has overdue invoice"); }
  if (account.jobCount > 0) score += 15;
  if (account.nps && account.nps >= 9) score += 15;
  if (account.nps && account.nps <= 6) { score -= 15; risks.push("Low NPS"); }
  score = Math.min(100, Math.max(0, score));
  const health = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  return { score, health, risks };
}

// ========== Competitor Watch Agent ==========
export function competitorWatchAgent(changes: string[]): { summary: string; recommendation: string } {
  if (changes.length === 0) return { summary: "No changes detected this week.", recommendation: "No action needed." };
  return {
    summary: `Detected ${changes.length} change(s): ${changes.join("; ")}.`,
    recommendation: "Review changes and adjust positioning if needed. Consider highlighting our bundled advantage in next outreach.",
  };
}

// ========== Daily Ops Agent ==========
export function dailyOpsAgent(context: { pendingLeads: number; overdueInvoices: number; behindScheduleJobs: number; todayTasks: number }): string {
  const lines = ["=== DAILY OPERATIONS BRIEF ===", `Pending leads: ${context.pendingLeads}`, `Overdue invoices: ${context.overdueInvoices}`, `Behind-schedule jobs: ${context.behindScheduleJobs}`, `Today's tasks: ${context.todayTasks}`, ""];
  if (context.overdueInvoices > 0) lines.push("⚠️ ACTION: Follow up on overdue invoices");
  if (context.behindScheduleJobs > 0) lines.push("⚠️ ACTION: Check behind-schedule jobs");
  if (context.pendingLeads > 5) lines.push("⚠️ ACTION: Triage pending leads");
  if (lines.length === 6) lines.push("✅ All clear — no urgent actions needed");
  return lines.join("\n");
}

// ========== Job Status Update Agent ==========
export async function jobStatusUpdateAgent(jobTitle: string, status: string, clientName: string): Promise<string> {
  const llm = await callLLM(
    `Draft a short, friendly project update for ${clientName} about their project "${jobTitle}" which is now in status "${status}". Write in the voice of a Memphis-based facility branding company owner. Keep it under 3 sentences. Include what's happening and what's next.`,
    "You are a business owner writing a project update to a client. Be warm, professional, and concise."
  );
  if (llm) return llm;
  const statusMessages: Record<string, string> = {
    "scheduled": "Your project has been scheduled. Our crew will arrive on the scheduled date. We'll send a reminder 24 hours before.",
    "in-progress": "Work is underway on your project. Our crew is on-site and making great progress. We'll keep you updated on milestones.",
    "complete": "Your project is complete! Our crew has finished all work. We'll schedule a final walkthrough at your convenience.",
    "invoiced": "Your project is complete and an invoice has been sent. Thank you for your business!",
  };
  return statusMessages[status] || `Your project "${jobTitle}" status has been updated to: ${status}.`;
}

// ========== Content Repurposing Agent ==========
export async function contentRepurposeAgent(sourceContent: string, platform: string): Promise<string> {
  const llm = await callLLM(
    `Repurpose the following content into a ${platform} post. Keep it engaging, professional, and under 280 characters for Twitter, under 1300 for LinkedIn, under 2200 for Facebook, under 2200 for Instagram. Include relevant hashtags.\n\nContent: ${sourceContent}`,
    "You are a social media content creator for a Memphis-based facility branding company. Write engaging posts."
  );
  if (llm) return llm;
  return sourceContent.slice(0, 200) + "... #MemphisBusiness #FacilityBranding";
}

// ========== Competitor Analysis Agent ==========
export async function competitorAnalysisAgent(competitor: string, changes: string[]): Promise<string> {
  const llm = await callLLM(
    `Analyze these changes from competitor ${competitor}: ${changes.join("; ")}. As a Memphis-based facility branding company, what's the impact and what should we do?`,
    "You are a competitive intelligence analyst. Be concise and actionable."
  );
  if (llm) return llm;
  return competitorWatchAgent(changes).recommendation;
}