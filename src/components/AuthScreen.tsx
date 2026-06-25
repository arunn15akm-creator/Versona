import React, { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (uid: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsOperationNotAllowed(false);
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const userCredential = await signInWithPopup(auth, provider);
      const { uid, email: userEmail, displayName } = userCredential.user;

      // Check if user has an existing Firestore user document
      const userDocRef = doc(db, "users", uid);
      let docSnap;
      try {
        docSnap = await getDoc(userDocRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `users/${uid}`);
        return;
      }

      if (!docSnap.exists()) {
        // First-time Google Sign In: initialize with a 2-day trial!
        const trialDurationMs = 2 * 24 * 60 * 60 * 1000; // 2 days
        const trialEndsAt = new Date(Date.now() + trialDurationMs).toISOString();

        try {
          await setDoc(userDocRef, {
            uid,
            email: userEmail || "",
            fullName: displayName || "Calibrated Pilot",
            createdAt: new Date().toISOString(),
            trialEndsAt,
            isSubscribed: false,
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `users/${uid}`);
          return;
        }
      }

      onAuthSuccess(uid);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let errMsg = "An error occurred during Google Sign-In.";
      if (err.code === "auth/operation-not-allowed" || (err.message && err.message.includes("operation-not-allowed"))) {
        setIsOperationNotAllowed(true);
        errMsg = "Google Authentication is not enabled in your Firebase project sign-in providers.";
      } else if (err.code === "auth/popup-blocked") {
        errMsg = "The login popup was blocked by your browser. Please allow popups for this site or try again.";
      } else if (err.code === "auth/popup-closed-by-user") {
        errMsg = "The login popup was closed before completing authentication.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070313] text-white flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden select-none">
      {/* Background Decorative Spheres */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[#00f0ff]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-[#881eff]/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 flex flex-col justify-center min-h-[85vh]">
        {/* Logo and Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="relative flex items-center justify-center">
              <svg className="w-16 h-16 mx-auto" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="v-logo-auth-left" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#7000ff" />
                  </linearGradient>
                  <linearGradient id="v-logo-auth-right" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff9e4f" />
                    <stop offset="50%" stopColor="#f22a85" />
                    <stop offset="100%" stopColor="#881eff" />
                  </linearGradient>
                </defs>
                <path d="M 24 33 C 24 30.5 26 29 29 29 H 37 C 39.5 29 41.5 29.5 43 32 L 48 42 V 68 C 48 69 47.5 69.5 46.5 69 C 39 60 24 41 24 33 Z" fill="url(#v-logo-auth-left)" />
                <path d="M 76 33 C 76 30.5 74 29 71 29 H 63 C 60.5 29 58.5 29.5 57 32 L 52 42 V 68 C 52 69 52.5 69.5 53.5 69 C 61 60 76 41 76 33 Z" fill="url(#v-logo-auth-right)" />
              </svg>
            </div>
            <h1 className="text-4xl font-black tracking-tight prism-text-gradient font-sans">Versona</h1>
          </div>
          <p className="text-neutral-400 font-bold text-xs uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
            Identity Synthesis & Job Tailoring Console
          </p>
        </div>

        {/* Unified Glass Form Panel */}
        <div className="glass-panel border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
          <div className="text-center mb-6">
            <h2 className="text-base font-extrabold uppercase tracking-widest text-[#00f0ff] mb-1.5 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              Sign In or Register
            </h2>
            <p className="text-[11px] text-neutral-400 leading-normal max-w-[280px] mx-auto">
              Continue with your Google account to access your existing identity matrices or instantly activate a new 2-day premium trial.
            </p>
          </div>

          {error && (
            <div className="space-y-3 mb-6">
              <div className="flex gap-2 p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-[11px] text-red-300 items-start animation-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1 w-full">
                  <p className="font-extrabold text-[10px] uppercase tracking-wider">Authentication Error</p>
                  <p className="leading-relaxed opacity-90">{error}</p>
                </div>
              </div>

              {isOperationNotAllowed && (
                <div className="p-4 bg-cyan-950/25 border border-cyan-500/20 rounded-2xl text-[10.5px] text-neutral-300 space-y-2.5 animate-fadeIn">
                  <p className="font-extrabold uppercase tracking-widest text-[9.5px] text-[#00f0ff]">• Step-by-Step Fix Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
                    <li>
                      Open the <a href={`https://console.firebase.google.com/project/${auth.app?.options?.projectId || "herculian-embassy-8f4nj"}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-[#00f0ff] font-bold hover:text-cyan-200 transition-colors inline-flex items-center gap-0.5">Firebase Auth Console ↗</a>
                    </li>
                    <li>
                      Click the <strong>"Add new provider"</strong> button (if Google is not in your provider list).
                    </li>
                    <li>
                      Select the <strong>"Google"</strong> sign-in provider.
                    </li>
                    <li>
                      Set the toggle to <strong>"Enabled"</strong>, fill in the Project public-facing name / support email, and select <strong>"Save"</strong>.
                    </li>
                  </ol>
                  <p className="text-[10px] text-neutral-400 leading-normal border-t border-cyan-500/10 pt-2 font-medium">
                    Once enabled, any Google account will be authorized to log in instantly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Singular Google Sign-In Call To Action */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-4 bg-white hover:bg-neutral-100 active:scale-[0.98] text-neutral-900 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-lg select-none"
          >
            {googleLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-neutral-700" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.81-.62-1.39-1.42-1.39-2.63l-.46-1.07V14.09z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Beautiful Security Affirmation Notice */}
          <div className="mt-8 pt-5 border-t border-white/5 text-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#00f0ff] block mb-1">
              Secure Unified Port
            </span>
            <p className="text-[10px] text-neutral-400 leading-relaxed max-w-xs mx-auto">
              No passwords required. Your identity profile is directly connected to your Firebase credential grid, guaranteeing continuous progress backup.
            </p>
          </div>
        </div>

        {/* Footer info lock */}
        <p className="text-center text-[9px] text-neutral-500 uppercase tracking-widest mt-8 font-bold">
          &copy; {new Date().getFullYear()} Versona Identity Grid. 256-bit encrypted.
        </p>
      </div>
    </div>
  );
}
