export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export interface OnboardingData {
  baseResume: string;
  professionalBio: string;
  fullName: string;
  targetRole: string;
  completed: boolean;
}

export interface AppliedJob {
  id: string;
  companyName: string;
  roleTitle: string;
  dateApplied: string;
  status?: "Applied" | "Interviewing" | "Offered" | "Rejected" | "Archived";
  atsScore?: number;
  jobDescription: string;
  companyDetails: string;
  resumeSourceUsed: "base" | "custom";
  customResumeText?: string;
  keyMatches: string[];
  adjustmentsMade: string;
  tailoredResume: string;
  coverLetter: string;
  hiringManagerEmail: string;
  followUpEmails: {
    id: string;
    requestContext: string;
    content: string;
    timestamp: string;
  }[];
}

export type AppTab = "chat" | "apply_job";

export interface WizardState {
  id?: string;
  currentStep: number;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  companyDetails: string;
  resumeSource: "base" | "custom";
  customResumeText: string;
  isLoading: boolean;
  error: string | null;
  // Generated items stored temporarily during wizard
  tailoredResume: string;
  keyMatches: string[];
  adjustmentsMade: string;
  coverLetter: string;
  hiringManagerEmail: string;
  atsScore?: number;
}
