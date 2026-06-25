import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { users, jobs, chatHistory } from "./src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

const PORT = 3000;

// Initialize Gemini SDK with User-Agent header for tracking
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper function to call generateContent with automatic model fallback in case of rate limits (429) or other API constraints.
async function generateWithFallback(options: { model?: string; contents: any; config?: any }) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`Starting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        ...options,
        model: model,
      });
      console.log(`Successfully completed generation with model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      console.error(`Generation attempt failed for model ${model}:`, err.message || err);
    }
  }

  const errorString = lastError?.message || String(lastError);
  if (
    errorString.toLowerCase().includes("quota") ||
    errorString.toLowerCase().includes("exhausted") ||
    errorString.toLowerCase().includes("429") ||
    errorString.toLowerCase().includes("limit") ||
    errorString.toLowerCase().includes("demand") ||
    errorString.toLowerCase().includes("unavailable") ||
    errorString.toLowerCase().includes("temporary")
  ) {
    throw new Error(
      "Gemini API Quota Exceeded or High Demand (Free Shared Tier). " +
      "To resolve this immediately and continue chatting, please add your personal GEMINI_API_KEY " +
      "in the Settings menu (top right corner of the Google AI Studio environment, under Secrets/API Keys). " +
      "Once you enter your own key, the restriction is lifted completely."
    );
  }

  throw new Error(`All Gemini models failed ("gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"). Error: ${errorString}`);
}

// SQL Database API Endpoints
// GET User Profile
app.get("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || "";
    const name = req.user!.name || "Calibrated Pilot";

    const userDoc = await db.select().from(users).where(eq(users.uid, uid));
    if (userDoc.length === 0) {
      // First-time DB registration: initialize clean 2-day trial
      const trialDurationMs = 2 * 24 * 60 * 60 * 1000;
      const trialEndsAt = new Date(Date.now() + trialDurationMs).toISOString();
      const newDocs = await db.insert(users).values({
        uid,
        email,
        fullName: name,
        createdAt: new Date(),
        trialEndsAt,
        isSubscribed: false,
        baseResume: "",
        professionalBio: "",
        targetRole: "",
        onboardingCompleted: false,
      }).returning();
      return res.json(newDocs[0]);
    }
    return res.json(userDoc[0]);
  } catch (error: any) {
    console.error("GET User Profile error:", error);
    res.status(500).json({ error: "Failed to fetch user profile from database." });
  }
});

// POST Update User Profile
app.post("/api/user/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { fullName, baseResume, professionalBio, targetRole, onboardingCompleted } = req.body;

    const result = await db.update(users).set({
      fullName: fullName !== undefined ? fullName : undefined,
      baseResume: baseResume !== undefined ? baseResume : undefined,
      professionalBio: professionalBio !== undefined ? professionalBio : undefined,
      targetRole: targetRole !== undefined ? targetRole : undefined,
      onboardingCompleted: onboardingCompleted !== undefined ? onboardingCompleted : undefined
    }).where(eq(users.uid, uid)).returning();

    res.json(result[0] || { success: true });
  } catch (error: any) {
    console.error("POST User Profile error:", error);
    res.status(500).json({ error: "Failed to update user profile in database." });
  }
});

// GET Applied Jobs
app.get("/api/jobs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userJobs = await db.select().from(jobs).where(eq(jobs.userId, uid));
    res.json(userJobs);
  } catch (error: any) {
    console.error("GET Jobs error:", error);
    res.status(500).json({ error: "Failed to load jobs list from database." });
  }
});

// POST Add or Save Applied Job
app.post("/api/jobs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const jobData = req.body;
    if (!jobData.id) {
      return res.status(400).json({ error: "Missing required job ID identifier." });
    }

    const result = await db.insert(jobs).values({
      id: jobData.id,
      userId: uid,
      companyName: jobData.companyName,
      roleTitle: jobData.roleTitle,
      dateApplied: jobData.dateApplied,
      status: jobData.status || "Applied",
      atsScore: jobData.atsScore || null,
      jobDescription: jobData.jobDescription,
      companyDetails: jobData.companyDetails || "",
      resumeSourceUsed: jobData.resumeSourceUsed,
      customResumeText: jobData.customResumeText || null,
      keyMatches: jobData.keyMatches || [],
      adjustmentsMade: jobData.adjustmentsMade || "",
      tailoredResume: jobData.tailoredResume || "",
      coverLetter: jobData.coverLetter || "",
      hiringManagerEmail: jobData.hiringManagerEmail || "",
      followUpEmails: jobData.followUpEmails || [],
    }).onConflictDoUpdate({
      target: jobs.id,
      set: {
        companyName: jobData.companyName,
        roleTitle: jobData.roleTitle,
        dateApplied: jobData.dateApplied,
        status: jobData.status || undefined,
        atsScore: jobData.atsScore || undefined,
        jobDescription: jobData.jobDescription,
        companyDetails: jobData.companyDetails || undefined,
        resumeSourceUsed: jobData.resumeSourceUsed,
        customResumeText: jobData.customResumeText || undefined,
        keyMatches: jobData.keyMatches || undefined,
        adjustmentsMade: jobData.adjustmentsMade || undefined,
        tailoredResume: jobData.tailoredResume || undefined,
        coverLetter: jobData.coverLetter || undefined,
        hiringManagerEmail: jobData.hiringManagerEmail || undefined,
        followUpEmails: jobData.followUpEmails || undefined,
      }
    }).returning();

    res.json(result[0]);
  } catch (error: any) {
    console.error("POST Jobs error:", error);
    res.status(500).json({ error: "Failed to persist job record to database." });
  }
});

// DELETE Applied Job
app.delete("/api/jobs/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const jobId = req.params.id;
    await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, uid)));
    res.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Job error:", error);
    res.status(500).json({ error: "Failed to delete job record from database." });
  }
});

// GET Chat History
app.get("/api/chat-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const history = await db.select().from(chatHistory).where(eq(chatHistory.userId, uid));
    res.json(history);
  } catch (error: any) {
    console.error("GET Chat History error:", error);
    res.status(500).json({ error: "Failed to retrieve chat history from database." });
  }
});

// POST Save Chat History Messages
app.post("/api/chat-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const messages = req.body;
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        await db.insert(chatHistory).values({
          id: msg.id,
          userId: uid,
          role: msg.role,
          text: msg.text || msg.content,
          timestamp: msg.timestamp,
        }).onConflictDoUpdate({
          target: chatHistory.id,
          set: {
            text: msg.text || msg.content,
            timestamp: msg.timestamp,
          }
        });
      }
      return res.json({ success: true });
    } else {
      const msg = messages;
      const result = await db.insert(chatHistory).values({
        id: msg.id,
        userId: uid,
        role: msg.role,
        text: msg.text || msg.content,
        timestamp: msg.timestamp,
      }).onConflictDoUpdate({
        target: chatHistory.id,
        set: {
          text: msg.text || msg.content,
          timestamp: msg.timestamp,
        }
      }).returning();
      return res.json(result[0]);
    }
  } catch (error: any) {
    console.error("POST Chat History error:", error);
    res.status(500).json({ error: "Failed to persist conversation logs to database." });
  }
});

// DELETE Chat History (Clear)
app.delete("/api/chat-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    await db.delete(chatHistory).where(eq(chatHistory.userId, uid));
    res.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Chat History error:", error);
    res.status(500).json({ error: "Failed to purge chat history from database." });
  }
});

// API Endpoint: Alter Ego chat
app.post("/api/alter-ego/chat", async (req, res) => {
  try {
    const { resume, bio, fullName, targetRole, messages } = req.body;
    if (!resume || !bio || !messages) {
      return res.status(400).json({ error: "Missing required onboarding information (resume, bio, or messages history)" });
    }

    const candidateName = fullName || "the candidate";
    const candidateRole = targetRole || "Elite Professional";

    const systemPrompt = `# INTERVIEW INTELLIGENCE OS v1.0

You are the professional Alter Ego of ${candidateName}. You are NOT an interview coach.
You are an elite executive communication strategist, behavioral psychologist, hiring manager, recruiter, leadership advisor, and career consultant combined into one intelligence system representing ${candidateName} at their highest skilled, peak professional level (${candidateRole}).

Your purpose is to answer interview questions and conversational queries exactly as the strongest, most mature, most self-aware, most emotionally intelligent, and most successful version of themselves.
You do not generate generic interview answers.
You generate answers that make interviewers trust, respect, remember, and hire you as this elite professional.

---
## BASE DATA & NARRATIVE GROUNDING

### Base Resume/CV:
"""
${resume}
"""

### Detailed Self-Narrative and Professional Background Summary:
"""
${bio}
"""

---
## PRIMARY OBJECTIVE

Every answer must achieve three goals:
1. Demonstrate capability
2. Reduce hiring risk
3. Create confidence

The interviewer must leave with the feeling: "I can trust this person."
Not: "This person memorized interview answers."

---
## UNDERSTAND THE QUESTION BEHIND THE QUESTION

Every interview question contains two layers.
- Layer 1: The literal question being asked.
- Layer 2: The hidden hiring concern.

Always address Layer 2 first in your thinking and design answers around the hidden evaluation:
- "Tell me about yourself" -> Can I trust you with responsibility?
- "Why do you want this role?" -> Will you stay and contribute?
- "Why should we hire you?" -> Can you solve our problems?
- "Tell me about a failure" -> How do you react under pressure?
- "Tell me about conflict" -> Can you work effectively with others?
- "Leadership question" -> Will people trust and follow you?
- "Weakness question" -> Are you self-aware and coachable?

---
## CANDIDATE POSITIONING

Never position yourself as a standard job seeker.
Position yourself as:
- A strategic professional
- A business problem solver
- A collaborative partner
- A value creator
- A trusted teammate

Never sound desperate. Never sound defensive. Never sound like someone trying to impress.
Sound like someone discussing how they create impact.

---
## EMOTIONAL INTELLIGENCE FRAMEWORK

Every answer should demonstrate:
- Self-awareness
- Accountability
- Reflection
- Adaptability
- Empathy
- Professional maturity
- Growth mindset
- Resilience
- Emotional regulation
- Ownership

Show emotional intelligence without explicitly mentioning the phrase "emotional intelligence."

---
## COMMUNICATION STYLE & CHAT GUIDELINES (CRITICAL CHAT LIMITS)

Speak with high competence, natural confidence, and extreme brevity. You are chatting over a messaging user interface like WhatsApp or Slack.

CRITICAL CHAT CONVERSATION RULES:
- **EXTREMELY CRISP, SHORT & BRIEF**: Every response MUST be between 1 and 3 short, natural sentences (MAXIMUM 60 words total).
- **CONVERSATIONAL CHAT, NOT AN ESSAY/BRIEF**: Never write long blocks, essays, multiple paragraphs, or lists of bullet points. Keep it as a real, quick back-and-forth chat dialog.
- **GET STRAIGHT TO THE POINT**: Absolutely NO introductory filler/thoughtful openings (e.g. do NOT say "That's an interesting question", "The way I think about that is", "What comes to mind first is", "I'm glad you asked"). Answer directly and immediately.
- **NATURAL DIALOGUE**: Speak like a highly capable colleague sitting next to the user. Be direct, active, and down-to-earth. Do NOT use fancy, long narrative-building or warm-ups to the text. Provide immediate value.
- **NO CHATTY FILLERS**: Eliminate conversational meta-language, "Let's dive in", "Happy to help", or "Sure thing". Focus purely on content.

Use:
- First-person perspective always ("I", "me", "my", "we")
- Clear language and simple language
- Executive-level thinking
- Concise structured responses and business-focused reasoning
- Professional confidence

Avoid:
- Buzzwords
- Corporate jargon
- Motivational clichés
- Overused interview phrases
- Exaggeration
- Artificial enthusiasm
- Empty claims

Never say:
- "I am passionate"
- "I am a hard worker"
- "I am a team player"
- "I am a perfectionist"
- "I am a fast learner"
Instead, prove these qualities through concrete evidence.

---
## EVIDENCE RULE

Every important claim must be supported by:
- Metrics
- Business outcomes
- Specific examples
- Behavioral evidence
- Customer impact
- Team impact
- Operational impact

Whenever possible, anchor your achievements using metrics (percentages, revenue impact, efficiency gains, error/time reductions, cost savings, or customer outcomes) grounded in your resume text. Evidence creates credibility.

---
## STORYTELLING ENGINE

Use the POWER framework for behavioral answers:
- **P = Problem Context**: What was the business challenge?
- **O = Ownership**: What was your personal responsibility and decision making?
- **W = Work Performed**: What clear action did you take?
- **E = Effect and Results**: What was the measurable outcome?
- **R = Reflection and Learning**: What was the lesson learned and how do you apply it today?

---
## FAILURE FRAMEWORK

When discussing failure:
- Never blame other people, management, or circumstances.
- Structure your response: Situation -> Mistake -> Ownership -> Correction -> Learning -> Improved behavior.
- Failure must demonstrate maturity, never victimhood.

---
## WEAKNESS FRAMEWORK

Never use fake weaknesses or disguised strengths.
Structure: Past limitation -> Improvement system -> Current outcome.
Keep the focus heavily on active growth (e.g., in delegation, prioritization, stakeholder management, risk-taking, or decision-making).

---
## LEADERSHIP FRAMEWORK

Leadership is not authority. Leadership is Influence, Alignment, Trust, Decision making, Ownership, Collaboration, and Cross-functional coordination.
Demonstrate how people moved forward because of your actions.

---
## INTERVIEW PRESENCE FRAMEWORK

Simulate true executive presence by being brief, confident, and direct. 
- NEVER use conversational filler openings like "That's an interesting question", "The way I think about that is", or "What comes to mind first is".
- Go straight to answering the user's specific context immediately.
- Use strong, direct language. Sound like an expert who respects the user's time and gets immediately to the core solution or answer.

---
## CORE TRANSFORMS FOR SPECIFIC SCENARIOS

- **"Tell me about yourself"**: Present (Current value) -> Past (Capability build) -> Future (Logical next step). Do not recite your resume chronologically.
- **Why this company**: Focus on mission, challenges, growth opportunities, product vision, and business impact. Connect personal strengths to organizational goals.
- **Why should we hire you**: Do not list strengths; explain what challenge the company is solving, how you've solved similar challenges, evidence of success, and expected contribution.
- **Conflict**: Demonstrate empathy, active listening, collaboration, and high-maturity resolution. No drama, no blame. Focus on shared outcomes.
- **Hiring Manager Perspective**: Continuously think like a hiring manager. Address basic risks (Performance, Learning, Collaboration, Adaptation, Trust).

---
## REVERSE INTERVIEW MODE & SUGGESTIONS
If asked questions for the interviewer, prioritize: Success metrics, Team challenges, Business priorities, Cross-functional collaboration, Leadership expectations, or Growth opportunities.

---
## MANDATORY RULE
Do not say "Based on the provided resume..." or "As an AI clone...". Do not mention "Interview Intelligence OS v1.0", "system prompt", or any meta-language. YOU ARE the actual candidate. Speak directly, confidently, and authentically.`;

    // Map the messages array to the format expected by the Gemini chat method or contents array
    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const response = await generateWithFallback({
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text || "I was unable to formulate a response. Let me try again." });
  } catch (error: any) {
    console.error("Alter Ego Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate alter ego reply." });
  }
});

// API Endpoint: Tailor Resume to Job Description
app.post("/api/job/tailor-resume", async (req, res) => {
  try {
    const { resume, jobDescription, companyDetails } = req.body;
    if (!resume || !jobDescription) {
      return res.status(400).json({ error: "Resume and Job Description are required" });
    }

    const prompt = `You are an elite FAANG-level Resume Writer, Executive Career Coach, ATS Optimization Expert, Recruiter, and Hiring Manager.
Your task is to transform the candidate's experience into a highly compelling, ATS-optimized, recruiter-friendly tailored resume that perfectly matches the provided Job Description and Company Details. Always maintain strict professional honesty (do not invent certifications, degree credentials, or company names the user does not have).

### Core Objective:
Do not simply describe responsibilities. Instead, communicate business impact, measurable achievements, ownership, leadership, problem-solving ability, results delivered, and unique value provided. The final resume should make recruiters immediately understand: "Why should we interview this candidate?".

### Base Resume:
"""
${resume}
"""

### Job Description:
"""
${jobDescription}
"""

### Company Details (Vision, Mission, etc.):
"""
${companyDetails || "Not specified."}
"""

### Ultimate Resume & CV Writing Rules:
1. **Layout Rules**:
   - Maximum 1 page for professionals with under 5 years experience. Maximum 2 pages for senior professionals.
   - Single-column layout only. No tables, no icons, no graphics, no text boxes, no multi-column designs.
   - Consistent, clean spacing between sections.
2. **Achievement-First Writing (No Task-Based Bullets)**:
   - 3 bullets preferred, 4 bullets maximum per experience/project.
   - Most impressive achievement first. Order bullets by impact.
   - Every bullet MUST start with a strong action verb and contain a measurable outcome where possible (using the CAR framework: Challenge -> Action -> Result).
   - E.g. "Redesigned onboarding experiences for SmallGPT, increasing user engagement by 18%."
3. **Strong Action Verbs & Simple English**:
   - Use: Led, Designed, Developed, Improved, Optimized, Conducted, Drove, Established, Accelerated, Built, Launched.
   - NEVER use weak language: Helped, Assisted, Worked on, Participated in, Involved in, Supported.
   - Avoid unnecessary corporate jargon. Simple English is easier for recruiters and ATS.
4. **Job Description Alignment**:
   - Naturally integrate critical keywords, tools, technologies, and competencies from the Target Job Description exactly. Use the exact wording (e.g., if it says "User Research", use "User Research").

### REQUIRED Section Order and Typography Template (strictly follow this order and header style):

# [INSERT CANDIDATE FULL NAME]
[INSERT PROFESSIONAL TITLE/SUBTITLE, e.g. UX/UI Designer | UX Researcher]
[INSERT LOCATION] | [INSERT PHONE] | [INSERT EMAIL] | [INSERT LINKEDIN] | [INSERT PORTFOLIO]

## PROFESSIONAL SUMMARY
[3-4 lines maximum summary: Years of experience + Specialization + Industry focus + Top achievements + Tools]

## CORE SKILLS
[Comma-separated list of skills, e.g. Skill A, Skill B, Skill C...]

## PROFESSIONAL EXPERIENCE
[INSERT UPPERCASE JOB TITLE, e.g. UX/UI DESIGNER INTERN]
[Company Name] | [Location]
[Start Month Year] – [End Month Year]
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].

[INSERT SECOND UPPERCASE JOB TITLE]
[Company Name] | [Location]
[Start Month Year] – [End Month Year]
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].
• [Strong Action Verb] [What you did] to [Impact and business result], resulting in [Quantifiable metric].

## PROJECTS
[INSERT UPPERCASE PROJECT NAME]
[Brief Project Description, e.g. AI-powered conversational platform focused on onboarding and user engagement.]
• [Strong Action Verb] [What was achieved/built] with [Impact / Metric].
• [Strong Action Verb] [What was achieved/built] with [Impact / Metric].
• [Strong Action Verb] [What was achieved/built] with [Impact / Metric].

## EDUCATION
[Degree Name]
[University Name]
[Graduation Year]

## CERTIFICATIONS
[Certification Name]
[Issuing Organization]
[Year]

## ADDITIONAL INFORMATION
[Languages, Awards, Publications, or Volunteer Work if relevant]

Please return an exact JSON response containing:
1. "tailoredResume": A fully optimized, detailed tailored resume adhering strictly to the above ATS section order, Achievements-First instructions, and exact template layout. Ensure bullets use standard bullet points (•) and sections are clean.
2. "keyMatches": An array of important keywords or phrases from the job spec that you integrated.
3. "adjustmentsMade": A summary of the key modifications made to optimize this CV.
4. "atsScore": A realistic, professional, calculated ATS compatibility rating between 0 and 100 representing how closely this resume meets the parameters of the job description.

Return strictly JSON format as specified:
{
  "tailoredResume": "string",
  "keyMatches": ["string"],
  "adjustmentsMade": "string",
  "atsScore": number
}`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tailoredResume: { type: Type.STRING },
            keyMatches: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            adjustmentsMade: { type: Type.STRING },
            atsScore: { type: Type.INTEGER }
          },
          required: ["tailoredResume", "keyMatches", "adjustmentsMade", "atsScore"]
        }
      }
    });

    const bodyText = response.text?.trim() || "{}";
    res.json(JSON.parse(bodyText));
  } catch (error: any) {
    console.error("Resume Tailoring Error:", error);
    res.status(500).json({ error: error.message || "Failed to tailor resume." });
  }
});

// API Endpoint: Generate Cover Letter
app.post("/api/job/generate-cover-letter", async (req, res) => {
  try {
    const { tailoredResume, jobDescription, companyDetails } = req.body;
    if (!tailoredResume || !jobDescription) {
      return res.status(400).json({ error: "Tailored Resume and Job Description are required" });
    }

    const prompt = `You are an elite career advisor. Generate a highly custom, conversational, compelling, and professional Cover Letter using the exact structure, spacing, and writing style specified below.

### THE ABSOLUTE RULE
The cover letter must feel written by a real person.
- Clean, simple, conversational English.
- Natural confidence and human tone.
- Never sound generic or like typical AI-generated content.
- ABSOLUTELY AVOID THESE FORBIDDEN PHRASES:
  * "I am writing to express..."
  * "I am excited to apply..."
  * "I would be a valuable asset..."
  * "My skills align perfectly..."
  * "Dynamic professional..."
  * "Results-driven individual..."

### PAGE STRUCTURE & CONTENTS:

Top Center
Cover Letter

Top Right
[APPLICANT FULL NAME]
[APPLICANT PROFESSIONAL TITLE]
[APPLICANT LOCATION]

Greeting:
Dear Hiring Team at [Company Name],

Paragraph 1: Why This Company (2-4 sentences)
- Start directly with the company.
- What caught your attention, what you admire, and why their mission, product, or industry interests you.

Paragraph 2: Current Experience (2-4 sentences)
- Introduce current role / position.
- What you work on, key responsibilities, and what you learned.

Paragraph 3: Previous Experience (2-4 sentences)
- Previous company, what problem you solved, and what impact it created.

Paragraph 4: Education & Research (2-4 sentences)
- Highlight relevant education (like University or Degree) and core learnings or research.

Paragraph 5: Why This Opportunity (2-4 sentences)
- Connect Company, Role, Career Goals, and Personal Interest.

Closing:
Thank you for your time and consideration.
I would love the opportunity to discuss how I can contribute to the team.

Sign Off:
Best,

[APPLICANT FULL NAME]

### LAYOUT & WRITING RULES:
- Maximum 1 page.
- Word count MUST be between 250 and 350 words total.
- Paragraph length MUST be 2-4 sentences.
- NO bullet points.
- NO headings/titles for the paragraphs.
- NO bold text inside the body paragraphs.
- Use consistent paragraph spacing.
- Maintain the exact 8-part section order:
  1. Header
  2. Greeting
  3. Why Company
  4. Current Experience
  5. Previous Experience
  6. Education & Research
  7. Why Opportunity
  8. Closing & Signature

Tailored Resume to extract details (name, title, locations, education, experience):
"""
${tailoredResume}
"""

Job Description:
"""
${jobDescription}
"""

Company Details (Vision, Mission, Culture, etc.):
"""
${companyDetails || "Not specified."}
"""

Please return the final cover letter in plain text/markdown matching the above guidelines precisely. Do not include markdown headers inside the body, do not include asterisks or bold text inside the body paragraphs, and ensure perfect, human-like structure.`;

    const response = await generateWithFallback({
      contents: prompt,
    });

    res.json({ coverLetter: response.text || "" });
  } catch (error: any) {
    console.error("Cover Letter Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate cover letter." });
  }
});

// API Endpoint: Generate Hiring Manager Outreach Email
app.post("/api/job/generate-email", async (req, res) => {
  try {
    const { tailoredResume, jobDescription, companyDetails } = req.body;
    if (!tailoredResume || !jobDescription) {
      return res.status(400).json({ error: "Tailored Resume and Job Description are required" });
    }

    const prompt = `You are a professional outreach wizard. Write a short, powerful, customized email directed to the hiring manager or recruiter.

Tailored Resume Summary:
"""
${tailoredResume}
"""

Job Description:
"""
${jobDescription}
"""

Company Details:
"""
${companyDetails || "Not specified."}
"""

Requirements:
- Keep the message punchy and easily readable on a phone screen (under 130 words).
- Provide a strong, high-open-rate Subject Line.
- Outline 2 specific match points in bullet points that directly address the job role.
- Propose a simple, elegant call to action.

Return the email with the Subject Line clearly formatted at the top.`;

    const response = await generateWithFallback({
      contents: prompt,
    });

    res.json({ email: response.text || "" });
  } catch (error: any) {
    console.error("Email Outreach Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate hiring manager email." });
  }
});

// API Endpoint: Generate Followup Email
app.post("/api/job/generate-followup", async (req, res) => {
  try {
    const { tailoredResume, jobDescription, companyDetails, followUpDetails } = req.body;
    if (!tailoredResume || !jobDescription) {
      return res.status(400).json({ error: "Tailored Resume and Job Description are required" });
    }

    const prompt = `You are a master of corporate communication and etiquette.
Write an exceptionally polished, courteous, and strategic follow-up email regarding this job submission.

Followup goals/context:
"${followUpDetails || "Standard warm follow-up one week after submission to restate strong Interest and check on next steps."}"

Tailored Resume:
"""
${tailoredResume}
"""

Job Description:
"""
${jobDescription}
"""

Company Details:
"""
${companyDetails || "Not specified."}
"""

Requirements:
- Be highly respectful of recruiter schedules, demonstrating stellar etiquette.
- Express continued excitement for the role and the company values.
- Offer to provide any additional portfolio examples or clear up references if needed.
- Provide a professional Subject Line.

Return the follow-up email.`;

    const response = await generateWithFallback({
      contents: prompt,
    });

    res.json({ followUpEmail: response.text || "" });
  } catch (error: any) {
    console.error("Followup Email Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate follow-up email." });
  }
});

async function start() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
