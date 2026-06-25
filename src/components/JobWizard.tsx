import React, { useState } from "react";
import { 
  Briefcase, Plus, FileText, Globe, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, 
  Download, Mail, Send, Trash2, Calendar, ChevronRight, AlertCircle, RefreshCw, Layers, FileDown, Loader2, MoreHorizontal, Edit, Copy,
  Home
} from "lucide-react";
import { AppliedJob, OnboardingData, WizardState } from "../types";
import ReactMarkdown from "react-markdown";
import { downloadResumeAsPDF, parseMarkdownToATSResume, downloadCoverLetterAsPDF, parseMarkdownToCoverLetter } from "../utils/pdfGenerator";

interface JobWizardProps {
  onboarding: OnboardingData;
  jobs: AppliedJob[];
  setJobs: React.Dispatch<React.SetStateAction<AppliedJob[]>>;
}

const getStatusClasses = (status: string) => {
  switch (status) {
    case "Interviewing":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "Offered":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "Rejected":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "Archived":
      return "bg-neutral-800 text-neutral-400 border-neutral-700/60";
    default: // "Applied"
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  }
};

const INITIAL_WIZARD_STATE: WizardState = {
  currentStep: 1,
  companyName: "",
  roleTitle: "",
  jobDescription: "",
  companyDetails: "",
  resumeSource: "base",
  customResumeText: "",
  isLoading: false,
  error: null,
  tailoredResume: "",
  keyMatches: [],
  adjustmentsMade: "",
  coverLetter: "",
  hiringManagerEmail: "",
};

export default function JobWizard({ onboarding, jobs, setJobs }: JobWizardProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [selectedJob, setSelectedJob] = useState<AppliedJob | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [followUpResult, setFollowUpResult] = useState<string | null>(null);
  const [isGeneratingFollowup, setIsGeneratingFollowup] = useState(false);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [isEditingSelectedJob, setIsEditingSelectedJob] = useState(false);
  const [detailModalTab, setDetailModalTab] = useState<"info" | "cv" | "cover" | "email" | "followups">("info");
  const [cvSubTab, setCvSubTab] = useState<"preview" | "edit">("preview");
  const [coverSubTab, setCoverSubTab] = useState<"preview" | "edit">("preview");
  const [emailSubTab, setEmailSubTab] = useState<"preview" | "edit">("preview");
  
  const [editedResume, setEditedResume] = useState("");
  const [editedCoverLetter, setEditedCoverLetter] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [editedJobDesc, setEditedJobDesc] = useState("");
  const [editedCompanyDetails, setEditedCompanyDetails] = useState("");
  const [editedCompanyName, setEditedCompanyName] = useState("");
  const [editedRoleTitle, setEditedRoleTitle] = useState("");
  const [editedStatus, setEditedStatus] = useState<"Applied" | "Interviewing" | "Offered" | "Rejected" | "Archived">("Applied");

  const [isRegeneratingResume, setIsRegeneratingResume] = useState(false);
  const [isRegeneratingCover, setIsRegeneratingCover] = useState(false);
  const [isRegeneratingEmail, setIsRegeneratingEmail] = useState(false);
  const [wizardTab, setWizardTab] = useState<"preview" | "edit">("preview");
  const [coverTab, setCoverTab] = useState<"preview" | "edit">("preview");
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  React.useEffect(() => {
    if (selectedJob) {
      setEditedResume(selectedJob.tailoredResume || "");
      setEditedCoverLetter(selectedJob.coverLetter || "");
      setEditedEmail(selectedJob.hiringManagerEmail || "");
      setEditedJobDesc(selectedJob.jobDescription || "");
      setEditedCompanyDetails(selectedJob.companyDetails || "");
      setEditedCompanyName(selectedJob.companyName || "");
      setEditedRoleTitle(selectedJob.roleTitle || "");
      setEditedStatus(selectedJob.status || "Applied");
      setDetailModalTab("info");
      setCvSubTab("preview");
      setCoverSubTab("preview");
      setEmailSubTab("preview");
    } else {
      setIsEditingSelectedJob(false);
    }
  }, [selectedJob]);

  // Handle global click to close dropdown menus
  React.useEffect(() => {
    const handleGlobalClick = () => {
      setActiveDropdownId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleSaveEditedArtifacts = () => {
    if (!selectedJob) return;
    const updatedJob: AppliedJob = {
      ...selectedJob,
      companyName: editedCompanyName,
      roleTitle: editedRoleTitle,
      status: editedStatus,
      jobDescription: editedJobDesc,
      companyDetails: editedCompanyDetails,
      tailoredResume: editedResume,
      coverLetter: editedCoverLetter,
      hiringManagerEmail: editedEmail,
    };
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
    setSelectedJob(updatedJob);
    alert("Saved all edited text contents successfully.");
  };

  const handleRegenerateSingleResume = async () => {
    if (!selectedJob) return;
    setIsRegeneratingResume(true);
    try {
      const sourceText = selectedJob.resumeSourceUsed === "base" ? onboarding.baseResume : (selectedJob.customResumeText || onboarding.baseResume);
      const resVal = await fetch("/api/job/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceText,
          jobDescription: editedJobDesc || selectedJob.jobDescription,
          companyDetails: editedCompanyDetails || selectedJob.companyDetails,
        }),
      });
      if (!resVal.ok) throw new Error("Resume tailoring failed.");
      const data = await resVal.json();
      setEditedResume(data.tailoredResume);
      
      const updatedJob: AppliedJob = {
        ...selectedJob,
        companyName: editedCompanyName,
        roleTitle: editedRoleTitle,
        status: editedStatus,
        jobDescription: editedJobDesc,
        companyDetails: editedCompanyDetails,
        tailoredResume: data.tailoredResume,
        keyMatches: data.keyMatches || [],
        adjustmentsMade: data.adjustmentsMade || "",
        atsScore: data.atsScore,
      };
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
    } catch (err: any) {
      alert(`Error regenerating resume: ${err.message}`);
    } finally {
      setIsRegeneratingResume(false);
    }
  };

  const handleRegenerateSingleCoverLetter = async () => {
    if (!selectedJob) return;
    setIsRegeneratingCover(true);
    try {
      const response = await fetch("/api/job/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: editedResume || selectedJob.tailoredResume,
          jobDescription: editedJobDesc || selectedJob.jobDescription,
          companyDetails: editedCompanyDetails || selectedJob.companyDetails,
        }),
      });
      if (!response.ok) throw new Error("Cover Letter generation failed.");
      const data = await response.json();
      setEditedCoverLetter(data.coverLetter);

      const updatedJob: AppliedJob = {
        ...selectedJob,
        companyName: editedCompanyName,
        roleTitle: editedRoleTitle,
        status: editedStatus,
        jobDescription: editedJobDesc,
        companyDetails: editedCompanyDetails,
        coverLetter: data.coverLetter,
      };
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
    } catch (err: any) {
      alert(`Error regenerating cover letter: ${err.message}`);
    } finally {
      setIsRegeneratingCover(false);
    }
  };

  const handleRegenerateSingleEmail = async () => {
    if (!selectedJob) return;
    setIsRegeneratingEmail(true);
    try {
      const response = await fetch("/api/job/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: editedResume || selectedJob.tailoredResume,
          jobDescription: editedJobDesc || selectedJob.jobDescription,
          companyDetails: editedCompanyDetails || selectedJob.companyDetails,
        }),
      });
      if (!response.ok) throw new Error("Outreach email generation failed.");
      const data = await response.json();
      setEditedEmail(data.email || "");

      const updatedJob: AppliedJob = {
        ...selectedJob,
        companyName: editedCompanyName,
        roleTitle: editedRoleTitle,
        status: editedStatus,
        jobDescription: editedJobDesc,
        companyDetails: editedCompanyDetails,
        hiringManagerEmail: data.email || "",
      };
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
    } catch (err: any) {
      alert(`Error regenerating outreach email: ${err.message}`);
    } finally {
      setIsRegeneratingEmail(false);
    }
  };

  const startNewJobWizard = () => {
    setWizard({
      ...INITIAL_WIZARD_STATE,
      customResumeText: onboarding.baseResume, // Default to base resume text
    });
    setIsWizardOpen(true);
    setSelectedJob(null);
  };

  const cancelWizard = () => {
    setIsWizardOpen(false);
    setWizard(INITIAL_WIZARD_STATE);
  };

  const handleCustomResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsParsingResume(true);
      setWizard(prev => ({ ...prev, error: null }));
      try {
        if (file.name.toLowerCase().endsWith(".pdf")) {
          // PDF client-side text extractor
          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load PDF parser configuration."));
              document.head.appendChild(script);
            });
          }

          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let textContentCombined = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(" ");
            textContentCombined += pageText + "\n";
          }
          
          if (!textContentCombined.trim()) {
            throw new Error("We successfully parsed your PDF, but no clean text content was found. It might be scanned; please check or paste instead.");
          }
          
          setWizard(prev => ({
            ...prev,
            customResumeText: textContentCombined.trim(),
            error: null
          }));
        } else {
          // Plain text flow
          const reader = new FileReader();
          reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
              setWizard(prev => ({
                ...prev,
                customResumeText: text,
                error: null
              }));
            }
          };
          reader.readAsText(file);
        }
      } catch (err: any) {
        console.error("Custom CV Parse Error:", err);
        setWizard(prev => ({ 
          ...prev, 
          error: err.message || "Failed to parse alternate CV file. Make sure it's valid." 
        }));
      } finally {
        setIsParsingResume(false);
      }
    }
  };

  // Step 1 check & Proceed to Step 2
  const handleProceedToStep2 = () => {
    if (!wizard.companyName.trim()) {
      setWizard(prev => ({ ...prev, error: "Company Name is required" }));
      return;
    }
    if (!wizard.roleTitle.trim()) {
      setWizard(prev => ({ ...prev, error: "Role/Job Title is required" }));
      return;
    }
    if (!wizard.jobDescription.trim() || wizard.jobDescription.trim().length < 40) {
      setWizard(prev => ({ ...prev, error: "Please enter a detailed job description (minimum 40 characters)" }));
      return;
    }
    setWizard(prev => ({ ...prev, currentStep: 2, error: null }));
  };

  // Step 2 Proceed to Step 3 (Generate Tailored Resume)
  const handleGenerateTailoredResume = async () => {
    let sourceText = wizard.resumeSource === "base" ? onboarding.baseResume : wizard.customResumeText;
    if (!sourceText.trim()) {
      setWizard(prev => ({ ...prev, error: "Selected resume content is empty! Please upload or supply a valid CV." }));
      return;
    }

    setWizard(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/job/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceText,
          jobDescription: wizard.jobDescription,
          companyDetails: wizard.companyDetails,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to tailor resume using Gemini ATS optimization service.");
      }

      const data = await response.json();
      setWizard(prev => ({
        ...prev,
        tailoredResume: data.tailoredResume || "",
        keyMatches: data.keyMatches || [],
        adjustmentsMade: data.adjustmentsMade || "",
        atsScore: data.atsScore,
        currentStep: 3,
        error: null,
      }));
    } catch (err: any) {
      console.error(err);
      setWizard(prev => ({ ...prev, error: err.message || "Something went wrong tailoring response details." }));
    } finally {
      setWizard(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Step 3 Proceed to Step 4 (Generate Cover Letter)
  const handleGenerateCoverLetter = async () => {
    setWizard(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/job/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: wizard.tailoredResume,
          jobDescription: wizard.jobDescription,
          companyDetails: wizard.companyDetails,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate custom Cover Letter.");
      }

      const data = await response.json();
      setWizard(prev => ({
        ...prev,
        coverLetter: data.coverLetter || "",
        currentStep: 4,
        error: null,
      }));
    } catch (err: any) {
      console.error(err);
      setWizard(prev => ({ ...prev, error: err.message || "Failed to generate Cover Letter." }));
    } finally {
      setWizard(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Step 4 Proceed to Step 5 (Generate Outreach Email)
  const handleGenerateOutreachEmail = async () => {
    setWizard(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch("/api/job/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: wizard.tailoredResume,
          jobDescription: wizard.jobDescription,
          companyDetails: wizard.companyDetails,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate outreach pitch email.");
      }

      const data = await response.json();
      setWizard(prev => ({
        ...prev,
        hiringManagerEmail: data.email || "",
        currentStep: 5,
        error: null,
      }));
    } catch (err: any) {
      console.error(err);
      setWizard(prev => ({ ...prev, error: err.message || "Failed to generate mail outreach details." }));
    } finally {
      setWizard(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Step 5 Save Job details and Finish
  const handleFinishWizard = () => {
    const isEdit = !!wizard.id;
    const existingJob = isEdit ? jobs.find(j => j.id === wizard.id) : null;

    const updatedJob: AppliedJob = {
      id: isEdit ? wizard.id! : `job-${Date.now()}`,
      companyName: wizard.companyName.trim(),
      roleTitle: wizard.roleTitle.trim(),
      dateApplied: existingJob ? existingJob.dateApplied : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      status: existingJob ? existingJob.status : "Applied",
      jobDescription: wizard.jobDescription,
      companyDetails: wizard.companyDetails,
      resumeSourceUsed: wizard.resumeSource,
      customResumeText: wizard.customResumeText,
      keyMatches: wizard.keyMatches,
      adjustmentsMade: wizard.adjustmentsMade,
      tailoredResume: wizard.tailoredResume,
      coverLetter: wizard.coverLetter,
      hiringManagerEmail: wizard.hiringManagerEmail,
      atsScore: wizard.atsScore || Math.min(80 + Math.round((wizard.keyMatches || []).length * 2.5), 98),
      followUpEmails: existingJob ? existingJob.followUpEmails : [],
    };

    if (isEdit) {
      setJobs(prev => prev.map(j => j.id === wizard.id ? updatedJob : j));
    } else {
      setJobs(prev => [updatedJob, ...prev]);
    }

    setIsWizardOpen(false);
    setSelectedJob(updatedJob); // View it instantly
    setWizard(INITIAL_WIZARD_STATE);
  };

  const handleDownloadFile = (filename: string, text: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadPDF = async (companyName: string, resumeText: string) => {
    setIsDownloadingPDF(true);
    try {
      const sanitizedCompany = companyName.trim().replace(/\s+/g, "_");
      await downloadResumeAsPDF(resumeText, `${sanitizedCompany}_Tailored_Resume.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to compile and download PDF. Please try again.");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleDownloadCoverLetterPDF = async (companyName: string, coverLetterText: string) => {
    setIsDownloadingPDF(true);
    try {
      const sanitizedCompany = companyName.trim().replace(/\s+/g, "_");
      await downloadCoverLetterAsPDF(coverLetterText, `${sanitizedCompany}_Cover_Letter.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to compile and download Cover Letter PDF. Please try again.");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Generate Followup email from details panel
  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsGeneratingFollowup(true);
    setFollowUpResult(null);

    try {
      const response = await fetch("/api/job/generate-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: selectedJob.tailoredResume,
          jobDescription: selectedJob.jobDescription,
          companyDetails: selectedJob.companyDetails,
          followUpDetails: followUpPrompt.trim()
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate followup correspondence.");
      }

      const data = await response.json();
      const newFollowup = {
        id: `follow-${Date.now()}`,
        requestContext: followUpPrompt.trim() || "Standard warm follow-up",
        content: data.followUpEmail,
        timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Add to current selected job's followup array list
      const updatedJobs = jobs.map(j => {
        if (j.id === selectedJob.id) {
          return {
            ...j,
            followUpEmails: [...j.followUpEmails, newFollowup]
          };
        }
        return j;
      });

      setJobs(updatedJobs);
      setSelectedJob(prev => prev ? { ...prev, followUpEmails: [...prev.followUpEmails, newFollowup] } : null);
      setFollowUpPrompt("");
      setFollowUpResult(data.followUpEmail);
    } catch (err: any) {
      alert(err.message || "Failed to create follow-up communication.");
    } finally {
      setIsGeneratingFollowup(false);
    }
  };

  const handleDeleteJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = jobs.filter(j => j.id !== id);
    setJobs(updated);
    if (selectedJob && selectedJob.id === id) {
      setSelectedJob(null);
    }
  };

  const handleRegenerateJobArtifacts = async (job: AppliedJob) => {
    setIsGeneratingFollowup(true); // Re-use spinner for UI lock
    try {
      const sourceText = job.resumeSourceUsed === "base" ? onboarding.baseResume : (job.customResumeText || onboarding.baseResume);
      
      // Step 1: Tailor Resume
      const resVal = await fetch("/api/job/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceText,
          jobDescription: job.jobDescription,
          companyDetails: job.companyDetails,
        }),
      });
      if (!resVal.ok) throw new Error("Resume tailoring phase failed.");
      const tailoredData = await resVal.json();

      // Step 2: Cover Letter
      const coverVal = await fetch("/api/job/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: tailoredData.tailoredResume,
          jobDescription: job.jobDescription,
          companyDetails: job.companyDetails,
        }),
      });
      if (!coverVal.ok) throw new Error("Cover letter phase failed.");
      const coverData = await coverVal.json();

      // Step 3: Outreach Email
      const emailVal = await fetch("/api/job/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: tailoredData.tailoredResume,
          jobDescription: job.jobDescription,
          companyDetails: job.companyDetails,
        }),
      });
      if (!emailVal.ok) throw new Error("Outreach email phase failed.");
      const emailData = await emailVal.json();

      const updatedJob: AppliedJob = {
        ...job,
        tailoredResume: tailoredData.tailoredResume,
        keyMatches: tailoredData.keyMatches || [],
        adjustmentsMade: tailoredData.adjustmentsMade || "",
        coverLetter: coverData.coverLetter || "",
        hiringManagerEmail: emailData.email || "",
        atsScore: tailoredData.atsScore,
      };

      setJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));
      setSelectedJob(updatedJob);
      alert("Successfully regenerated and updated all application material coordinates!");
    } catch (err: any) {
      alert(`Regeneration Error: ${err.message}`);
    } finally {
      setIsGeneratingFollowup(false);
    }
  };

  const loadSampleJobDesc = () => {
    setWizard(prev => ({
      ...prev,
      companyName: "Hyperion Automation Systems",
      roleTitle: "Lead Principal Cloud Architect",
      companyDetails: "Vision: Lead the clean-energy industrial edge robotics expansion. Mission: High safety automation at zero carbon. Culture: Speed, rigorous mathematical validations, high collaboration",
      jobDescription: `Position: Lead Principal Cloud Architect\n\nWe are looking for a pioneering architect to lead our transition into standardizing next-generation streaming industrial data pipelines. \n\nKey Responsibilities:\n- Lead the technical cloud architecture strategy across AWS and GCP systems.\n- Standardize highly complex, concurrent real-time transactions pipeline (demanding 40,000+ per second stream constraints).\n- Actively containerize legacy edge services, lowering cloud infrastructure footprint budgets by 20%+ utilizing Kubernetes.\n- Champion security posture by configuring complex OAuth federations and zero-trust credentials networks.\n\nRequired Skills:\n- High proficiency in TypeScript/JavaScript, Python, Go, and relational database systems.\n- Strong expertise in Docker, Kubernetes, AWS (EKS, VPC, RDS), and GCP serverless runtimes.\n- Superior communication, leadership alignment, and developer mentorship skills.`
    }));
  };

  return (
    <div id="job-wizard-workspace" className="space-y-6 animate-scaleUp">
      
      {/* Upper Action Panel */}
      {!isWizardOpen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6 shadow-xl relative prism-refract-border">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-cyan-400" /> Apply & Tailor Career Opportunities
            </h2>
            <p className="text-neutral-400 text-xs mt-1.5 font-medium">
              Build ATS-passing resumes, custom cover letters, and outreach coordinates focused on distinct job configurations.
            </p>
          </div>
   
          <button
            onClick={startNewJobWizard}
            className="prism-btn-active px-5 py-2.5 active:scale-98 text-xs font-bold uppercase tracking-wider transition-all rounded-xl shadow-lg flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-white" /> Apply for New Job
          </button>
        </div>
      )}
 
      {/* Main Multi-step tailoring wizard */}
      {isWizardOpen && (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl relative prism-refract-border">
          
          {/* Header */}
          <div className="glass-header p-5 flex items-center justify-between">
            <button
              onClick={cancelWizard}
              className="text-xs text-neutral-250 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 border border-white/5 hover:border-white/15 rounded-xl transition-all font-semibold flex items-center gap-1.5 active:scale-95"
            >
              <Home className="w-3.5 h-3.5 text-cyan-400" />
              <span>Home</span>
            </button>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">Tailoring Forge</span>
              <span className="text-white/25 font-bold">•</span>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Step {wizard.currentStep} of 5</h3>
            </div>
          </div>
 
          {/* Stepper Progress Indicator */}
          <div className="grid grid-cols-5 border-b border-white/5 bg-white/2 text-center text-[10px] sm:text-xs">
            {[
              "1. Context",
              "2. Source CV",
              "3. Tailored Resume",
              "4. Cover Letter",
              "5. Manager Email"
            ].map((st, i) => {
              const active = wizard.currentStep === i + 1;
              const completed = wizard.currentStep > i + 1;
              const isClickable = !!wizard.id || completed || active || (
                (i === 2 && !!wizard.tailoredResume) ||
                (i === 3 && !!wizard.coverLetter) ||
                (i === 4 && !!wizard.hiringManagerEmail)
              );
              return (
                <button 
                  key={i} 
                  type="button"
                  disabled={!isClickable}
                  onClick={() => setWizard(prev => ({ ...prev, currentStep: i + 1, error: null }))}
                  className={`py-3.5 border-r border-white/5 last:border-r-0 font-bold tracking-tight transition-all focus:outline-none flex justify-center items-center ${
                    isClickable ? 'cursor-pointer hover:bg-white/5 text-neutral-300' : 'cursor-not-allowed opacity-35 text-neutral-600'
                  } ${
                    active 
                      ? 'bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-pink-500/10 text-white border-b-2 border-indigo-400 font-extrabold' 
                      : completed 
                        ? 'text-neutral-450 bg-white/1' 
                        : ''
                  }`}
                >
                  <span className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] uppercase tracking-wider">
                    {completed && <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-400" />}
                    {st}
                  </span>
                </button>
              );
            })}
          </div>
 
          {/* Wizard body message alerts */}
          {wizard.error && (
            <div className="mx-6 mt-6 space-y-3">
              <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-300 text-xs backdrop-blur-md">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-left w-full">
                  <p className="font-extrabold text-[10px] uppercase tracking-wider text-red-440">Processing Failure</p>
                  <p className="leading-relaxed opacity-95 text-neutral-200 font-medium">{wizard.error}</p>
                </div>
              </div>

              {(wizard.error.toLowerCase().includes("quota") || wizard.error.toLowerCase().includes("exhausted") || wizard.error.toLowerCase().includes("demand") || wizard.error.toLowerCase().includes("429") || wizard.error.toLowerCase().includes("unavailable") || wizard.error.toLowerCase().includes("limit")) && (
                <div className="p-4 bg-cyan-950/25 border border-cyan-500/20 rounded-2xl text-[11px] text-neutral-350 space-y-2.5 text-left animate-fadeIn">
                  <p className="font-extrabold uppercase tracking-widest text-[9.5px] text-[#00f0ff] flex items-center gap-1.5">• Activating Your Personal Unlimited API Key:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11.5px] text-neutral-300 leading-relaxed">
                    <li>
                      Get a free key in 5 seconds from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#00f0ff] font-bold hover:text-cyan-200 transition-colors inline-block underline">Google AI Studio Get API Key ↗</a>
                    </li>
                    <li>
                      In this workspace, look at the top right header / side shelf and click the <strong>Settings (Gear Icon)</strong>.
                    </li>
                    <li>
                      Find <strong>Secrets / API Keys / Env Variables</strong>.
                    </li>
                    <li>
                      Add or update <strong>GEMINI_API_KEY</strong> with your personal key.
                    </li>
                  </ol>
                  <p className="text-[10px] text-neutral-400 leading-normal border-t border-cyan-500/10 pt-2 font-medium">
                    Adding your secret key overrides Google's shared-tier limit and gives you unlimited, high-speed resume generation/tailoring pipelines.
                  </p>
                </div>
              )}
            </div>
          )}
 
          {/* Wizard Forms */}
          <div className="p-6">
            
            {/* STEP 1: JOB DETAILS Paste job decription and about company including vision, mission */}
            {wizard.currentStep === 1 && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">Specify Company Objective</div>
                  <button
                    type="button"
                    onClick={loadSampleJobDesc}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 rounded-lg transition-all shadow-[0_0_10px_rgba(6,182,212,0.1)] font-semibold"
                  >
                    Load Sample Job Spec
                  </button>
                </div>
 
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-2">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Tech Corp"
                      value={wizard.companyName}
                      onChange={(e) => setWizard({ ...wizard, companyName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-550 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-2">Job Title / Target Role</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lead Staff React Engineer"
                      value={wizard.roleTitle}
                      onChange={(e) => setWizard({ ...wizard, roleTitle: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-550 focus:outline-none transition-all"
                    />
                  </div>
                </div>
 
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    About the Company <span className="text-neutral-500">(Optional: Vision, Mission, Culture details)</span>
                  </label>
                  <textarea
                    placeholder="Paste corporate principles, culture parameters, quarterly ambitions, mission statement or values here to target our emotional alignment parameters..."
                    value={wizard.companyDetails}
                    onChange={(e) => setWizard({ ...wizard, companyDetails: e.target.value })}
                    className="w-full h-24 bg-white/5 border border-white/10 hover:border-white/15 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-3 text-xs text-neutral-200 placeholder-neutral-550 focus:outline-none transition-all resize-none"
                  />
                </div>
 
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Paste Detailed Job Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    placeholder="Paste the complete job description text including lists of requirements, technologies, day-to-day work tasks, and responsibilities..."
                    value={wizard.jobDescription}
                    onChange={(e) => setWizard({ ...wizard, jobDescription: e.target.value })}
                    className="w-full h-44 bg-white/5 border border-white/10 hover:border-white/15 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-3 text-xs text-neutral-200 placeholder-neutral-550 focus:outline-none transition-all resize-none"
                  />
                  <span className="text-[10px] text-neutral-500 block text-right mt-1">Minimum 40 characters required</span>
                </div>
 
                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <button
                    onClick={cancelWizard}
                    className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-neutral-300 text-xs font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to List
                  </button>
                  <button
                    onClick={handleProceedToStep2}
                    className="prism-btn-active px-5 py-2.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg"
                  >
                    Select Resume Source
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CHOOSE BASE RESUME OR UPLOAD NEW ONE */}
            {wizard.currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Configure Base CV parameters</h4>
                  <p className="text-xs text-neutral-300">
                    To tailor our output to pass ATS screenings and key filters, specify the base raw resume database we should modify.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Option 1: Base resume upload */}
                  <div
                    onClick={() => setWizard(prev => ({ ...prev, resumeSource: "base" }))}
                    className={`border rounded-2xl p-5 cursor-pointer transition-all ${wizard.resumeSource === "base" ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20' : 'border-white/10 bg-white/2 hover:border-white/15 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${wizard.resumeSource === "base" ? 'border-cyan-400' : 'border-neutral-600'}`}>
                        {wizard.resumeSource === "base" && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>}
                      </div>
                      <span className="text-xs font-bold text-white tracking-tight">Use Pre-loaded Base CV</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                      Undergo tailoring utilizing the primary resume credentials supplied during the onboarding flow.
                    </p>
                    <div className="bg-white/3 border border-white/5 p-2.5 rounded-xl text-[10px] text-neutral-450 font-mono line-clamp-3">
                      {onboarding.baseResume}
                    </div>
                  </div>

                  {/* Option 2: Upload different target resume text */}
                  <div
                    onClick={() => setWizard(prev => ({ ...prev, resumeSource: "custom" }))}
                    className={`border rounded-2xl p-5 cursor-pointer transition-all ${wizard.resumeSource === "custom" ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20' : 'border-white/10 bg-white/2 hover:border-white/15 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${wizard.resumeSource === "custom" ? 'border-cyan-400' : 'border-neutral-600'}`}>
                        {wizard.resumeSource === "custom" && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>}
                      </div>
                      <span className="text-xs font-bold text-white tracking-tight">Upload Different Target CV</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                      Supply a separate alternate CV version, draft parameters, or text document for this individual query.
                    </p>

                     <div className="relative">
                      {isParsingResume ? (
                        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-white/5 border border-white/10 text-cyan-400 rounded-xl text-[10px] select-none cursor-wait">
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                          <span>Extracting CV Text...</span>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            id="wizard-file"
                            accept=".txt,.md,.pdf"
                            onChange={handleCustomResumeUpload}
                            className="hidden"
                          />
                          <label
                            htmlFor="wizard-file"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] text-neutral-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl cursor-pointer transition-all font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5 text-cyan-400" />
                            {wizard.customResumeText ? "Replace file (.pdf,.txt,.md)" : "Select Target File"}
                          </label>
                        </>
                      )}
                    </div>

                    {wizard.customResumeText && !isParsingResume && (
                      <div className="mt-3 bg-white/3 border border-white/5 p-2.5 rounded-xl text-[10px] text-neutral-450 font-mono line-clamp-2">
                        {wizard.customResumeText}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <button
                    onClick={() => setWizard(prev => ({ ...prev, currentStep: 1 }))}
                    className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-neutral-300 text-xs font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <button
                    onClick={handleGenerateTailoredResume}
                    disabled={wizard.isLoading}
                    className="prism-btn-active px-5 py-2.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {wizard.isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Aligning Resume Keywords...
                      </>
                    ) : (
                      <>
                        Tailor Resume for Job
                        <Sparkles className="w-3.5 h-3.5 text-cyan-205" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: TAILORED RESUME PREVIEW & DOWNLOAD */}
            {wizard.currentStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT CONTEXT PANEL: Success message, Aligned Keywords & Structural details */}
                <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex items-start gap-3 backdrop-blur-md">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-emerald-300">Resume Tailored Successfully to ATS Rules!</h5>
                      <p className="text-[11px] text-neutral-300 mt-1">
                        We aligned work achievements to passing benchmarks. Key targeted keywords matching and changes detail summary:
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/2 border border-white/5 rounded-2xl backdrop-blur-md space-y-3">
                    <span className="font-bold text-[10px] text-neutral-400 uppercase tracking-widest block">Matched Keywords</span>
                    <div className="flex flex-wrap gap-1.5">
                      {wizard.keyMatches.map((m, idx) => (
                        <span key={idx} className="text-[9px] px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded font-bold uppercase tracking-wider block">
                          ✓ {m}
                        </span>
                      ))}
                      {wizard.keyMatches.length === 0 && (
                        <span className="text-[10px] text-neutral-500 italic">No exact matched keywords mapped</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-white/2 border border-white/5 rounded-2xl text-[11px] text-neutral-300 leading-relaxed backdrop-blur-sm space-y-2">
                    <span className="font-bold text-neutral-400 text-[10px] uppercase tracking-widest block">Structural Realignments Made:</span>
                    <p className="text-neutral-300 whitespace-pre-line text-justify leading-relaxed text-[11px]">
                      {wizard.adjustmentsMade || "Minor adjustments and semantic phrase formatting completed for standard parser."}
                    </p>
                  </div>
                </div>

                {/* RIGHT PANEL: Live PDF mock sheet / Direct MD editor and download triggers */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Tab select to switch between ATS PDF Live view and Direct text editor */}
                  <div className="flex border-b border-white/5 text-xs font-bold gap-3 pb-1">
                    <button
                      type="button"
                      onClick={() => setWizardTab("preview")}
                      className={`pb-2 px-1 transition-all border-b-2 uppercase tracking-wider text-[10px] ${
                        wizardTab === "preview"
                          ? "border-cyan-400 text-cyan-300 font-extrabold"
                          : "border-transparent text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      👁️ Standard ATS PDF Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardTab("edit")}
                      className={`pb-2 px-1 transition-all border-b-2 uppercase tracking-wider text-[10px] ${
                        wizardTab === "edit"
                          ? "border-cyan-400 text-cyan-300 font-extrabold"
                          : "border-transparent text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      📝 Direct Resume Editor
                    </button>
                  </div>

                  <div className="border border-white/10 bg-white/2 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md relative">
                    {/* Header containing Actions */}
                    <div className="glass-header px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-neutral-450 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-cyan-400" /> 
                        {wizardTab === "preview" ? "Draft Style Sheet Layout" : "Edit Markdown Direct Content"}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* PDF compilation Trigger */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(wizard.companyName, wizard.tailoredResume)}
                          disabled={isDownloadingPDF}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold text-white bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/10 hover:to-indigo-500/10 border border-white/10 hover:border-white/20 active:scale-98 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)] uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          {isDownloadingPDF ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-white" />
                              <span>Exporting PDF...</span>
                            </>
                          ) : (
                            <>
                              <FileDown className="w-3.5 h-3.5 text-cyan-300" />
                              <span>Download PDF</span>
                            </>
                          )}
                        </button>

                        {/* Fallback md */}
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(`${wizard.companyName.replace(/\s+/g, "_")}_Tailored_Resume.md`, wizard.tailoredResume)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl uppercase tracking-wider transition-all"
                        >
                          <Download className="w-3 h-3" />
                          <span>MD Raw</span>
                        </button>
                      </div>
                    </div>

                    {/* Body Content */}
                    {wizardTab === "preview" ? (
                      <div className="p-4 bg-black/40 max-h-[600px] overflow-y-auto flex justify-center">
                        {/* Paper-sheet mockup representing ATS printed resume exactly */}
                        <div 
                          style={{ fontFamily: "'Georgia', Times, 'Times New Roman', serif" }}
                          className="bg-white text-neutral-900 shadow-2xl p-8 sm:p-12 border border-neutral-200 w-full max-w-[750px] min-h-[500px] text-left leading-relaxed select-text overflow-x-auto rounded-xl"
                        >
                          <div 
                            dangerouslySetInnerHTML={{ __html: parseMarkdownToATSResume(wizard.tailoredResume) }} 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-black/40">
                        <p className="text-[10px] text-neutral-450 mb-2 uppercase tracking-wider">
                          Edit the Markdown text below. Changes will immediately update your Preview sheet and PDF compiler.
                        </p>
                        <textarea
                          value={wizard.tailoredResume}
                          onChange={(e) => setWizard(prev => ({ ...prev, tailoredResume: e.target.value }))}
                          className="w-full h-96 bg-white/3 border border-white/5 hover:border-white/10 rounded-xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-y"
                          placeholder="Customize and refine your tailored resume content here..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-white/5">
                    <button
                      onClick={() => setWizard(prev => ({ ...prev, currentStep: 2 }))}
                      className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-neutral-300 text-xs font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>

                    <button
                      onClick={handleGenerateCoverLetter}
                      disabled={wizard.isLoading}
                      className="prism-btn-active px-5 py-2.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {wizard.isLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Composing Cover Letter...
                        </>
                      ) : (
                        <>
                          Generate Cover Letter
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 4: COVER LETTER VIEW & DOWNLOAD */}
            {wizard.currentStep === 4 && (
              <div className="space-y-4">
                {/* Mode Selector Tabs */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center bg-white/5 p-1 border border-white/10 rounded-xl backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setCoverTab("preview")}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider ${
                        coverTab === "preview"
                          ? "bg-white/10 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.12)]"
                          : "text-neutral-450 hover:text-neutral-200"
                      }`}
                    >
                      Draft Layout Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverTab("edit")}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all uppercase tracking-wider ${
                        coverTab === "edit"
                          ? "bg-white/10 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.12)]"
                          : "text-neutral-450 hover:text-neutral-200"
                      }`}
                    >
                      Edit Raw Markdown
                    </button>
                  </div>
                </div>

                <div className="border border-white/10 bg-white/2 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md relative">
                  {/* Header containing Actions */}
                  <div className="glass-header px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] font-bold text-neutral-450 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-cyan-400" /> 
                      {coverTab === "preview" ? "Draft Style Sheet Layout" : "Edit Markdown Direct Content"}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {/* PDF compilation Trigger */}
                      <button
                        type="button"
                        onClick={() => handleDownloadCoverLetterPDF(wizard.companyName, wizard.coverLetter)}
                        disabled={isDownloadingPDF}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold text-white bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/10 hover:to-indigo-500/10 border border-white/10 hover:border-white/20 active:scale-98 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)] uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {isDownloadingPDF ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                            <span>Exporting PDF...</span>
                          </>
                        ) : (
                          <>
                            <FileDown className="w-3.5 h-3.5 text-cyan-300" />
                            <span>Download PDF</span>
                          </>
                        )}
                      </button>

                      {/* Fallback md */}
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(`${wizard.companyName.replace(/\s+/g, "_")}_Cover_Letter.md`, wizard.coverLetter)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3 h-3" />
                        <span>MD Raw</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {coverTab === "preview" ? (
                    <div className="p-4 bg-black/40 max-h-[600px] overflow-y-auto flex justify-center">
                      {/* Paper-sheet mockup representing ATS printed Cover Letter exactly */}
                      <div 
                        style={{ fontFamily: "'Georgia', Times, 'Times New Roman', serif" }}
                        className="bg-white text-neutral-900 shadow-2xl p-8 sm:p-12 border border-neutral-200 w-full max-w-[750px] min-h-[500px] text-left leading-relaxed select-text overflow-x-auto rounded-xl"
                      >
                        <div 
                          dangerouslySetInnerHTML={{ __html: parseMarkdownToCoverLetter(wizard.coverLetter) }} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-black/40">
                      <p className="text-[10px] text-neutral-450 mb-2 uppercase tracking-wider">
                        Edit the Markdown text below. Changes will immediately update your Preview sheet and PDF compiler.
                      </p>
                      <textarea
                        value={wizard.coverLetter}
                        onChange={(e) => setWizard(prev => ({ ...prev, coverLetter: e.target.value }))}
                        className="w-full h-96 bg-white/3 border border-white/5 hover:border-white/10 rounded-xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-y"
                        placeholder="Customize and refine your tailored cover letter content here..."
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/5 mx-0">
                  <button
                    onClick={() => setWizard(prev => ({ ...prev, currentStep: 3 }))}
                    className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-neutral-300 text-xs font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <button
                    onClick={handleGenerateOutreachEmail}
                    disabled={wizard.isLoading}
                    className="prism-btn-active px-5 py-2.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {wizard.isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Drafting Hiring Outreach Email...
                      </>
                    ) : (
                      <>
                        Tailor Outreach Mail to Manager
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: HR/HIRING MANAGER OUTREACH EMAIL & FINISH */}
            {wizard.currentStep === 5 && (
              <div className="space-y-4">
                <div className="border border-white/10 bg-white/2 rounded-2xl overflow-hidden backdrop-blur-md">
                  <div className="glass-header px-4 py-3 flex items-center justify-between border-b border-white/5">
                    <span className="text-[11px] font-bold text-neutral-450 uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-cyan-400" /> Outreach Pitch Email to Hiring Manager
                    </span>
                    <button
                      onClick={() => handleDownloadFile(`${wizard.companyName.replace(/\s+/g, "_")}_Hiring_Manager_Email.txt`, wizard.hiringManagerEmail)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-300" /> Download Email
                    </button>
                  </div>

                  <div className="p-4 bg-black/40">
                    <p className="text-[10px] text-neutral-450 mb-2 uppercase tracking-wider">
                      Customize and refine your warm hiring outreach email copy below:
                    </p>
                    <textarea
                      value={wizard.hiringManagerEmail}
                      onChange={(e) => setWizard(prev => ({ ...prev, hiringManagerEmail: e.target.value }))}
                      className="w-full h-80 bg-white/3 border border-white/5 hover:border-white/10 rounded-xl p-4 font-mono text-xs text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-y"
                      placeholder="Customize and refine your outreach email here..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                  <button
                    onClick={() => setWizard(prev => ({ ...prev, currentStep: 4 }))}
                    className="px-4 py-2.5 border border-white/10 hover:border-white/20 text-neutral-300 text-xs font-semibold rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <button
                    onClick={handleFinishWizard}
                    className="prism-btn-active px-6 py-2.5 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg"
                  >
                    Finish Tailoring & Update List
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid: Saved jobs table listing + details side-by-side or stacked */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Table of Applied Jobs */}
        <div className="space-y-4">
          <div className="glass-panel border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="glass-header px-5 py-4 flex items-center justify-between border-b border-white/5">
              <h3 className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" /> Customized Job Applications Tracker ({jobs.length})
              </h3>
            </div>

            {jobs.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <Briefcase className="w-10 h-10 text-neutral-500 mx-auto" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-neutral-300">No Job Application Files Tailored Yet</p>
                  <p className="text-xs text-neutral-450 mt-1 max-w-sm mx-auto">
                    Click "Apply for New Job" to begin mapping your core resume against actual employer credentials.
                  </p>
                </div>
                <button
                  onClick={startNewJobWizard}
                  className="prism-btn-active px-5 py-2.5 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg font-bold"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-white/3 text-neutral-400 border-b border-white/5 uppercase tracking-widest font-bold text-[9px]">
                    <tr>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">Role Title</th>
                      <th className="py-3 px-4">Date Added</th>
                      <th className="py-3 px-4 text-center">ATS Score</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-transparent w-full">
                    {jobs.map((job) => {
                      const isActive = selectedJob?.id === job.id;
                      const score = job.atsScore ?? Math.min(80 + Math.round((job.keyMatches || []).length * 2.5), 98);
                      return (
                        <tr
                          key={job.id}
                          onClick={() => { setSelectedJob(job); setFollowUpResult(null); setIsDetailModalOpen(true); }}
                          className={`hover:bg-white/5 cursor-pointer transition-colors ${isActive ? 'bg-white/10 font-bold' : ''}`}
                        >
                          <td className="py-3.5 px-4 font-bold text-white">
                            {job.companyName}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300 font-semibold">
                            {job.roleTitle}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-450 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            {job.dateApplied}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                              score >= 85 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                                : score >= 70
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                                : "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                            }`}>
                              {score}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={job.status || "Applied"}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newStatus = e.target.value as any;
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
                                if (selectedJob && selectedJob.id === job.id) {
                                  setSelectedJob(prev => prev ? { ...prev, status: newStatus } : null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] px-2 py-0.5 text-center font-bold tracking-wider rounded-lg border focus:outline-none cursor-pointer transition-all ${getStatusClasses(job.status || "Applied")}`}
                            >
                              <option value="Applied" className="bg-neutral-900 text-neutral-350">Applied</option>
                              <option value="Interviewing" className="bg-neutral-900 text-amber-300">Interviewing</option>
                              <option value="Offered" className="bg-neutral-900 text-emerald-300">Offered</option>
                              <option value="Rejected" className="bg-neutral-900 text-red-350">Rejected</option>
                              <option value="Archived" className="bg-neutral-900 text-neutral-500">Archived</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWizard({
                                    id: job.id,
                                    currentStep: 3, // Directly go to "3. Tailored Resume" step so they can see the generated content instantly!
                                    companyName: job.companyName,
                                    roleTitle: job.roleTitle,
                                    jobDescription: job.jobDescription,
                                    companyDetails: job.companyDetails,
                                    resumeSource: job.resumeSourceUsed || "base",
                                    customResumeText: job.customResumeText || "",
                                    isLoading: false,
                                    error: null,
                                    tailoredResume: job.tailoredResume || "",
                                    keyMatches: job.keyMatches || [],
                                    adjustmentsMade: job.adjustmentsMade || "",
                                    coverLetter: job.coverLetter || "",
                                    hiringManagerEmail: job.hiringManagerEmail || "",
                                    atsScore: job.atsScore,
                                  });
                                  setIsWizardOpen(true);
                                  document.getElementById("job-wizard-workspace")?.scrollIntoView({ behavior: "smooth" });
                                }}
                                className="p-1 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-white/5 border border-white/0 hover:border-white/10 rounded-xl transition-all flex items-center justify-center gap-1"
                                title="Edit & Tailor materials"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteJob(job.id, e);
                                }}
                                className="p-1 px-2 text-neutral-450 hover:text-red-400 hover:bg-white/5 border border-white/0 hover:border-white/10 rounded-xl transition-all flex items-center justify-center gap-1"
                                title="Delete job Application record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
                 </div>
            {/* Selected Job application review & followup generator Modal */}
        {selectedJob && isDetailModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center p-3 pt-[90px] md:pt-[96px] lg:pt-[100px] pb-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsDetailModalOpen(false)}>
            <div className="relative bg-black/40 border border-white/10 rounded-2xl w-full max-w-5xl h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] max-h-[800px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-left backdrop-blur-2xl" onClick={(e) => e.stopPropagation()}>
              
              {/* Spinner cover when regenerating */}
              {(isGeneratingFollowup || isRegeneratingResume || isRegeneratingCover || isRegeneratingEmail) && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-30 flex flex-col justify-center items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="text-xs text-cyan-300 font-extrabold uppercase tracking-widest">Compiling Job Vector Dynamics...</span>
                </div>
              )}

              {/* Title parameters */}
              <div className="flex items-start justify-between border-b border-white/5 p-6 bg-white/3 shrink-0">
                <div className="min-w-0 pr-2">
                  <h3 className="text-base font-extrabold text-white leading-tight truncate" title={selectedJob.companyName}>
                    {selectedJob.companyName}
                  </h3>
                  <p className="text-xs text-cyan-400 font-bold mt-1.5 flex items-center gap-1.5" title={selectedJob.roleTitle}>
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    <span>{selectedJob.roleTitle}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleRegenerateJobArtifacts(selectedJob)}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 hover:text-white px-3.5 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)] active:scale-95"
                    title="Regenerate all tailored artifacts"
                  >
                    <RefreshCw className="w-3 h-3 text-cyan-400" strokeWidth={2.5} />
                    <span>Regenerate All</span>
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all focus:outline-none"
                    title="Close Details Modal"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Tabs selector */}
              <div className="px-6 py-2 bg-transparent border-b border-white/5 shrink-0">
                <div className="flex flex-wrap bg-white/5 p-1 rounded-xl border border-white/10 gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("info")}
                    className={`flex-1 min-w-[70px] py-2 text-center text-[10px] font-extrabold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      detailModalTab === "info"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/15"
                        : "text-neutral-450 hover:text-neutral-200"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span className="hidden sm:inline">Job Profile & JD</span>
                    <span className="sm:hidden">JD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("cv")}
                    className={`flex-1 min-w-[70px] py-2 text-center text-[10px] font-extrabold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      detailModalTab === "cv"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/15"
                        : "text-neutral-450 hover:text-neutral-200"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Tailored Resume (CV)</span>
                    <span className="sm:hidden">CV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("cover")}
                    className={`flex-1 min-w-[70px] py-2 text-center text-[10px] font-extrabold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      detailModalTab === "cover"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/15"
                        : "text-neutral-450 hover:text-neutral-200"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Cover Letter</span>
                    <span className="sm:hidden">Letter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("email")}
                    className={`flex-1 min-w-[70px] py-2 text-center text-[10px] font-extrabold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      detailModalTab === "email"
                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/15"
                        : "text-neutral-450 hover:text-neutral-200"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Outreach Email</span>
                    <span className="sm:hidden">Pitch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab("followups")}
                    className={`flex-1 min-w-[70px] py-2 text-center text-[10px] font-extrabold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      detailModalTab === "followups"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.12)] ring-1 ring-amber-500/15"
                        : "text-neutral-450 hover:text-neutral-200"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Followups</span>
                    <span className="sm:hidden">Follows</span>
                  </button>
                </div>
              </div>

              {/* Main Tab View Contents - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-transparent">
                   {/* 0. JOB DETAILS & INFORMATION WORKSPACE */}
                {detailModalTab === "info" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <p className="text-xs text-neutral-300">
                      Manage core metadata and search coordinates for this application. Editing the job description allows you to trigger a complete regeneration of the tailored materials below.
                    </p>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Metadata panel */}
                      <div className="lg:col-span-5 space-y-4 bg-white/3 p-5 rounded-2xl border border-white/5">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold mb-1.5">Company Name</label>
                          <input
                            type="text"
                            value={editedCompanyName}
                            onChange={(e) => setEditedCompanyName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all font-sans"
                            placeholder="e.g. Google"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold mb-1.5">Role / Position Title</label>
                          <input
                            type="text"
                            value={editedRoleTitle}
                            onChange={(e) => setEditedRoleTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all font-sans"
                            placeholder="e.g. Senior Software Engineer"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold mb-1.5">Application Status</label>
                          <select
                            value={editedStatus}
                            onChange={(e) => setEditedStatus(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all font-sans cursor-pointer"
                          >
                            <option value="Applied" className="bg-neutral-900 text-neutral-200">Applied</option>
                            <option value="Interviewing" className="bg-neutral-900 text-amber-305">Interviewing</option>
                            <option value="Offered" className="bg-neutral-900 text-emerald-305">Offered</option>
                            <option value="Rejected" className="bg-neutral-900 text-red-350">Rejected</option>
                            <option value="Archived" className="bg-neutral-900 text-neutral-450">Archived</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold mb-1.5">Company Target Culture & Context</label>
                          <textarea
                            value={editedCompanyDetails}
                            onChange={(e) => setEditedCompanyDetails(e.target.value)}
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all font-sans resize-y"
                            placeholder="Target keywords, company values..."
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveEditedArtifacts();
                            }}
                            className="prism-btn-active px-4 py-2 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all"
                          >
                            Save Details
                          </button>
                        </div>
                      </div>

                      {/* Right: Job Description Editor */}
                      <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-extrabold">Original Job Description</label>
                          <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                            {editedJobDesc.length} chars
                          </span>
                        </div>

                        <textarea
                          value={editedJobDesc}
                          onChange={(e) => setEditedJobDesc(e.target.value)}
                          className="w-full h-80 bg-white/3 border border-white/5 hover:border-white/10 rounded-2xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-y"
                          placeholder="Paste or edit the job requirements description here..."
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/3 rounded-2xl border border-white/10 backdrop-blur-sm">
                          <div>
                            <h4 className="text-[11px] font-bold text-cyan-200 uppercase tracking-wider">Dynamic Material Compilation</h4>
                            <p className="text-[10px] text-neutral-450 mt-1">Regenerate Tailwind Resume, Cover Letter and outreach draft based on current edits.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRegenerateJobArtifacts(selectedJob)}
                            className="prism-btn-active flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-98"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate Content</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. RESUME WORKSPACE */}
                {detailModalTab === "cv" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tailored CV Editorial Workspace</h4>
                        <p className="text-[10px] text-neutral-400 mt-1">Directly modify the Markdown code on the left and see the print-ready Parchment preview change on the right.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(editedResume);
                            alert("Copied customized resume markdown to clipboard!");
                          }}
                          className="px-3 py-2 text-[10px] font-extrabold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider font-semibold"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copy Markdown</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(selectedJob.companyName, editedResume)}
                          disabled={isDownloadingPDF}
                          className="prism-btn-active px-3.5 py-2 text-[10px] font-bold text-white active:scale-98 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-widest shadow-lg disabled:opacity-50"
                        >
                          {isDownloadingPDF ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      {/* Left: Editor */}
                      <div className="space-y-3 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Dynamic Source Markdown</span>
                          <button
                            type="button"
                            onClick={handleRegenerateSingleResume}
                            className="text-[9px] font-extrabold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold"
                            disabled={isRegeneratingResume}
                          >
                            {isRegeneratingResume ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                            ) : (
                              <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
                            )}
                            <span>Regenerate CV</span>
                          </button>
                        </div>
                        <textarea
                          value={editedResume}
                          onChange={(e) => setEditedResume(e.target.value)}
                          className="w-full h-[450px] bg-white/3 border border-white/5 hover:border-white/15 rounded-xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-none overflow-y-auto flex-1"
                          placeholder="Loading resume markdown..."
                        />
                        <div className="flex justify-end gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedJob = {
                                ...selectedJob,
                                companyName: editedCompanyName,
                                roleTitle: editedRoleTitle,
                                status: editedStatus,
                                jobDescription: editedJobDesc,
                                companyDetails: editedCompanyDetails,
                                tailoredResume: editedResume
                              };
                              setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
                              setSelectedJob(updatedJob);
                              alert("CV content saved in memory!");
                            }}
                            className="prism-btn-active px-4 py-2 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all"
                          >
                            Save CV Draft
                          </button>
                        </div>
                      </div>

                      {/* Right: Preview */}
                      <div className="space-y-3 flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block font-mono">Parchment Output Render</span>
                        <div className="p-4 bg-black/40 rounded-xl max-h-[500px] overflow-y-auto flex justify-center border border-white/5 shadow-inner flex-1 bg-gradient-to-b from-black/20 to-black/40">
                          <div className="bg-white text-neutral-900 shadow-2xl p-6 sm:p-10 font-sans border border-neutral-200 w-full text-left leading-relaxed select-text overflow-x-auto rounded-xl">
                            <div dangerouslySetInnerHTML={{ __html: parseMarkdownToATSResume(editedResume) }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                      {/* 2. COVER LETTER WORKSPACE */}
                {detailModalTab === "cover" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tailored Cover Letter Editor</h4>
                        <p className="text-[10px] text-neutral-450 mt-1">Directly fine tune alignment value points on the left and see professional layout preview on the right.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(editedCoverLetter);
                            alert("Copied customized Cover Letter to clipboard!");
                          }}
                          className="px-3 py-2 text-[10px] font-extrabold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider font-semibold"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copy Letter</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadCoverLetterPDF(selectedJob.companyName, editedCoverLetter)}
                          disabled={isDownloadingPDF}
                          className="prism-btn-active px-3.5 py-2 text-[10px] font-bold text-white active:scale-98 rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-widest shadow-lg disabled:opacity-50"
                        >
                          {isDownloadingPDF ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      {/* Left: Editor */}
                      <div className="space-y-3 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Modify Pitch Letter</span>
                          <button
                            type="button"
                            onClick={handleRegenerateSingleCoverLetter}
                            className="text-[9px] font-extrabold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold"
                            disabled={isRegeneratingCover}
                          >
                            {isRegeneratingCover ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                            ) : (
                              <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
                            )}
                            <span>Regenerate Cover Letter</span>
                          </button>
                        </div>
                        <textarea
                          value={editedCoverLetter}
                          onChange={(e) => setEditedCoverLetter(e.target.value)}
                          className="w-full h-[450px] bg-white/3 border border-white/5 hover:border-white/15 rounded-xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-none overflow-y-auto flex-1"
                          placeholder="Loading cover letter text..."
                        />
                        <div className="flex justify-end gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedJob = {
                                ...selectedJob,
                                companyName: editedCompanyName,
                                roleTitle: editedRoleTitle,
                                status: editedStatus,
                                jobDescription: editedJobDesc,
                                companyDetails: editedCompanyDetails,
                                coverLetter: editedCoverLetter
                              };
                              setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
                              setSelectedJob(updatedJob);
                              alert("Cover Letter saved in memory!");
                            }}
                            className="prism-btn-active px-4 py-2 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all"
                          >
                            Save Letter Draft
                          </button>
                        </div>
                      </div>

                      {/* Right: Preview */}
                      <div className="space-y-3 flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block font-mono">Live Sheet Render</span>
                        <div className="p-4 bg-black/40 rounded-xl max-h-[500px] overflow-y-auto flex justify-center border border-white/10 shadow-inner flex-1 bg-gradient-to-b from-black/20 to-black/40">
                          <div 
                            style={{ fontFamily: "'Georgia', Times, 'Times New Roman', serif" }}
                            className="bg-white text-neutral-900 shadow-2xl p-6 sm:p-10 border border-neutral-200 w-full text-left leading-relaxed select-text overflow-x-auto rounded-xl"
                          >
                            <div dangerouslySetInnerHTML={{ __html: parseMarkdownToCoverLetter(editedCoverLetter) }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. EMAIL PITCH WORKSPACE */}
                {detailModalTab === "email" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Outreach Pitch Copy</h4>
                        <p className="text-[10px] text-neutral-400 mt-1">Refine and craft highly personalized networking, cold pitch or recruiter message copy.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(editedEmail);
                            alert("Copied customized outreach pitch to clipboard!");
                          }}
                          className="px-3 py-2 text-[10px] font-extrabold text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider font-semibold"
                        >
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copy Pitch</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile(`${selectedJob.companyName}_Outreach_Email.txt`, editedEmail)}
                          className="px-3.5 py-2 text-[10px] font-extrabold text-neutral-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:text-white rounded-xl transition-all flex items-center gap-1.5 uppercase font-semibold text-cyan-300"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Save TXT</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                      {/* Left: Editor */}
                      <div className="space-y-3 flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Edit Outreach Text</span>
                          <button
                            type="button"
                            onClick={handleRegenerateSingleEmail}
                            className="text-[9px] font-extrabold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-semibold"
                            disabled={isRegeneratingEmail}
                          >
                            {isRegeneratingEmail ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                            ) : (
                              <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
                            )}
                            <span>Regenerate Pitch</span>
                          </button>
                        </div>
                        <textarea
                          value={editedEmail}
                          onChange={(e) => setEditedEmail(e.target.value)}
                          className="w-full h-[450px] bg-white/3 border border-white/5 hover:border-white/15 rounded-xl p-4 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 transition-all resize-none overflow-y-auto flex-1"
                          placeholder="Your email outreach pitch draft..."
                        />
                        <div className="flex justify-end gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedJob = {
                                ...selectedJob,
                                companyName: editedCompanyName,
                                roleTitle: editedRoleTitle,
                                status: editedStatus,
                                jobDescription: editedJobDesc,
                                companyDetails: editedCompanyDetails,
                                hiringManagerEmail: editedEmail
                              };
                              setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
                              setSelectedJob(updatedJob);
                              alert("Pitch mail draft saved in memory!");
                            }}
                            className="prism-btn-active px-4 py-2 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all"
                          >
                            Save Pitch Draft
                          </button>
                        </div>
                      </div>

                      {/* Right: Preview */}
                      <div className="space-y-3 flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block font-mono">Console Mail View</span>
                        <div className="p-5 bg-black/40 border border-white/5 rounded-xl max-h-[500px] overflow-y-auto flex-1 bg-gradient-to-b from-black/20 to-black/40 text-left">
                          <span className="text-[9px] uppercase tracking-widest font-extrabold text-neutral-500 block mb-2 font-semibold">Subject: Tailored Client/Position Pitch Outreach</span>
                          <div className="bg-white/3 p-5 rounded-xl border border-white/5 font-sans text-neutral-200 text-xs leading-relaxed whitespace-pre-wrap select-text">
                            {editedEmail}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. FOLLOWUPS ENGINE WORKSPACE */}
                {detailModalTab === "followups" && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="bg-white/3 border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-350">Request New Contextual Followup Draft</span>
                      </div>

                      <form onSubmit={handleCreateFollowup} className="space-y-3">
                        <textarea
                          required
                          placeholder="E.g., 'Checking back 2 weeks after initial outreach' or 'Inquire after final round code review submission'..."
                          value={followUpPrompt}
                          onChange={(e) => setFollowUpPrompt(e.target.value)}
                          className="w-full h-24 bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all resize-none"
                        />
                        <button
                          type="submit"
                          className="prism-btn-active w-full px-4 py-2.5 text-white font-bold text-[10.5px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                          <span>Draft Followup Email</span>
                        </button>
                      </form>

                      {followUpResult && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2.5 mt-2">
                          <div className="flex items-center justify-between col-span-2">
                            <span className="text-[10px] font-extrabold text-cyan-300 uppercase tracking-widest">Latest Pitch Output Draft</span>
                            <button
                              onClick={() => handleDownloadFile(`${selectedJob.companyName}_Followup_Email.txt`, followUpResult)}
                              className="text-[10px] text-cyan-400 hover:text-cyan-200 transition-all flex items-center gap-1 font-bold"
                            >
                              <Download className="w-3.5 h-3.5 text-cyan-400" /> Save TXT
                            </button>
                          </div>
                          <pre className="text-[10.5px] font-mono text-neutral-200 whitespace-pre-wrap max-h-48 overflow-y-auto bg-black/40 p-3 rounded-lg border border-white/5">
                            {followUpResult}
                          </pre>
                        </div>
                      )}
                    </div>

                    {selectedJob.followUpEmails.length > 0 && (
                      <div className="bg-white/3 border border-white/5 rounded-2xl p-5 shadow-xl">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-3">Historical Keep Archive ({selectedJob.followUpEmails.length})</span>
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                          {selectedJob.followUpEmails.map((item) => (
                            <div key={item.id} className="p-3.5 bg-white/3 border border-white/10 rounded-xl text-[10.5px] leading-relaxed relative hover:border-cyan-500/30 transition-all select-text text-left">
                              <div className="flex items-center justify-between text-neutral-450 text-[9px] font-bold mb-1.5 uppercase">
                                <span>Context: {item.requestContext}</span>
                                <span>{item.timestamp}</span>
                              </div>
                              <p className="text-neutral-300 font-sans whitespace-pre-wrap">
                                {item.content}
                              </p>
                              <button
                                onClick={() => handleDownloadFile(`${selectedJob.companyName}_Followup_${item.id}.txt`, item.content)}
                                className="absolute right-3.5 top-3.5 text-[9px] font-bold uppercase tracking-wider text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-xl transition-all"
                              >
                                Save
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="flex bg-white/3 px-6 py-4 border-t border-white/5 justify-between items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveEditedArtifacts();
                    setIsDetailModalOpen(false);
                  }}
                  className="prism-btn-active py-2.5 px-5 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all"
                >
                  Save All & Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white text-[10px] font-semibold uppercase tracking-widest rounded-xl transition-all"
                >
                  Close Editor
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
