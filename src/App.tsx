import React, { useState, useEffect, useRef } from "react";
import Onboarding from "./components/Onboarding";
import AlterEgoChat from "./components/AlterEgoChat";
import JobWizard from "./components/JobWizard";
import AuthScreen from "./components/AuthScreen";
import SubscriptionGate from "./components/SubscriptionGate";
import { AppTab, AppliedJob, ChatMessage, OnboardingData } from "./types";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Sparkles, MessageSquare, Briefcase, FileSignature, Settings, ShieldAlert, LogOut, CheckCircle2, Edit, User, Mail, Phone, ExternalLink, Globe, Check, Copy, X, FileText, Loader2, CreditCard } from "lucide-react";

const INITIAL_ONBOARDING: OnboardingData = {
  fullName: "",
  targetRole: "",
  baseResume: "",
  professionalBio: "",
  completed: false,
};

function parseResumeDetails(resume: string) {
  if (!resume) {
    return { email: "", phone: "", links: [] as string[], skills: [] as string[] };
  }
  // Extract email address nicely
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = resume.match(emailRegex);
  const email = emails && emails[0] ? emails[0] : "";

  // Extract common phone patterns
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = resume.match(phoneRegex);
  const phone = phones && phones[0] ? phones[0] : "";

  // Extract useful links
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;
  const urls = (resume.match(urlRegex) || []) as string[];
  const links = Array.from(new Set(urls.filter((url: string) => 
    url.includes("linkedin.com") || 
    url.includes("github.com") || 
    url.includes("portfolio") || 
    url.includes("behance") || 
    url.includes("dribbble") ||
    url.includes("personal") ||
    url.includes("arun")
  )));

  // Extract skills dynamically
  const skillsList = [
    "Figma", "Sketch", "Adobe XD", "Wireframing", "Prototyping", "User Research", 
    "UI Design", "UX Design", "Interior Design", "Interaction Design", "Design Systems", "Usability Testing",
    "Product Design", "Visual Design", "TypeScript", "React", "CSS", "Tailwind", "JavaScript", "HTML"
  ];
  const foundSkills: string[] = [];
  const normalizedResume = resume.toLowerCase();
  
  skillsList.forEach(skill => {
    if (normalizedResume.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  });

  if (foundSkills.length === 0) {
    foundSkills.push("UI Design", "UX Design", "Wireframing", "Design Systems", "Figma");
  }

  return { email, phone, links, skills: foundSkills };
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSubGateModal, setShowSubGateModal] = useState(false);

  const [onboarding, setOnboarding] = useState<OnboardingData>(INITIAL_ONBOARDING);
  const [jobs, setJobs] = useState<AppliedJob[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const [activeTab, setActiveTab] = useState<AppTab>("apply_job");
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isEditingOnboarding, setIsEditingOnboarding] = useState(false);
  const [isProfileViewOpen, setIsProfileViewOpen] = useState(false);
  const [isResumeCopied, setIsResumeCopied] = useState(false);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);

  const isChatLockActive = false;

  const prevJobsRef = useRef<AppliedJob[]>([]);
  const prevChatRef = useRef<ChatMessage[]>([]);

  // 1. Listen to Auth State and Retrieve user data from Cloud SQL
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        // Optimistic UI: load User Specific LocalStorage cached states first
        const oKey = `version_onboarding_${firebaseUser.uid}`;
        const jKey = `version_applied_jobs_${firebaseUser.uid}`;
        const cKey = `version_chat_history_${firebaseUser.uid}`;

        const cachedOnboarding = localStorage.getItem(oKey);
        const cachedJobs = localStorage.getItem(jKey);
        const cachedChat = localStorage.getItem(cKey);

        if (cachedOnboarding) {
          setOnboarding(JSON.parse(cachedOnboarding));
        } else {
          setOnboarding(INITIAL_ONBOARDING);
        }

        if (cachedJobs) {
          const parsed = JSON.parse(cachedJobs);
          setJobs(parsed);
          prevJobsRef.current = parsed;
        } else {
          setJobs([]);
          prevJobsRef.current = [];
        }

        if (cachedChat) {
          const parsed = JSON.parse(cachedChat);
          setChatHistory(parsed);
          prevChatRef.current = parsed;
        } else {
          setChatHistory([]);
          prevChatRef.current = [];
        }

        setUser(firebaseUser);
        
        // Dynamic fetch of user metadata, job lists, and chats from SQL
        try {
          const token = await firebaseUser.getIdToken();
          
          // 1.1 Fetch user profile info
          const profileRes = await fetch("/api/user/profile", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setDbUser(profileData);
            
            // Sync with profile onboarding answers if completed
            if (profileData.onboardingCompleted) {
              const freshOnboarding = {
                baseResume: profileData.baseResume || "",
                professionalBio: profileData.professionalBio || "",
                fullName: profileData.fullName || "",
                targetRole: profileData.targetRole || "",
                completed: profileData.onboardingCompleted
              };
              setOnboarding(freshOnboarding);
              localStorage.setItem(`version_onboarding_${firebaseUser.uid}`, JSON.stringify(freshOnboarding));
            }
          }

          // 1.2 Fetch jobs list
          const jobsRes = await fetch("/api/jobs", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (jobsRes.ok) {
            const sqlJobs = await jobsRes.json();
            const mappedJobs = sqlJobs.map((j: any) => ({
              id: j.id,
              companyName: j.companyName,
              roleTitle: j.roleTitle,
              dateApplied: j.dateApplied,
              status: j.status,
              atsScore: j.atsScore || undefined,
              jobDescription: j.jobDescription,
              companyDetails: j.companyDetails,
              resumeSourceUsed: j.resumeSourceUsed,
              customResumeText: j.customResumeText || undefined,
              keyMatches: Array.isArray(j.keyMatches) ? j.keyMatches : [],
              adjustmentsMade: j.adjustmentsMade,
              tailoredResume: j.tailoredResume,
              coverLetter: j.coverLetter,
              hiringManagerEmail: j.hiringManagerEmail,
              followUpEmails: Array.isArray(j.followUpEmails) ? j.followUpEmails : [],
            }));
            setJobs(mappedJobs);
            prevJobsRef.current = mappedJobs;
            localStorage.setItem(`version_applied_jobs_${firebaseUser.uid}`, JSON.stringify(mappedJobs));
          }

          // 1.3 Fetch chat history logs
          const chatRes = await fetch("/api/chat-history", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (chatRes.ok) {
            const sqlChat = await chatRes.json();
            const mappedChat = sqlChat.map((c: any) => ({
              id: c.id,
              role: c.role,
              text: c.text,
              timestamp: c.timestamp
            })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setChatHistory(mappedChat);
            prevChatRef.current = mappedChat;
            localStorage.setItem(`version_chat_history_${firebaseUser.uid}`, JSON.stringify(mappedChat));
          }
        } catch (e) {
          console.error("Cloud SQL initial load error:", e);
        }
      } else {
        setUser(null);
        setDbUser(null);
        setOnboarding(INITIAL_ONBOARDING);
        setJobs([]);
        setChatHistory([]);
        prevJobsRef.current = [];
        prevChatRef.current = [];
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Synchronize onboarding answers changes to Cloud SQL DB
  useEffect(() => {
    if (user?.uid && !authLoading) {
      localStorage.setItem(`version_onboarding_${user.uid}`, JSON.stringify(onboarding));
      
      const syncOnboarding = async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) return;
          await fetch("/api/user/profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              fullName: onboarding.fullName,
              baseResume: onboarding.baseResume,
              professionalBio: onboarding.professionalBio,
              targetRole: onboarding.targetRole,
              onboardingCompleted: onboarding.completed
            })
          });
        } catch (err) {
          console.error("Error syncing onboarding answers:", err);
        }
      };
      syncOnboarding();
    }
  }, [onboarding, user?.uid, authLoading]);

  // 3. Synchronize applied/tailor jobs checklist to Cloud SQL DB
  useEffect(() => {
    if (user?.uid && !authLoading) {
      localStorage.setItem(`version_applied_jobs_${user.uid}`, JSON.stringify(jobs));

      const syncJobChanges = async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) return;

          // Perform non-destructive deletion checks
          const deleted = prevJobsRef.current.filter(pj => !jobs.some(j => j.id === pj.id));
          for (const dj of deleted) {
            await fetch(`/api/jobs/${dj.id}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
          }

          // Check for additions/modifications
          const changed = jobs.filter(j => {
            const prev = prevJobsRef.current.find(pj => pj.id === j.id);
            return !prev || JSON.stringify(prev) !== JSON.stringify(j);
          });

          for (const cj of changed) {
            await fetch("/api/jobs", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify(cj)
            });
          }

          prevJobsRef.current = jobs;
        } catch (err) {
          console.error("Error syncing applied jobs:", err);
        }
      };
      
      syncJobChanges();
    }
  }, [jobs, user?.uid, authLoading]);

  // 4. Synchronize chat history prompts to Cloud SQL DB
  useEffect(() => {
    if (user?.uid && !authLoading) {
      localStorage.setItem(`version_chat_history_${user.uid}`, JSON.stringify(chatHistory));

      const syncChatChanges = async () => {
        try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) return;

          if (chatHistory.length === 0 && prevChatRef.current.length > 0) {
            await fetch("/api/chat-history", {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
          } else {
            const changed = chatHistory.filter(c => {
              const prev = prevChatRef.current.find(pc => pc.id === c.id);
              return !prev || prev.text !== c.text;
            });

            if (changed.length > 0) {
              await fetch("/api/chat-history", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(changed)
              });
            }
          }

          prevChatRef.current = chatHistory;
        } catch (err) {
          console.error("Error syncing chat history:", err);
        }
      };
      
      syncChatChanges();
    }
  }, [chatHistory, user?.uid, authLoading]);

  const handleOnboardingComplete = (data: OnboardingData) => {
    setOnboarding(data);
    setActiveTab("apply_job");
  };

  const handleResetApplicationState = () => {
    if (confirm("WARNING: This will delete your current Alter Ego synthesis, all tailored job applications, and clear the chat history. Are you sure you want to perform a complete system reset?")) {
      setOnboarding(INITIAL_ONBOARDING);
      setJobs([]);
      setChatHistory([]);
      setActiveTab("apply_job");
      setShowConfigPanel(false);
      if (user?.uid) {
        localStorage.removeItem(`version_onboarding_${user.uid}`);
        localStorage.removeItem(`version_applied_jobs_${user.uid}`);
        localStorage.removeItem(`version_chat_history_${user.uid}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070313] text-white flex flex-col justify-center items-center font-sans relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-pink-600/10 blur-[130px]" />
        <div className="text-center relative z-10 space-y-4">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-[#00f0ff]">Synchronizing Core Engine</h2>
          <p className="text-[10.5px] text-neutral-500 uppercase tracking-widest font-bold">Restoring secure user matrices...</p>
        </div>
      </div>
    );
  }

  // Auth Screen Gate
  if (!user) {
    return (
      <AuthScreen 
        onAuthSuccess={async (uid) => {
          const userDocRef = doc(db, "users", uid);
          try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              setDbUser(docSnap.data());
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${uid}`);
          }
        }} 
      />
    );
  }

  const now = new Date();
  const isSubscribed = dbUser?.isSubscribed || false;
  const trialEndsAt = dbUser?.trialEndsAt ? new Date(dbUser.trialEndsAt) : null;
  const isTrialExpired = trialEndsAt ? (now.getTime() > trialEndsAt.getTime()) : false;
  const isLocked = !isSubscribed && isTrialExpired;

  const trialRemainingHours = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60)))
    : 0;
  const hasActiveTrial = !isSubscribed && trialEndsAt && trialRemainingHours > 0;

  // Render subscription check blockage
  if (isLocked) {
    return (
      <SubscriptionGate
        userEmail={user.email || ""}
        userId={user.uid}
        fullName={dbUser?.fullName || onboarding.fullName || "Calibrated Pilot"}
        onSubscriptionSuccess={async () => {
          const userDocRef = doc(db, "users", user.uid);
          try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              setDbUser(docSnap.data());
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
          }
        }}
        isExpiredOnly={true}
      />
    );
  }

  // If onboarding is not completed, we render the layout with sidebar, but showing Start Page/Onboarding
  return (
    <div id="version-core-interface" className={`min-h-screen ${isChatLockActive ? "h-screen overflow-hidden" : ""} bg-transparent text-neutral-200 flex flex-col font-sans animate-fadeIn`}>
      
      {/* Minimalist Header */}
      <header className="glass-header sticky top-0 z-50 px-6 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Slogan */}
          <div 
            onClick={() => {
              if (onboarding.completed) {
                setIsEditingOnboarding(false);
                setActiveTab("apply_job");
                setShowConfigPanel(false);
              }
            }}
            className={`flex items-center gap-3 shrink-0 ${onboarding.completed ? "cursor-pointer select-none active:scale-[0.98] transition-transform" : ""}`}
            title={onboarding.completed ? "Go to Job Hub" : undefined}
          >
            <div className="relative w-9 h-9 rounded-xl bg-[#03000a] border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15),0_0_15px_rgba(236,72,153,0.12)] overflow-hidden">
              {/* Outer soft glowing backlights */}
              <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-cyan-500/25 blur-md" />
              <div className="absolute -right-2 -bottom-2 w-6 h-6 rounded-full bg-pink-500/25 blur-md" />
              
              <svg className="w-6.5 h-6.5 relative z-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="v-logo-left" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#563eff" />
                  </linearGradient>
                  <linearGradient id="v-logo-right" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff9e4f" />
                    <stop offset="50%" stopColor="#f22a85" />
                    <stop offset="100%" stopColor="#881eff" />
                  </linearGradient>
                </defs>
                {/* Left Stem */}
                <path 
                  d="M 24 33 C 24 30.5 26 29 29 29 H 37 C 39.5 29 41.5 29.5 43 32 L 48 42 V 68 C 48 69 47.5 69.5 46.5 69 C 39 60 24 41 24 33 Z" 
                  fill="url(#v-logo-left)" 
                />
                {/* Right Stem */}
                <path 
                  d="M 76 33 C 76 30.5 74 29 71 29 H 63 C 60.5 29 58.5 29.5 57 32 L 52 42 V 68 C 52 69 52.5 69.5 53.5 69 C 61 60 76 41 76 33 Z" 
                  fill="url(#v-logo-right)" 
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight prism-text-gradient leading-none">Versona</span>
              </div>
            </div>
          </div>

          {/* Centered Navigation Tabs - Minimalist Style */}
          <div className="flex items-center gap-1.5 justify-center flex-1">
            {(!onboarding.completed || isEditingOnboarding) && (
              <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white/5 border border-white/10 text-neutral-300 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Calibration Mode</span>
                <span className="sm:hidden">Calibration</span>
              </div>
            )}
          </div>

          {/* User Status / Settings Panel Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {hasActiveTrial && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-xl select-none">
                <span>Trial: <strong>{trialRemainingHours} hr</strong></span>
                <span className="text-white/10">•</span>
                <button 
                  onClick={() => setShowSubGateModal(true)} 
                  className="text-[#00f0ff] underline font-black hover:text-cyan-200 transition-colors cursor-pointer"
                >
                  Upgrade
                </button>
              </div>
            )}
            {isSubscribed && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl select-none">
                <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
                <span>Prime Active</span>
              </div>
            )}

            {onboarding.completed && (
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-white block tracking-tight">{onboarding.fullName}</span>
                <span className="text-[9px] text-neutral-400 font-bold block uppercase tracking-widest mt-0.5">{onboarding.targetRole}</span>
              </div>
            )}
            
            {onboarding.completed && (
              <button
                onClick={() => setIsProfileViewOpen(true)}
                className={`p-2 rounded-xl border transition-all duration-150 ${
                  isProfileViewOpen 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20"
                }`}
                title="View Professional Profile"
              >
                <User className="w-4 h-4" />
              </button>
            )}
            
            {onboarding.completed && (
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className={`p-2 rounded-xl border transition-all duration-150 ${
                  showConfigPanel 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/20"
                }`}
                title="Identity Configurations"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Responsive Layout (Full Workspace) */}
      <div className={`flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 ${isChatLockActive ? "py-2 md:py-3 overflow-hidden" : "py-4 md:py-6 gap-6"} flex flex-col min-h-0`}>

        {/* Content Panel */}
        <main className={`flex-1 min-w-0 ${isChatLockActive ? "flex flex-col overflow-hidden min-h-0" : "space-y-6"}`}>
          
          {/* Dropdown/Flyout Settings Panel */}
          {showConfigPanel && onboarding.completed && (
            <div className="minimal-panel rounded-xl p-6 space-y-6 animate-scaleUp shadow-xl">
              
              <div className="flex items-start justify-between border-b border-neutral-900 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-4 h-4 text-white" /> Identity Configurations
                  </h3>
                  <p className="text-xs text-neutral-455 mt-1">Adjust, view, or completely reboot your professional alter-ego profile values.</p>
                </div>
                <button 
                  onClick={() => setShowConfigPanel(false)}
                  className="text-xs text-neutral-350 hover:text-white transition-colors bg-neutral-900 hover:bg-neutral-850 px-2.5 py-1 rounded-md border border-neutral-800"
                >
                  Close Settings
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Profile Details Raw text visualization */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block">• Persona Credentials Stored</span>
                  <div className="minimal-card rounded-xl p-4 space-y-2.5 text-xs text-neutral-300">
                    <div className="flex justify-between pb-1.5 border-b border-neutral-900">
                      <span className="text-neutral-400 font-medium">FullName:</span> 
                      <span className="font-bold text-white text-right">{onboarding.fullName}</span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-neutral-900">
                      <span className="text-neutral-400 font-medium">Target Role:</span> 
                      <span className="font-bold text-white text-right">{onboarding.targetRole}</span>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-neutral-900">
                      <span className="text-neutral-400 font-medium">Resume Length:</span> 
                      <span className="font-bold text-white text-right">{onboarding.baseResume.length} characters</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400 font-medium">Career Statement:</span> 
                      <span className="font-bold text-white text-right">{onboarding.professionalBio.length} characters</span>
                    </div>
                  </div>

                  {/* Cloud Account & Subscription Status Card */}
                  <div className="p-4 rounded-xl border border-white/5 bg-white/2 space-y-3">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">• Identity Provider & License</span>
                    <div className="space-y-1.5 text-xs text-neutral-300">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Secure Account:</span>
                        <span className="font-bold text-white max-w-[180px] truncate">{user?.email}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-500">Billing Tier:</span>
                        <span className={`font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                          isSubscribed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                        }`}>
                          {isSubscribed ? "Versona Prime" : "2-Day Free Trial"}
                        </span>
                      </div>
                      {!isSubscribed && (
                        <div className="flex justify-between items-center pt-1.5 border-t border-neutral-900">
                          <span className="text-neutral-500 font-medium">Remaining Trial:</span>
                          <span className="text-amber-300 font-extrabold">{trialRemainingHours} Hours Left</span>
                        </div>
                      )}
                    </div>
                    {!isSubscribed && (
                      <button
                        onClick={() => {
                          setShowConfigPanel(false);
                          setShowSubGateModal(true);
                        }}
                        className="w-full mt-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest rounded-xl bg-cyan-700/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition-all cursor-pointer"
                      >
                        Upgrade to Versona Prime
                      </button>
                    )}
                  </div>

                  <div className="minimal-card p-4 rounded-xl block text-xs leading-relaxed text-neutral-400">
                    <span className="font-bold text-neutral-300 block mb-1">Stated Decision Philosophy:</span>
                    "{onboarding.professionalBio}"
                  </div>
                </div>

                {/* Configuration adjustments and reset section */}
                <div className="space-y-6">
                  
                  {/* Non-destructive profile edit */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block">• Alter Ego Alignment</span>
                    <p className="text-xs text-neutral-450 leading-relaxed">
                      Need to modify or expand your base Resume/CV, change your name, target role, or rewrite your personal narrative? You can return to the Start Page seamlessly.
                    </p>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setIsEditingOnboarding(true);
                          setShowConfigPanel(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Sparkles className="w-4 h-4 text-white shrink-0" />
                        Edit Base CV Details
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-neutral-900 my-4"></div>

                  {/* Devastating system settings reset */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block">• Maintenance & Reset</span>
                    <p className="text-xs text-neutral-455 leading-relaxed">
                      To retrace all setup phases, delete history logs, and initialize entirely fresh user records, run a reset. Or log out to register another user profile.
                    </p>
                    <div className="pt-1.5 flex flex-wrap gap-3">
                      <button
                        onClick={handleResetApplicationState}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-950 hover:bg-red-950/20 text-red-150 hover:text-red-300 border border-neutral-900 hover:border-red-900/40 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Settings className="w-4 h-4 shrink-0" />
                        Reset Clone System
                      </button>

                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-300 border border-red-500/10 hover:border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Log Out Account
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Dynamic Workspace tab routing or Onboarding screen rendering */}
          {showConfigPanel ? null : !onboarding.completed || isEditingOnboarding ? (
            <Onboarding 
              initialData={onboarding}
              onComplete={(data) => {
                handleOnboardingComplete(data);
                setIsEditingOnboarding(false);
              }}
              onCancel={onboarding.completed ? () => setIsEditingOnboarding(false) : undefined}
              embedded={true}
            />
          ) : (
            <JobWizard 
              onboarding={onboarding} 
              jobs={jobs} 
              setJobs={setJobs} 
            />
          )}

        </main>
      </div>

      {/* Dynamic Professional Profile Modal - Minimalist Layout */}
      {isProfileViewOpen && onboarding.completed && (() => {
        const parsed = parseResumeDetails(onboarding.baseResume);
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 overflow-y-auto animate-fadeIn"
            onClick={() => setIsProfileViewOpen(false)}
          >
            <div 
              className="relative bg-[#0d0d0d] border border-neutral-800 rounded-xl p-6 sm:p-7 w-full max-w-2xl shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto animate-scaleUp text-left"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-neutral-900 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-none">
                      {onboarding.fullName || "Candidate Profile"}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1.5">
                      {onboarding.targetRole || "UX/UI Designer"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileViewOpen(false)}
                  className="p-1 px-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded transition-all focus:outline-none"
                  title="Close Profile Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dynamic Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Contact and Core Skills Panel */}
                <div className="space-y-5">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                    • Parsed Credentials
                  </span>
                  
                  <div className="space-y-2">
                    {/* Email Card */}
                    {parsed.email ? (
                      <div className="minimal-card rounded-lg p-3 flex items-center gap-3">
                        <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Email</span>
                          <a href={`mailto:${parsed.email}`} className="text-xs text-white hover:underline truncate block transition-colors">
                            {parsed.email}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="minimal-card rounded-lg p-3 flex items-center gap-3 text-neutral-500 text-xs italic">
                        <Mail className="w-4 h-4" /> No email extracted
                      </div>
                    )}

                    {/* Phone card */}
                    {parsed.phone && (
                      <div className="minimal-card rounded-lg p-3 flex items-center gap-3">
                        <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Phone</span>
                          <span className="text-xs text-white font-medium block">{parsed.phone}</span>
                        </div>
                      </div>
                    )}

                    {/* Verified website/LinkedIn links */}
                    {parsed.links && parsed.links.length > 0 && (
                      <div className="minimal-card rounded-lg p-3 flex items-start gap-3">
                        <Globe className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Links</span>
                          <div className="flex flex-col gap-1 mt-1">
                            {parsed.links.map((link, idx) => (
                              <a 
                                key={idx} 
                                href={link.startsWith("http") ? link : `https://${link}`} 
                                target="_blank" 
                                rel="noopener noreferrer referrerPolicy=no-referrer"
                                className="text-xs text-neutral-300 hover:text-white font-medium truncate flex items-center gap-1 transition-colors"
                              >
                                {link.replace(/^https?:\/\/(?:www\.)?/, "")}
                                <ExternalLink className="w-3 h-3 text-neutral-500 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Skills container */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                      • Skills
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {parsed.skills.map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-2.5 py-1 text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Personal Bio Area */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                    • Persona & Philosophy
                  </span>
                  
                  <div className="minimal-card rounded-lg p-4 text-xs leading-relaxed text-neutral-300 italic max-h-[180px] overflow-y-auto">
                    "{onboarding.professionalBio}"
                  </div>

                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-300 space-y-2">
                    <span className="font-bold text-white uppercase tracking-wider text-[10px] block">
                      Identity Sandbox
                    </span>
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                      This parameters profile guides your synthesized cover letters and direct email outreach formulas across the Job application tabs.
                    </p>
                  </div>
                </div>

              </div>

              {/* Collapsible/Expandable Raw Resume Area */}
              <div className="border-t border-neutral-900 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-neutral-300" /> Stored Full Text Document
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(onboarding.baseResume);
                      setIsResumeCopied(true);
                      setTimeout(() => setIsResumeCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 px-2.5 py-1 rounded text-neutral-300 font-bold transition-all"
                  >
                    {isResumeCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied Text!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Raw Text</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="minimal-card rounded-lg p-4 max-h-[160px] overflow-y-auto">
                  <pre className="font-mono text-[10px] text-neutral-450 leading-relaxed font-semibold whitespace-pre-wrap">
                    {onboarding.baseResume}
                  </pre>
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="border-t border-neutral-900 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <button
                  onClick={() => {
                    setIsProfileViewOpen(false);
                    setIsEditingOnboarding(true);
                  }}
                  className="text-neutral-400 hover:text-white hover:underline text-[11px] font-bold transition-all text-left"
                >
                  Edit profile CV &rarr;
                </button>
                
                <button
                  onClick={() => setIsProfileViewOpen(false)}
                  className="w-full sm:w-auto px-5 py-2 bg-white text-black font-extrabold rounded text-xs uppercase tracking-wider hover:bg-neutral-200 transition-all text-center"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Elegant minimalist footer */}
      <footer className="border-t border-neutral-900 bg-[#060606] py-5 px-6 text-center text-neutral-500 text-[10px]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} Versona Clone Matrix. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <span>Core Model: Gemini 3.5 Flash API</span>
            <span>•</span>
            <span className="text-neutral-400">Minimalist Theme v2.0</span>
          </div>
        </div>
      </footer>

      {showSubGateModal && (
        <SubscriptionGate
          userEmail={user.email || ""}
          userId={user.uid}
          fullName={dbUser?.fullName || onboarding.fullName || "Calibrated Pilot"}
          onSubscriptionSuccess={async () => {
            const userDocRef = doc(db, "users", user.uid);
            try {
              const docSnap = await getDoc(userDocRef);
              if (docSnap.exists()) {
                setDbUser(docSnap.data());
              }
            } catch (e) {
              handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
            }
            setShowSubGateModal(false);
          }}
          isExpiredOnly={false}
          onClose={() => setShowSubGateModal(false)}
        />
      )}

      {onboarding.completed && !isEditingOnboarding && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
          {/* Floating Chat Panel */}
          {isFloatingChatOpen && (
            <div 
              className="relative bg-[#07050d] border border-white/10 rounded-2xl w-[350px] sm:w-[520px] md:w-[620px] h-[540px] sm:h-[640px] md:h-[680px] mb-4 shadow-[0_10px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-200"
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex-grow min-h-0 relative z-10">
                <AlterEgoChat 
                  onboarding={onboarding} 
                  chatHistory={chatHistory} 
                  setChatHistory={setChatHistory} 
                  onEditOnboarding={() => {
                    setIsEditingOnboarding(true);
                    setIsFloatingChatOpen(false);
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Floating Action Button */}
          <button
            onClick={() => setIsFloatingChatOpen(!isFloatingChatOpen)}
            className={`p-4 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all active:scale-95 duration-150 flex items-center justify-center relative ${
              isFloatingChatOpen ? "ring-2 ring-cyan-400" : ""
            }`}
            title="Talk to You"
          >
            {isFloatingChatOpen ? (
              <X className="w-6 h-6 animate-spin-once" />
            ) : (
              <div className="relative">
                <MessageSquare className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full border border-neutral-950 animate-ping"></span>
              </div>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
