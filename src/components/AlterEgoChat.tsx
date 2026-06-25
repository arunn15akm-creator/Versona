import React, { useState, useRef, useEffect } from "react";
import { Send, User, Sparkles, Loader2, RefreshCw, Layers, ShieldCheck, Mail, Edit } from "lucide-react";
import { ChatMessage, OnboardingData } from "../types";
import ReactMarkdown from "react-markdown";

interface AlterEgoChatProps {
  onboarding: OnboardingData;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onEditOnboarding?: () => void;
}

export default function AlterEgoChat({ onboarding, chatHistory, setChatHistory, onEditOnboarding }: AlterEgoChatProps) {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  // Handle default initial model message
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([
        {
          id: "welcome-1",
          role: "model",
          text: `Welcome! I am **${onboarding.fullName || "Your Alter Ego"}**, synthesized at peak capacity as a **${onboarding.targetRole || "Professional"}**.
          
I possess your exact technical reflexes, business philosophy, and core career accomplishments. You can chat with me, or let prospective recruiters/clients interface with me to understand how I reason, architect solutions, or execute projects. 

What challenge would you like me to tackle today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    }
  }, [onboarding, chatHistory.length, setChatHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsgText = inputText.trim();
    setInputText("");
    setError(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    setIsLoading(true);

    try {
      const response = await fetch("/api/alter-ego/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume: onboarding.baseResume,
          bio: onboarding.professionalBio,
          fullName: onboarding.fullName,
          targetRole: onboarding.targetRole,
          messages: updatedHistory,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to get response from your Alter Ego.");
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        text: data.reply || "I encountered an error trying to formulate my thoughts.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setChatHistory([]);
  };

  const loadSamplePrompt = (prompt: string) => {
    setInputText(prompt);
  };

  const samplePrompts = [
    `How do you solve complex architectural bottlenecks?`,
    `Tell me about your most high-stakes professional failure and how you overcame it.`,
    `What is your philosophy on leadership and engineering standardizations?`,
  ];

  return (
    <div id="alter-ego-chat" className="flex flex-col h-full min-h-0 flex-grow glass-panel rounded-2xl overflow-hidden animate-scaleUp relative prism-refract-border">
      
      {/* Target Ego Hub Meta Row */}
      <div className="relative z-10 glass-header px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-pink-500/20 border border-white/10 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-pulse">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-start sm:items-center gap-2 flex-col sm:flex-row">
              <h2 className="font-extrabold text-white text-sm tracking-tight leading-none prism-text-gradient">
                {onboarding.fullName}'s Clone
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[9px] px-2.5 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-full font-bold uppercase tracking-wider mt-1 sm:mt-0 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                Active Simulation
              </span>
            </div>
            <p className="text-neutral-400 text-xs mt-1.5 font-medium">
              Simulated brain: <span className="text-neutral-200">{onboarding.targetRole}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onEditOnboarding && (
            <button
              onClick={onEditOnboarding}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200 shadow-sm"
              title="Edit Base CV & Personal Profile"
            >
              <Edit className="w-3.5 h-3.5 text-pink-400" />
              <span>Edit CV Details</span>
            </button>
          )}
          <button
            onClick={handleResetChat}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-200 shadow-sm"
            title="Clear Chat History"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Main chat layout */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gradient-to-b from-transparent to-[#07050d]/30">
        
        <div className="max-w-3xl mx-auto space-y-6">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Profile Icon wrapper */}
              <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 border ${
                msg.role === "user"
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                  : "bg-purple-500/10 border-purple-500/30 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
              }`}>
                {msg.role === "user" ? <User className="w-4.5 h-4.5" /> : <Sparkles className="w-4.5 h-4.5" />}
              </div>

              {/* Message Content Bubble */}
              <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed backdrop-blur-md ${
                  msg.role === "user"
                    ? "bg-cyan-500/10 text-white border border-cyan-500/20 rounded-tr-none shadow-[0_4px_12px_rgba(6,182,212,0.05)]"
                    : "bg-purple-500/5 text-neutral-250 border border-purple-500/15 rounded-tl-none shadow-[0_4px_12px_rgba(168,85,247,0.05)]"
                }`}>
                  <div className="prose prose-invert prose-xs max-w-none text-neutral-200 font-medium whitespace-pre-wrap">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
                <span className="text-[9px] text-neutral-500 mt-1.5 uppercase tracking-widest font-bold block">
                  {msg.role === "user" ? "You" : onboarding.fullName} • {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3.5 flex-row">
              <div className="w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex flex-col items-start max-w-[85%]">
                <div className="px-4 py-3 bg-purple-500/5 border border-purple-500/15 text-neutral-400 text-xs italic rounded-2xl rounded-tl-none flex items-center gap-2 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                  <span>Synthesizing clone thoughts...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-3">
              <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-300 flex items-start gap-3 backdrop-blur-md">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-red-400 font-extrabold text-[12px]">!</span>
                </div>
                <div className="space-y-1 w-full text-left">
                  <p className="font-extrabold text-[10px] uppercase tracking-wider text-red-450">Generation Error</p>
                  <p className="leading-relaxed opacity-95">{error}</p>
                </div>
              </div>

              {(error.toLowerCase().includes("quota") || error.toLowerCase().includes("exhausted") || error.toLowerCase().includes("demand") || error.toLowerCase().includes("429") || error.toLowerCase().includes("unavailable") || error.toLowerCase().includes("limit")) && (
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
                    Adding your secret key overrides Google's shared-tier limit and gives you unlimited, high-speed conversation pipelines.
                  </p>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input container */}
      <div className="relative z-10 bg-white/2 border-t border-white/5 p-4 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-3 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Interface with your professional clone...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:from-neutral-900 disabled:to-neutral-900 text-white disabled:text-neutral-500 rounded-lg transition-all duration-150 flex items-center justify-center active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[9px] text-neutral-500 mt-2.5 font-bold uppercase tracking-wider">
          Answered strictly within secure parameters of your professional record.
        </p>
      </div>
    </div>
  );
}
