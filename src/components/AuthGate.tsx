import React, { useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface AuthGateProps {
  onSignedIn?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSignedIn?.();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('Sign-in popup was closed before completing. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg(
          'Your browser blocked the sign-in popup. Please allow popups for this site and try again.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg(
          'This domain is not yet authorized in Firebase Authentication settings.'
        );
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to sign in right now. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#F1F3F6] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl rounded-3xl bg-[#171A21] border border-white/[0.08] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Calm Sanctuary Panel */}
        <div className="lg:col-span-6 relative min-h-[240px] lg:min-h-[540px] flex flex-col justify-between p-7 sm:p-10 bg-gradient-to-br from-[#1C2229] via-[#151920] to-[#111419]">
          <img
            src="/src/assets/images/sanctuary_calm_horizon_1794911112791.jpg"
            alt="Calm twilight hills"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#13161C] via-[#13161C]/65 to-[#13161C]/35" />

          <div className="relative space-y-2">
            <p className="text-xs text-[#9EC5AB] tracking-wide">
              Personal Sanctuary · Private & Focused
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#F1F3F6] leading-tight text-balance">
              My World
            </h1>
          </div>

          <div className="relative space-y-5 mt-8">
            <p className="font-display text-xl sm:text-2xl text-[#F1F3F6] leading-snug text-balance">
              A quiet space for your thoughts, schedules, soundscapes, and memories.
            </p>

            <div className="space-y-3 pt-2 border-t border-white/[0.08]">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#9EC5AB] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#D0D5DD] leading-relaxed">
                  Your notes, tasks, alarms, and AES-256 encrypted vault remain stored privately on
                  this device.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#BEB4DC] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#D0D5DD] leading-relaxed">
                  Signing in protects entry to your sanctuary and enables Gemini Companion, Live
                  Voice, and Audio Transcription.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign In / Create Account Panel */}
        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            {/* Clean Segmented Switch */}
            <div
              role="tablist"
              aria-label="Account access mode"
              className="inline-flex p-1 rounded-2xl bg-[#11141A] border border-white/[0.06]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'signin'
                    ? 'bg-[#1D212A] text-[#F1F3F6]'
                    : 'text-[#98A2B3] hover:text-[#F1F3F6]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-[#1D212A] text-[#F1F3F6]'
                    : 'text-[#98A2B3] hover:text-[#F1F3F6]'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="font-display text-2xl font-medium text-[#F1F3F6] pt-2">
              {mode === 'signin' ? 'Welcome back' : 'Create your sanctuary'}
            </h2>
            <p className="text-sm text-[#98A2B3] leading-relaxed">
              {mode === 'signin'
                ? 'Sign in with your Google or Gmail account to enter My World.'
                : 'Use your Google or Gmail account to set up your personal My World profile in one tap.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-[#F2B8A2]/10 border border-[#F2B8A2]/30 px-4 py-3 text-xs text-[#F2B8A2] leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleGoogleAuth()}
              className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] disabled:opacity-60 text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-3 transition-colors"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-5 h-5 shrink-0"
              >
                <path
                  fill="#0F1115"
                  d="M21.805 10.023H12.2v3.955h5.52c-.238 1.275-.957 2.355-2.04 3.08v2.56h3.302c1.932-1.78 3.048-4.4 3.048-7.508 0-.705-.064-1.384-.225-2.087Z"
                />
                <path
                  fill="#0F1115"
                  d="M12.2 22c2.76 0 5.075-.915 6.767-2.382l-3.302-2.56c-.915.613-2.085.975-3.465.975-2.665 0-4.922-1.8-5.73-4.218H3.058v2.642C4.74 19.798 8.202 22 12.2 22Z"
                />
                <path
                  fill="#0F1115"
                  d="M6.47 13.815A5.97 5.97 0 0 1 6.155 12c0-.63.11-1.242.315-1.815V7.543H3.058A9.992 9.992 0 0 0 2 12c0 1.615.388 3.144 1.058 4.457l3.412-2.642Z"
                />
                <path
                  fill="#0F1115"
                  d="M12.2 5.967c1.501 0 2.848.516 3.908 1.53l2.931-2.931C17.27 2.912 14.955 2 12.2 2 8.202 2 4.74 4.202 3.058 7.543l3.412 2.642c.808-2.418 3.065-4.218 5.73-4.218Z"
                />
              </svg>
              <span>
                {loading
                  ? 'Connecting...'
                  : mode === 'signin'
                    ? 'Continue with Google'
                    : 'Sign Up with Google'}
              </span>
              {!loading && <ArrowRight className="w-4 h-4 shrink-0" />}
            </button>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex items-start gap-2.5 text-xs text-[#98A2B3] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#9EC5AB] mt-0.5 shrink-0" />
            <span>
              Secured by Firebase Authentication. No separate password to remember, and your local
              sanctuary data stays private to you.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
