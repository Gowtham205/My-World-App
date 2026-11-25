import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import {
  isMobileEnvironment,
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
  const rawMessage = err instanceof Error ? err.message : '';
  if (/invalid_request/i.test(rawMessage)) {
    return 'Google Sign-In is not available in this mobile view. Please use Email & Password above.';
  }
  switch (code) {
    case 'auth/native-webview-google-blocked':
    case 'auth/in-app-webview-blocked':
      return 'Google Sign-In is not available on mobile right now and will be released in a future update. Please use Email & Password above.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in popup was closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups in your browser settings or use Email & Password above.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method → Email/Password). Enable it there to sign in on mobile.';
    case 'auth/network-request-failed':
      return 'Network request failed. Please check your mobile internet connection and try again.';
    case 'auth/internal-error':
      return 'Sign-in could not complete in this browser view. Try Email & Password above or open in Chrome/Safari.';
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
      return rawMessage || 'Unable to sign in right now. Please try again.';
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

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const [hideGoogleAuth, setHideGoogleAuth] = useState<boolean>(() => isMobileEnvironment());
  const isSignUp = mode === 'signup';

  useEffect(() => {
    const syncViewport = () => {
      setHideGoogleAuth(isMobileEnvironment());
    };
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setErrorMsg(null);
    setStatusMsg(null);
    window.requestAnimationFrame(() => {
      if (nextMode === 'signup') {
        nameInputRef.current?.focus();
      } else {
        emailInputRef.current?.focus();
      }
    });
  };

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
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#DFEFE6] via-[#E8EFFB] to-[#F5E7F0] dark:from-[#0E151B] dark:via-[#141726] dark:to-[#18131E] text-[#0F172A] dark:text-[#F1F3F6] flex items-center justify-center p-4 sm:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-5xl rounded-3xl bg-white/95 dark:bg-[#171B26]/95 backdrop-blur-md border border-slate-900/[0.12] dark:border-white/[0.10] shadow-[0_24px_60px_-15px_rgba(30,41,59,0.16)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Calm Sanctuary Panel */}
        <div className="lg:col-span-6 relative min-h-[210px] lg:min-h-[580px] flex flex-col justify-between p-7 sm:p-10 bg-gradient-to-br from-[#1B3A35] via-[#212A45] to-[#2C213D]">
          <img
            src="/src/assets/images/sanctuary_calm_horizon_1794911112791.jpg"
            alt="Calm twilight hills"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121A24]/95 via-[#182132]/72 to-[#192D32]/55" />

          <div className="relative space-y-2">
            <p className="text-xs font-medium text-[#AEE0C1] tracking-wide">
              Personal Sanctuary · Private &amp; Focused
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-white leading-tight text-balance">
              My World
            </h1>
          </div>

          <div className="relative space-y-5 mt-6">
            <p className="font-display text-xl sm:text-2xl text-[#F8FAFC] leading-snug text-balance">
              A quiet space for your thoughts, schedules, soundscapes, and memories.
            </p>

            <div className="space-y-3 pt-3 border-t border-white/20">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#AEE0C1] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed">
                  Your notes, tasks, alarms, custom audio, and AES-256 vault remain stored privately
                  on your device.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[#D6CCFA] mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed">
                  {hideGoogleAuth
                    ? 'Sign in or create a new account using your email address and password to unlock your sanctuary.'
                    : 'Sign in with any email address or your Google account to unlock your sanctuary.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign In / Create Account Panel */}
        <div
          className={`lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center space-y-5 transition-colors ${
            isSignUp
              ? 'bg-gradient-to-br from-[#F7F4FD] via-[#FFFFFF] to-[#F3F8FE] dark:from-[#1C1829] dark:via-[#171B26] dark:to-[#161D28]'
              : 'bg-gradient-to-br from-[#F2FAF5] via-[#FFFFFF] to-[#F3F8FD] dark:from-[#16221E] dark:via-[#171B26] dark:to-[#161D27]'
          }`}
        >
          {/* Screen Header */}
          <div className="space-y-1">
              <p
                className={`text-xs font-semibold ${
                  isSignUp
                    ? 'text-[#4E3F80] dark:text-[#C7B8EA]'
                    : 'text-[#225839] dark:text-[#9EC5AB]'
                }`}
              >
                {isSignUp ? 'New Account Registration' : 'Existing Account Sign In'}
              </p>
              <h2 className="font-display text-2xl font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {isSignUp ? 'Create your sanctuary' : 'Welcome back'}
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                {hideGoogleAuth
                  ? isSignUp
                    ? 'Fill in your name, email address, and a password to get started.'
                    : 'Sign in with your email and password to unlock your sanctuary.'
                  : isSignUp
                    ? 'Create an account with any email address or set up instantly using Google.'
                    : 'Sign in with your email and password, or continue with Google.'}
              </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-[#FDECE6] dark:bg-[#2F1E1A] border border-[#E7A68E] dark:border-[#F2B8A2]/40 px-4 py-3 text-xs font-medium text-[#9A3412] dark:text-[#F2B8A2] leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              className="rounded-2xl bg-[#EAF7EF] dark:bg-[#192820] border border-[#7EB691] dark:border-[#9EC5AB]/40 px-4 py-3 text-xs font-medium text-[#1F5134] dark:text-[#9EC5AB] leading-relaxed"
            >
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {isSignUp && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                >
                  Your Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={nameInputRef}
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gowtham"
                    autoComplete="name"
                    className="w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-300 dark:border-white/[0.14] text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#4E3F80]/25 focus:border-[#4E3F80] dark:focus:border-[#BEB4DC]"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1] mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={emailInputRef}
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-300 dark:border-white/[0.14] text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-2 ${
                    isSignUp
                      ? 'focus:ring-[#4E3F80]/25 focus:border-[#4E3F80] dark:focus:border-[#BEB4DC]'
                      : 'focus:ring-[#225839]/25 focus:border-[#225839] dark:focus:border-[#9EC5AB]'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#334155] dark:text-[#CBD5E1]"
                >
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    disabled={loadingMethod !== null}
                    onClick={() => void handlePasswordReset()}
                    className="text-xs font-medium text-[#1B5780] dark:text-[#9BC4E2] hover:underline disabled:opacity-50"
                  >
                    {loadingMethod === 'reset' ? 'Sending...' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className={`w-full min-h-[46px] pl-10 pr-11 rounded-2xl bg-white dark:bg-[#1E2330] border border-slate-300 dark:border-white/[0.14] text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-2 ${
                    isSignUp
                      ? 'focus:ring-[#4E3F80]/25 focus:border-[#4E3F80] dark:focus:border-[#BEB4DC]'
                      : 'focus:ring-[#225839]/25 focus:border-[#225839] dark:focus:border-[#9EC5AB]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="w-10 h-10 absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingMethod !== null}
              className={`w-full min-h-[48px] px-5 py-3 rounded-2xl disabled:opacity-60 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs ${
                isSignUp
                  ? 'bg-[#4E3F80] hover:bg-[#3F3269] text-white dark:bg-[#BEB4DC] dark:hover:bg-[#AFA3D4] dark:text-[#0F1115]'
                  : 'bg-[#225839] hover:bg-[#1A462D] text-white dark:bg-[#9EC5AB] dark:hover:bg-[#8EB89D] dark:text-[#0F1115]'
              }`}
            >
              <span>
                {loadingMethod === 'email'
                  ? !isSignUp
                    ? 'Signing In...'
                    : 'Creating Account...'
                  : !isSignUp
                    ? 'Sign In with Email'
                    : 'Create Account'}
              </span>
              {loadingMethod !== 'email' && <ArrowRight className="w-4 h-4 shrink-0" />}
            </button>
          </form>

          {/* Clear clickable switch prompt for new/returning users */}
          <div
            className={`rounded-2xl px-4 py-3 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs ${
              isSignUp
                ? 'bg-[#ECF7F0] dark:bg-[#16231D] border-[#9EC5AB]/60 dark:border-[#9EC5AB]/30'
                : 'bg-[#F3EFFC] dark:bg-[#1E1A2E] border-[#BEB4DC]/65 dark:border-[#BEB4DC]/30'
            }`}
          >
            <span className="text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
              {isSignUp
                ? 'Already have a My World account?'
                : "Don't have an account yet? Try signing up and creating an account."}
            </span>
            <button
              type="button"
              onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto inline-flex items-center gap-2 transition-colors ${
                isSignUp
                  ? 'bg-[#225839] hover:bg-[#1A462D] text-white dark:bg-[#9EC5AB] dark:hover:bg-[#8EB89D] dark:text-[#0F1115]'
                  : 'bg-[#4E3F80] hover:bg-[#3F3269] text-white dark:bg-[#BEB4DC] dark:hover:bg-[#AFA3D4] dark:text-[#0F1115]'
              }`}
            >
              {isSignUp ? (
                <>
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </div>

          {hideGoogleAuth ? (
            <div className="rounded-2xl bg-[#FCF5E6] dark:bg-[#241F15] border border-[#EDD59E] dark:border-[#EDD59E]/30 p-4 space-y-1.5 text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
              <p className="font-semibold text-[#8A5A12] dark:text-[#EDD59E]">
                Mobile Sign-In Note · Future Update
              </p>
              <p>
                “Continue with Google” is currently disabled on mobile and will be released in a
                future update. Please use Email &amp; Password above to sign in or create an
                account.
              </p>
              <p className="text-[#475569] dark:text-[#98A2B3]">
                Already signed in with Google on desktop? Enter that Gmail address above and tap{' '}
                <strong>Forgot password?</strong> to set a password for the same account.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-900/[0.12] dark:bg-white/[0.10]" />
                <span className="text-xs font-medium text-[#475569] dark:text-[#98A2B3]">or</span>
                <div className="h-px flex-1 bg-slate-900/[0.12] dark:bg-white/[0.10]" />
              </div>

              <button
                type="button"
                disabled={loadingMethod !== null}
                onClick={() => void handleGoogleAuth()}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#EBF5FC] dark:bg-[#1A2430] hover:bg-[#DFEFFA] dark:hover:bg-[#212E3D] border border-[#9BC4E2]/70 dark:border-[#9BC4E2]/30 disabled:opacity-60 text-[#0F172A] dark:text-[#F1F3F6] text-sm font-medium flex items-center justify-center gap-3 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 shrink-0 text-[#1B5780] dark:text-[#9BC4E2]"
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
            </>
          )}

          <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex items-start gap-2.5 text-xs text-[#475569] dark:text-[#98A2B3] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[#225839] dark:text-[#9EC5AB] mt-0.5 shrink-0" />
            <span>
              Secured by Firebase Authentication.
              {hideGoogleAuth
                ? ' Email & Password works directly on mobile.'
                : ' Use Email & Password or Google Sign-In in Chrome/Safari.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
