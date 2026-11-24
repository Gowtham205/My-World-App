import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import {
  sendResetPasswordEmail,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase';

interface AuthGateProps {
  onSignedIn?: () => void;
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in popup was closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups or use Email & Password above.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method → Email/Password). Enable it there or continue with Google below.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your details and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Switch to Sign In instead.';
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error
        ? err.message
        : 'Unable to sign in right now. Please try again.';
  }
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<'email' | 'google' | 'reset' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingMethod) return;
    setErrorMsg(null);
    setStatusMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your name for your sanctuary profile.');
      return;
    }

    setLoadingMethod('email');
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
      }
      onSignedIn?.();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handlePasswordReset = async () => {
    if (loadingMethod) return;
    setErrorMsg(null);
    setStatusMsg(null);
    if (!email.trim()) {
      setErrorMsg('Enter your email address first, then tap Forgot password.');
      return;
    }
    setLoadingMethod('reset');
    try {
      await sendResetPasswordEmail(email);
      setStatusMsg(`Password reset email sent to ${email.trim()}.`);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleGoogleAuth = async () => {
    if (loadingMethod) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setLoadingMethod('google');
    try {
      await signInWithGoogle();
      onSignedIn?.();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoadingMethod(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] dark:bg-[#0F1115] text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center p-4 sm:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-5xl rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.10] dark:border-white/[0.08] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Calm Sanctuary Panel */}
        <div className="lg:col-span-6 relative min-h-[220px] lg:min-h-[560px] flex flex-col justify-between p-7 sm:p-10 bg-gradient-to-br from-[#1C2229] via-[#151920] to-[#111419]">
          <img
            src="/src/assets/images/sanctuary_calm_horizon_1794911112791.jpg"
            alt="Calm twilight hills"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#13161C] via-[#13161C]/65 to-[#13161C]/35" />

          <div className="relative space-y-2">
            <p className="text-xs text-[#9EC5AB] tracking-wide">
              Personal Sanctuary · Private &amp; Focused
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#F1F3F6] leading-tight text-balance">
              My World
            </h1>
          </div>

          <div className="relative space-y-5 mt-8">
            <p className="font-display text-xl sm:text-2xl text-[#F1F3F6] leading-snug text-balance">
              A quiet space for your thoughts, schedules, soundscapes, and memories.
            </p>

            <div className="space-y-3 pt-2 border-t border-white/[0.12]">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#9EC5AB] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#D0D5DD] leading-relaxed">
                  Your notes, tasks, alarms, custom audio, and AES-256 vault remain stored privately
                  on your device.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#BEB4DC] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#D0D5DD] leading-relaxed">
                  Sign in with any email address or your Google account to unlock your sanctuary.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign In / Create Account Panel */}
        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-5">
          <div className="space-y-2">
            <div
              role="tablist"
              aria-label="Account access mode"
              className="inline-flex p-1 rounded-2xl bg-[#ECEFF3] dark:bg-[#11141A] border border-slate-900/[0.08] dark:border-white/[0.06]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'signin'
                    ? 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#111827] dark:text-[#F1F3F6]'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
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
                  setStatusMsg(null);
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#111827] dark:text-[#F1F3F6]'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="font-display text-2xl font-medium text-[#111827] dark:text-[#F1F3F6] pt-1">
              {mode === 'signin' ? 'Welcome back' : 'Create your sanctuary'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
              {mode === 'signin'
                ? 'Sign in with your email and password, or continue with Google.'
                : 'Sign up with any email address or set up instantly using Google.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-[#F2B8A2]/10 border border-[#F2B8A2]/30 px-4 py-3 text-xs text-[#A6482D] dark:text-[#F2B8A2] leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              className="rounded-2xl bg-[#9EC5AB]/10 border border-[#9EC5AB]/30 px-4 py-3 text-xs text-[#2E6B48] dark:text-[#9EC5AB] leading-relaxed"
            >
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                  Your Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gowtham"
                    autoComplete="name"
                    className="w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] placeholder-[#5B6472]/60 dark:placeholder-[#98A2B3]/60 focus:outline-none focus:border-[#9EC5AB]/50"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] placeholder-[#5B6472]/60 dark:placeholder-[#98A2B3]/60 focus:outline-none focus:border-[#9EC5AB]/50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-password" className="block text-xs text-[#5B6472] dark:text-[#98A2B3]">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    disabled={loadingMethod !== null}
                    onClick={() => void handlePasswordReset()}
                    className="text-xs text-[#255F8A] dark:text-[#9BC4E2] hover:underline disabled:opacity-50"
                  >
                    {loadingMethod === 'reset' ? 'Sending...' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full min-h-[46px] pl-10 pr-11 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] placeholder-[#5B6472]/60 dark:placeholder-[#98A2B3]/60 focus:outline-none focus:border-[#9EC5AB]/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="w-10 h-10 absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingMethod !== null}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] disabled:opacity-60 text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <span>
                {loadingMethod === 'email'
                  ? mode === 'signin'
                    ? 'Signing In...'
                    : 'Creating Account...'
                  : mode === 'signin'
                    ? 'Sign In with Email'
                    : 'Create Account'}
              </span>
              {loadingMethod !== 'email' && <ArrowRight className="w-4 h-4 shrink-0" />}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-900/[0.08] dark:bg-white/[0.08]" />
            <span className="text-xs text-[#5B6472] dark:text-[#98A2B3]">or</span>
            <div className="h-px flex-1 bg-slate-900/[0.08] dark:bg-white/[0.08]" />
          </div>

          <button
            type="button"
            disabled={loadingMethod !== null}
            onClick={() => void handleGoogleAuth()}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.12] dark:border-white/[0.1] disabled:opacity-60 text-[#111827] dark:text-[#F1F3F6] text-sm font-medium flex items-center justify-center gap-3 transition-colors"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="w-4 h-4 shrink-0"
            >
              <path
                fill="currentColor"
                d="M21.805 10.023H12.2v3.955h5.52c-.238 1.275-.957 2.355-2.04 3.08v2.56h3.302c1.932-1.78 3.048-4.4 3.048-7.508 0-.705-.064-1.384-.225-2.087Z"
              />
              <path
                fill="currentColor"
                d="M12.2 22c2.76 0 5.075-.915 6.767-2.382l-3.302-2.56c-.915.613-2.085.975-3.465.975-2.665 0-4.922-1.8-5.73-4.218H3.058v2.642C4.74 19.798 8.202 22 12.2 22Z"
              />
              <path
                fill="currentColor"
                d="M6.47 13.815A5.97 5.97 0 0 1 6.155 12c0-.63.11-1.242.315-1.815V7.543H3.058A9.992 9.992 0 0 0 2 12c0 1.615.388 3.144 1.058 4.457l3.412-2.642Z"
              />
              <path
                fill="currentColor"
                d="M12.2 5.967c1.501 0 2.848.516 3.908 1.53l2.931-2.931C17.27 2.912 14.955 2 12.2 2 8.202 2 4.74 4.202 3.058 7.543l3.412 2.642c.808-2.418 3.065-4.218 5.73-4.218Z"
              />
            </svg>
            <span>
              {loadingMethod === 'google' ? 'Connecting Google...' : 'Continue with Google'}
            </span>
          </button>

          <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.06] flex items-start gap-2.5 text-xs text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB] mt-0.5 shrink-0" />
            <span>
              Secured by Firebase Authentication. Use Email & Password for mobile APK builds or
              Google Sign-In on the web.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
