import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { ShieldAlert, Sparkles, CreditCard, Calendar, Lock, Check, Loader2, LogOut } from "lucide-react";

interface SubscriptionGateProps {
  userEmail: string;
  userId: string;
  fullName: string;
  onSubscriptionSuccess: () => void;
  isExpiredOnly?: boolean; // If true, they can't dismiss this screen. If false, they can click close.
  onClose?: () => void;
}

export default function SubscriptionGate({
  userEmail,
  userId,
  fullName,
  onSubscriptionSuccess,
  isExpiredOnly = true,
  onClose,
}: SubscriptionGateProps) {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "elite">("pro");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState(fullName || "");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Card details validators
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      setError("Please fill in all credit card details.");
      return;
    }

    setProcessing(true);

    try {
      // Simulate real bank authorization sequence
      await new Promise((resolve) => setTimeout(resolve, 2200));

      // Successfully process payment: Update document in Firestore
      const userRef = doc(db, "users", userId);
      try {
        await updateDoc(userRef, {
          isSubscribed: true,
          selectedPlan: selectedPlan,
          subscribedAt: new Date().toISOString(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
        return;
      }

      onSubscriptionSuccess();
    } catch (err: any) {
      console.error("Subscription activation failed:", err);
      setError(err?.message || "Payment processor experienced a temporary disconnect. Please retry.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#070313]/95 backdrop-blur-xl overflow-y-auto flex items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-cyan-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full bg-pink-600/15 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl relative z-14 my-8">
        
        {/* Top Dismiss Button for upgrade screen (non-expired gate) */}
        {!isExpiredOnly && onClose && (
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 p-2 text-neutral-400 hover:text-white transition"
          >
            ✕ Close Details
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
          
          {/* Left Column: Plans and trial notification */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            
            <div className="space-y-3.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-extrabold uppercase tracking-widest rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Trial Period Concluded</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight font-sans">
                Subscribe to Unlock <span className="prism-text-gradient">Versona Prime</span>
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-md">
                Your 2-days complete calibration trial has wrapped up. To continue leveraging your tailored portfolio vectors, running your executive alter ego interview model, and compiling optimized cover emails, activate a premium subscription plan.
              </p>
            </div>

            {/* Select Plans Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Pro Plan */}
              <div
                onClick={() => setSelectedPlan("pro")}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedPlan === "pro"
                    ? "bg-white/5 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
                    : "bg-white/2 border-white/5 hover:border-white/10"
                }`}
              >
                {selectedPlan === "pro" && (
                  <div className="absolute top-3 right-3 bg-cyan-500/10 border border-cyan-500/20 rounded-full p-1 text-cyan-400">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </div>
                )}
                <span className="text-[9px] uppercase tracking-widest font-extrabold text-neutral-400">Professional</span>
                <div className="mt-2.5 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white font-sans">$19</span>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">/ monthly</span>
                </div>
                <ul className="mt-4 space-y-2 text-[10px]">
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-cyan-400 font-bold">✓</span> Infinite Job Tailoring
                  </li>
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-cyan-400 font-bold">✓</span> Full Resume PDF Exports
                  </li>
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-cyan-400 font-bold">✓</span> Standard Chat Responses
                  </li>
                </ul>
              </div>

              {/* Elite Plan */}
              <div
                onClick={() => setSelectedPlan("elite")}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedPlan === "elite"
                    ? "bg-white/5 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.12)]"
                    : "bg-white/2 border-white/5 hover:border-white/10"
                }`}
              >
                {selectedPlan === "elite" && (
                  <div className="absolute top-3 right-3 bg-pink-500/10 border border-pink-500/20 rounded-full p-1 text-pink-400">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase tracking-widest font-extrabold text-neutral-300">Elite Executive</span>
                  <span className="text-[7.5px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/10 scale-90">VIP</span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white font-sans">$49</span>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">/ monthly</span>
                </div>
                <ul className="mt-4 space-y-2 text-[10px]">
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-pink-400 font-bold">✓</span> Deep Research Grounding
                  </li>
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-pink-400 font-bold">✓</span> Personal Outreach Writer
                  </li>
                  <li className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-pink-400 font-bold">✓</span> Unlimited Alter Ego Chats
                  </li>
                </ul>
              </div>

            </div>

            {/* Logout or Change profile options */}
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span>Signed as: <strong className="text-neutral-350">{userEmail}</strong></span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 font-bold text-red-400 hover:text-red-300 transition uppercase tracking-wider text-[10px] bg-red-400/5 hover:bg-red-400/10 px-2.5 py-1.5 rounded-xl border border-red-400/10"
              >
                <LogOut className="w-3 h-3" /> Log Out
              </button>
            </div>

          </div>

          {/* Right Column: Checkout form */}
          <div className="lg:col-span-5 bg-white/3 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="flex items-center gap-1.5 border-b border-white/5 pb-3">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-350">Secure checkout validation</span>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-300 text-[10px] rounded-xl flex items-start gap-1.5 font-sans leading-normal">
                  <span className="text-red-400 font-extrabold">✕</span>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mb-1.5 ml-1">Plan selected</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white uppercase tracking-wider font-extrabold flex justify-between items-center">
                  <span>{selectedPlan === "pro" ? "Versona Professional" : "Versona Elite Executive"}</span>
                  <span className="text-neutral-400">{selectedPlan === "pro" ? "$19" : "$49"}/mo</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mb-1.5 ml-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Johnathan Doe"
                  className="w-full bg-white/3 border border-white/8 hover:border-white/12 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mb-1.5 ml-1">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4111 2222 3333 4444"
                    maxLength={19}
                    className="w-full bg-white/3 border border-white/8 hover:border-white/12 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mb-1.5 ml-1">Expiration</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full bg-white/3 border border-white/8 hover:border-white/12 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-widest text-neutral-400 mb-1.5 ml-1">Security CVC</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                    <input
                      type="password"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      placeholder="123"
                      maxLength={3}
                      className="w-full bg-white/3 border border-white/8 hover:border-white/12 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/35 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="prism-btn-active mt-2.5 w-full py-3 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying and Charging...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Authorize Billing</span>
                  </>
                )}
              </button>

              <span className="text-[8.5px] text-neutral-500 font-bold block text-center uppercase tracking-widest leading-relaxed">
                By subscribing, your account is upgraded instantly. Cancellable at any time from your settings panel.
              </span>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
