import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

// Define the users table, mapped to Firestore properties but persisted in Cloud SQL
export const users = pgTable("users", {
  uid: text("uid").primaryKey(), // Firebase Auth UID
  email: text("email").notNull(),
  fullName: text("full_name").default("Calibrated Pilot"),
  createdAt: timestamp("created_at").defaultNow(),
  trialEndsAt: text("trial_ends_at"),
  isSubscribed: boolean("is_subscribed").default(false),
  // Onboarding data
  baseResume: text("base_resume").default(""),
  professionalBio: text("professional_bio").default(""),
  targetRole: text("target_role").default(""),
  onboardingCompleted: boolean("onboarding_completed").default(false),
});

// Define the jobs table to persist applied & tailored jobs
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(), // UUID generated on client or server
  userId: text("user_id").references(() => users.uid).notNull(),
  companyName: text("company_name").notNull(),
  roleTitle: text("role_title").notNull(),
  dateApplied: text("date_applied").notNull(),
  status: text("status").default("Applied"), // "Applied" | "Interviewing" | "Offered" | "Rejected" | "Archived"
  atsScore: integer("ats_score"),
  jobDescription: text("job_description").notNull(),
  companyDetails: text("company_details").default(""),
  resumeSourceUsed: text("resume_source_used").notNull(), // "base" | "custom"
  customResumeText: text("custom_resume_text"),
  keyMatches: jsonb("key_matches").$type<string[]>().default([]),
  adjustmentsMade: text("adjustments_made").default(""),
  tailoredResume: text("tailored_resume").default(""),
  coverLetter: text("cover_letter").default(""),
  hiringManagerEmail: text("hiring_manager_email").default(""),
  followUpEmails: jsonb("follow_up_emails").$type<{
    id: string;
    requestContext: string;
    content: string;
    timestamp: string;
  }[]>().default([]),
});

// Define the chat messages table
export const chatHistory = pgTable("chat_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid).notNull(),
  role: text("role").notNull(), // "user" | "model"
  text: text("text").notNull(),
  timestamp: text("timestamp").notNull(),
});
