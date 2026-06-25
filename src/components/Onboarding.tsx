import React, { useState, useRef } from "react";
import { Upload, User, Briefcase, FileText, Send, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { OnboardingData } from "../types";

interface OnboardingProps {
  initialData?: OnboardingData;
  onComplete: (data: OnboardingData) => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function Onboarding({ initialData, onComplete, onCancel, embedded = false }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [targetRole, setTargetRole] = useState(initialData?.targetRole || "");
  const [baseResume, setBaseResume] = useState(initialData?.baseResume || "");
  const [professionalBio, setProfessionalBio] = useState(initialData?.professionalBio || "");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextFileRead = async (file: File) => {
    setIsParsing(true);
    setError(null);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        // PDF client-side text extractor
        // Load pdfjs from CDN dynamically if not present
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
        
        setBaseResume(textContentCombined.trim());
        setError(null);
      } else {
        // Plain text flow
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            setBaseResume(text);
            setError(null);
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error("File Parse Error:", err);
      setError(err.message || "Failed to process the uploaded file. Please make sure it is not corrupt.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleTextFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      handleTextFileRead(e.target.files[0]);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!targetRole.trim()) {
      setError("Target Role / Profession is required.");
      return;
    }
    if (!baseResume.trim()) {
      setError("Please paste or upload your resume/CV content.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!professionalBio.trim() || professionalBio.trim().length < 50) {
      setError("Please provide a more detailed narrative about yourself (minimum 50 characters) to help synthesize an authentic alter ego.");
      return;
    }
    setError(null);

    onComplete({
      fullName: fullName.trim(),
      targetRole: targetRole.trim(),
      baseResume: baseResume.trim(),
      professionalBio: professionalBio.trim(),
      completed: true,
    });
  };

  const loadSampleData = () => {
    setFullName("Sarah Jenkins");
    setTargetRole("Senior Staff Product Engineer");
    setBaseResume(
      `SARAH JENKINS\nsenior.staff.engineer@example.com | San Francisco, CA | https://linkedin.com/in/sarah-jenkins\n\nPROFESSIONAL SUMMARY\nHigh-performing Senior Staff Product Engineer with 8+ years of expertise designing secure, scalable full-stack web architectures and high-traffic distributed microservices. Proven success leading technical direction, mentoring engineers, and executing end-to-end product deliveries of multi-million dollar Cloud products.\n\nTECHNICAL SKILLS\n- Languages: TypeScript, JavaScript (ES6+), Python, Go, SQL\n- Frameworks: React, Node.js (Express), Next.js, Django, Tailwind CSS\n- Cloud & DevOps: AWS (EC2, S3, RDS, Lambda), GCP, Docker, Kubernetes, CI/CD pipelines\n- Databases: PostgreSQL, MongoDB, Redis, Firestore\n\nWORK EXPERIENCE\nSenior Staff Software Engineer | CloudVantage Dynamics | 2022 - Present\n- Architected a next-generation real-time analytics stream handling over 45,000 transactions/second, boosting system performance by 32%.\n- Directed a cross-functional squad of 11 engineers to ship the enterprise integration API, scaling customer onboarding by 3x.\n- Reduced cloud hosting expenses by 24% annually by executing comprehensive containerization and autoscaling policies using AWS EKS.\n\nSenior Software Engineer | PulseFlow Systems | 2019 - 2022\n- Launched interactive dashboard client utilizing React and Tailwind CSS, improving active user session times by 40%.\n- Developed fully secure OAuth authentication workflows reducing customer accounts vulnerabilities to zero.\n\nEDUCATION\nB.S. in Computer Science | Stanford University | Honors Graduate`
    );
    setProfessionalBio(
      "I am an analytical, outcome-oriented staff engineer who thrives at the intersection of technical complexity and product experiences. I speak with high clarity, love making technical systems robust, and excel at mentoring. I focus intensely on performance, security, and elegant user feedback loops."
    );
  };

  const outerContainerClass = embedded 
    ? "w-full bg-transparent p-4 sm:p-6 relative overflow-hidden"
    : "min-h-screen bg-[#030107] text-neutral-200 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden";

  const innerContainerClass = embedded
    ? "w-full relative z-10"
    : "max-w-xl w-full glass-panel rounded-2xl p-8 relative z-10 animate-scaleUp prism-refract-border shadow-2xl";

  return (
    <div id="onboarding-root" className={outerContainerClass}>
      <div className={innerContainerClass}>
        
        {/* Header containing name and logo */}
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-pink-500/20 border border-white/10 flex items-center justify-center text-white mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-pulse">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white text-center prism-text-gradient">
            Synthesize Your Virtual Clone
          </h1>
          <p className="text-neutral-400 text-xs mt-2 text-center leading-relaxed">
            Configure <span className="text-white font-bold uppercase tracking-wider">Versona</span> parameters to clone your capabilities.
          </p>
        </div>

        {/* Form Error */}
        {error && (
          <div className="relative z-10 mb-6 p-4 bg-red-950/20 border border-red-900/40 rounded-lg flex items-start gap-2.5 text-red-300 text-xs leading-normal animate-shake">
            <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Wizard Steps indicator */}
        <div className="relative z-10 flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border ${step >= 1 ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-950 border-neutral-900 text-neutral-500'}`}>
              1
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= 1 ? 'text-white' : 'text-neutral-550'}`}>Identity</span>
          </div>
          <div className="flex-1 h-px bg-neutral-900 mx-4"></div>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all border ${step === 2 ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-950 border-neutral-900 text-neutral-500'}`}>
              2
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step === 2 ? 'text-white' : 'text-neutral-550'}`}>Philosophy</span>
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="relative z-10 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full minimal-input rounded-lg pl-9.5 pr-4 py-2 text-sm text-white placeholder-neutral-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">
                  Target Role / Profession
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Lead Product Engineer"
                    className="w-full minimal-input rounded-lg pl-9.5 pr-4 py-2 text-sm text-white placeholder-neutral-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest">
                  Base Resume or CV Content
                </label>
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="text-[9px] px-2 py-0.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white rounded transition-all font-bold uppercase tracking-wider"
                >
                  Load Sample Data
                </button>
              </div>

              {/* Drag and Drop resume uploader */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border border-dashed rounded-lg p-5 mb-3 text-center transition-all cursor-pointer ${isDragging ? 'border-neutral-500 bg-neutral-900/60' : 'border-neutral-800 bg-[#060606] hover:border-neutral-700 hover:bg-neutral-900'} ${isParsing ? 'opacity-70 cursor-wait' : ''}`}
                onClick={() => !isParsing && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  disabled={isParsing}
                  onChange={handleFileSelect}
                  accept=".txt,.md,.pdf"
                  className="hidden"
                />
                
                {isParsing ? (
                  <div className="py-2 animate-fadeIn">
                    <Loader2 className="w-6 h-6 text-neutral-400 mx-auto mb-2 animate-spin" />
                    <p className="text-xs text-neutral-300 font-bold uppercase tracking-wider">Extracting CV text contents...</p>
                    <p className="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-widest font-bold">Standard secure sandbox parser active</p>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <Upload className="w-6 h-6 text-neutral-500 mx-auto mb-1.5" />
                    <p className="text-xs text-neutral-200 font-medium">
                      {baseResume ? "Change uploaded Resume / CV" : "Click to select or drag Resume (.pdf, .txt, .md)"}
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-1 font-medium">Plain text representation or PDF works perfectly</p>
                  </div>
                )}
              </div>

              {/* Paste Text Area */}
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <textarea
                  value={baseResume}
                  onChange={(e) => setBaseResume(e.target.value)}
                  placeholder="Alternatively, paste your complete Resume/CV plain text right here (Skills, Professional experiences, projects, degree details)..."
                  className="w-full h-44 minimal-input rounded-lg pl-9.5 pr-4 py-2.5 text-xs font-mono text-neutral-200 placeholder-neutral-600 resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-5 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neutral-250 transition-all rounded flex items-center justify-center gap-1.5 active:scale-98 shadow-sm"
              >
                <span>Assemble Profile</span>
                <Send className="w-3.5 h-3.5 text-neutral-700" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="relative z-10 space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-400 leading-relaxed space-y-2">
              <div className="font-bold flex items-center gap-1.5 mb-0.5 text-xs text-white uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-neutral-400" /> Ground Conversational Tone
              </div>
              <p className="text-[11px] text-neutral-350">
                Explain your professional values, decision criteria, problem-solving habits, and preferred communication style.
              </p>
              <div className="mt-1.5 pl-3 space-y-0.5 text-[10px] text-neutral-500">
                <div>• What specific design/architectural challenges fuel your engine?</div>
                <div>• How do you speak with developers vs. senior stakeholders?</div>
                <div>• What are your quirks, high-performance routines, or technical principles?</div>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-neutral-450 uppercase tracking-widest mb-1.5">
                Detailed Personal & Career Narrative
              </label>
              <textarea
                value={professionalBio}
                onChange={(e) => setProfessionalBio(e.target.value)}
                placeholder="Talk here in detail (e.g., 'In technical disputes, I prioritize concrete trade-off matrixes. I advocate for highly modular API design and maintain very direct, collaborative, and friendly relations...')"
                className="w-full h-48 minimal-input rounded-lg px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 resize-none"
              />
              <div className="flex justify-between mt-1.5 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                <span>Minimum 50 characters required</span>
                <span className={professionalBio.length >= 50 ? "text-emerald-500" : "text-amber-500"}>
                  {professionalBio.length} characters
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-all"
              >
                Go Back
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className="flex-1 px-5 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-neutral-250 transition-all rounded flex items-center justify-center gap-1.5 active:scale-98 shadow-sm"
              >
                <span>Synthesize Clone</span>
                <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
