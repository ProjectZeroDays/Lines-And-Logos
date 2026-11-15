// Document templates for 1099 contractor onboarding.
// These are the legally-required + company-required documents.

export interface DocTemplate {
  type: string;
  title: string;
  content: string; // HTML
}

export const DOCUMENT_TEMPLATES: DocTemplate[] = [
  {
    type: "w9",
    title: "Form W-9 — Request for Taxpayer Identification Number",
    content: `
      <h2>Form W-9 (Rev. March 2024) — Request for Taxpayer Identification Number and Certification</h2>
      <p><strong>Lines & Logos — Memphis, TN</strong></p>
      <p>As a 1099 independent contractor, you are required to provide a completed W-9 so we can issue your 1099-NEC at year end.</p>
      <h3>Part I — Taxpayer Identification Number (TIN)</h3>
      <p>Please provide your legal name, business name (if applicable), and TIN (SSN or EIN). Enter this information in the secure form below.</p>
      <div style="background:#f5f7fa;padding:16px;border-radius:6px;margin:16px 0;">
        <p><strong>Name (as shown on your tax return):</strong> {{firstName}} {{lastName}}</p>
        <p><strong>Business name (if different):</strong> ____________________</p>
        <p><strong>Federal tax classification:</strong> Individual/sole proprietor &#9744; C Corp &#9744; S Corp &#9744; Partnership &#9744; Trust/Estate &#9744; LLC &#9744; Other</p>
        <p><strong>Address:</strong> {{address}}, {{city}}, {{state}} {{zip}}</p>
        <p><strong>TIN (SSN or EIN):</strong> ___-__-____  (last 4 only stored for security; full TIN collected via secure channel)</p>
      </div>
      <h3>Part II — Certification</h3>
      <p>Under penalties of perjury, I certify that:</p>
      <ol>
        <li>The number shown on this form is my correct taxpayer identification number.</li>
        <li>I am not subject to backup withholding because: (a) I am exempt, (b) I have not been notified by the IRS that I am subject to backup withholding, or (c) the IRS has notified me that I am no longer subject to backup withholding.</li>
        <li>I am a U.S. citizen or other U.S. person.</li>
        <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
      </ol>
      <p><em>Certification instructions: You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return.</em></p>
      <p style="margin-top:24px;"><strong>Signature:</strong> ____________________ &nbsp;&nbsp; <strong>Date:</strong> __________</p>
    `,
  },
  {
    type: "ack1099",
    title: "1099-NEC Acknowledgment & Independent Contractor Agreement",
    content: `
      <h2>Independent Contractor Acknowledgment & 1099-NEC Agreement</h2>
      <p><strong>Lines & Logos — Memphis, TN</strong></p>
      <p><strong>Contractor:</strong> {{firstName}} {{lastName}} &nbsp;&nbsp; <strong>Position:</strong> {{position}}</p>
      <h3>1. Independent Contractor Status</h3>
      <p>You are engaged as an independent contractor (1099), not an employee. You are responsible for your own taxes, insurance, and business expenses. Lines & Logos will issue a Form 1099-NEC for payments totaling $600 or more in a calendar year.</p>
      <h3>2. Scope of Work</h3>
      <p>You will perform services as described in the Job Description & Scope of Work document, on an as-needed basis. You control how, when, and where work is performed, subject to agreed deadlines and quality standards.</p>
      <h3>3. Compensation</h3>
      <p>Payment is per project / per hour as agreed in writing for each assignment. Invoices must be submitted within 7 days of completion. Payment terms: Net 15.</p>
      <h3>4. Tax Responsibility</h3>
      <p>You are solely responsible for all federal, state, and local taxes, including self-employment tax. Lines & Logos does not withhold taxes. You should consult a tax professional regarding quarterly estimated payments.</p>
      <h3>5. Insurance & Liability</h3>
      <p>You are responsible for your own general liability insurance and any required licenses. You must provide proof of insurance before starting work on client sites.</p>
      <h3>6. Confidentiality</h3>
      <p>You agree to keep client information, pricing, and project details confidential. You may not use Lines & Logos client lists for your own business.</p>
      <h3>7. Non-Compete (Limited)</h3>
      <p>During engagement and for 6 months after, you agree not to directly solicit Lines & Logos clients for competing facility-branding services.</p>
      <h3>8. Termination</h3>
      <p>Either party may terminate this agreement with 14 days written notice. Outstanding invoices for completed work remain payable.</p>
      <p style="margin-top:24px;"><strong>I have read and agree to the terms above:</strong></p>
      <p><strong>Signature:</strong> ____________________ &nbsp;&nbsp; <strong>Date:</strong> __________</p>
    `,
  },
  {
    type: "jobdesc",
    title: "Job Description & Scope of Work",
    content: `
      <h2>Job Description & Scope of Work</h2>
      <p><strong>Lines & Logos — Memphis, TN</strong></p>
      <p><strong>Position:</strong> {{position}} (1099 Independent Contractor)</p>
      <p><strong>Reports to:</strong> Operations Manager, Lines & Logos</p>
      <p><strong>Location:</strong> Memphis metro + Mid-South (0–400 mi radius); travel required</p>
      <h3>Overview</h3>
      <p>Lines & Logos is a one-stop facility branding and athletic surface company serving schools, churches, YMCAs, parks departments, and private institutions. As a 1099 contractor, you will be engaged on a per-project basis to deliver high-quality work across our service catalog.</p>
      <h3>Services You May Be Engaged For</h3>
      <ul>
        <li>Gym floor refinishing (sand & refinish, screen & recoat)</li>
        <li>Court striping (basketball, volleyball, pickleball)</li>
        <li>Center-court / mascot logo painting</li>
        <li>Wall wraps & vinyl graphics installation</li>
        <li>Window graphics installation</li>
        <li>Exterior signage installation</li>
        <li>Donor / sponsor wall fabrication & install</li>
        <li>Parking lot striping & sealcoating</li>
        <li>Playground markings</li>
        <li>Fleet / vehicle graphics</li>
        <li>Mural painting</li>
        <li>House / building paint touchup</li>
      </ul>
      <h3>Requirements</h3>
      <ul>
        <li>Reliable transportation to job sites</li>
        <li>General liability insurance ($1M minimum)</li>
        <li>Ability to work independently and as part of a crew</li>
        <li>Attention to detail and quality craftsmanship</li>
        <li>Professional demeanor on client sites (schools, churches, government facilities)</li>
        <li>Background check clearance (required for school access)</li>
      </ul>
      <h3>Compensation</h3>
      <p>Per project / per hour as agreed in writing for each assignment. Invoices submitted within 7 days of completion; payment Net 15.</p>
      <h3>Schedule</h3>
      <p>Peak season: May–August (summer install window). Off-season: maintenance, smaller projects, sales support. Flexible scheduling based on project availability.</p>
      <p style="margin-top:24px;"><strong>I have read and understand the job description and scope of work:</strong></p>
      <p><strong>Signature:</strong> ____________________ &nbsp;&nbsp; <strong>Date:</strong> __________</p>
    `,
  },
  {
    type: "safety",
    title: "Safety & Compliance Agreement",
    content: `
      <h2>Safety & Compliance Agreement</h2>
      <p><strong>Lines & Logos — Memphis, TN</strong></p>
      <p><strong>Contractor:</strong> {{firstName}} {{lastName}} &nbsp;&nbsp; <strong>Position:</strong> {{position}}</p>
      <h3>1. General Safety</h3>
      <p>You agree to follow all OSHA safety standards, Lines & Logos safety procedures, and client-site safety rules. You must wear appropriate PPE (safety glasses, hearing protection, gloves, etc.) at all times on job sites.</p>
      <h3>2. Chemical Safety</h3>
      <p>You will handle paints, solvents, adhesives, and floor finishes per SDS (Safety Data Sheet) guidelines. SDS sheets are available on-site and in the Lines & Logos shared drive.</p>
      <h3>3. Fall Protection</h3>
      <p>When working at heights (ladders, scaffolding, lifts), you must use fall protection equipment and follow the Lines & Logos Fall Protection Plan.</p>
      <h3>4. Electrical Safety</h3>
      <p>Lockout/tagout (LOTO) procedures must be followed when working near electrical equipment. Only qualified personnel may perform electrical work.</p>
      <h3>5. Client-Site Rules</h3>
      <p>You agree to follow all client-site rules, including sign-in procedures, restricted areas, and hours of access. Schools require background checks — you must pass before working on any school campus.</p>
      <h3>6. Incident Reporting</h3>
      <p>All injuries, near-misses, and property damage must be reported to the Lines & Logos Operations Manager within 24 hours. Do not attempt to hide or minimize incidents.</p>
      <h3>7. Vehicle & Equipment Safety</h3>
      <p>Company vehicles and equipment must be operated safely and maintained per manufacturer guidelines. Personal vehicles used for company business must be insured.</p>
      <h3>8. Substance Policy</h3>
      <p>Zero tolerance for alcohol, drugs, or impairment on job sites. Violation results in immediate termination of engagement.</p>
      <p style="margin-top:24px;"><strong>I have read and agree to the safety and compliance terms:</strong></p>
      <p><strong>Signature:</strong> ____________________ &nbsp;&nbsp; <strong>Date:</strong> __________</p>
    `,
  },
  {
    type: "offer",
    title: "Offer Letter — 1099 Contractor Engagement",
    content: `
      <h2>Offer of Engagement — Independent Contractor</h2>
      <p><strong>Lines & Logos — Memphis, TN</strong></p>
      <p><strong>Date:</strong> {{date}}</p>
      <p><strong>To:</strong> {{firstName}} {{lastName}}</p>
      <p><strong>Position:</strong> {{position}} (1099 Independent Contractor)</p>
      <h3>Congratulations!</h3>
      <p>We are pleased to offer you engagement as an independent contractor with Lines & Logos. Your application has been reviewed and approved by our team.</p>
      <h3>Terms of Engagement</h3>
      <ul>
        <li><strong>Role:</strong> {{position}}</li>
        <li><strong>Engagement type:</strong> 1099 Independent Contractor (per-project)</li>
        <li><strong>Compensation:</strong> Per project / per hour as agreed in writing for each assignment</li>
        <li><strong>Payment terms:</strong> Net 15 from invoice date</li>
        <li><strong>Start date:</strong> Upon completion of onboarding documents</li>
        <li><strong>Duration:</strong> Ongoing, as-needed engagement</li>
      </ul>
      <h3>Next Steps</h3>
      <ol>
        <li>Review and sign all onboarding documents (link provided separately)</li>
        <li>Provide proof of general liability insurance</li>
        <li>Complete background check (required for school access)</li>
        <li>Submit W-9 and 1099 acknowledgment</li>
      </ol>
      <p>Once all documents are signed and verified, you will be added to our active contractor roster and eligible for project assignments.</p>
      <p>Welcome to the team!</p>
      <p style="margin-top:24px;"><strong>Lines & Logos</strong><br/>Memphis, TN</p>
      <p style="margin-top:24px;"><strong>Contractor acknowledgment:</strong></p>
      <p><strong>Signature:</strong> ____________________ &nbsp;&nbsp; <strong>Date:</strong> __________</p>
    `,
  },
];

export function getDocTemplate(type: string, vars: Record<string, string>): DocTemplate | undefined {
  const tmpl = DOCUMENT_TEMPLATES.find((d) => d.type === type);
  if (!tmpl) return undefined;
  let content = tmpl.content;
  for (const [key, val] of Object.entries(vars)) {
    content = content.replace(new RegExp(`{{${key}}}`, "g"), val);
  }
  return { type: tmpl.type, title: tmpl.title, content };
}

export function getAllDocTypes(): string[] {
  return DOCUMENT_TEMPLATES.map((d) => d.type);
}
