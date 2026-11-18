import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldCheck,
  Square,
} from 'lucide-react';
import {
  clearStoredBiometricData,
  enrollFingerprintForPin,
  getBiometricAvailability,
  unlockVaultWithFingerprint,
  type BiometricAvailability,
} from '../lib/biometrics';
import { deriveVaultKey, generateSalt, hashPin } from '../lib/crypto';
import { clearStore, deleteFromStore, getSetting, putInStore } from '../lib/storage';
import type { SecuritySettings } from '../types/sanctuary';

interface SecurityGateProps {
  areaTitle: string;
  areaSubtitle: string;
  accentColor?: 'lavender' | 'sky';
  onUnlock: (derivedKey: CryptoKey) => void;
  onResetVault?: () => Promise<void> | void;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({
  areaTitle,
  areaSubtitle,
  accentColor = 'lavender',
  onUnlock,
  onResetVault,
}) => {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [biometricAvail, setBiometricAvail] = useState<BiometricAvailability>({
    available: false,
    platform: 'web',
  });
  const [linkFingerprintWithPin, setLinkFingerprintWithPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const [saved, bioAvail] = await Promise.all([
        getSetting<SecuritySettings>('security'),
        getBiometricAvailability(),
      ]);
      if (!mounted) return;
      setSettings(saved ?? null);
      setBiometricAvail(bioAvail);
      // Default check "Enable fingerprint" during setup, or unchecked until requested when already configured
      setLinkFingerprintWithPin(!saved ? bioAvail.available : false);
      setLoading(false);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const accentBg =
    accentColor === 'sky'
      ? 'bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115]'
      : 'bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115]';
  const accentText =
    accentColor === 'sky'
      ? 'text-[#1E5F8A] dark:text-[#9BC4E2]'
      : 'text-[#5B4D8A] dark:text-[#BEB4DC]';
  const accentBorder =
    accentColor === 'sky'
      ? 'border-[#9BC4E2]/45 bg-gradient-to-br from-[#EDF6FC] via-[#F7FBFE] to-[#FFFFFF] dark:from-[#17222D] dark:via-[#171B24] dark:to-[#171A21]'
      : 'border-[#BEB4DC]/45 bg-gradient-to-br from-[#F3EFFC] via-[#F9F7FD] to-[#FFFFFF] dark:from-[#201B2E] dark:via-[#181A24] dark:to-[#171A21]';

  const handleDigit = (digit: string) => {
    setError('');
    setInfoNotice('');
    if (!settings) {
      if (setupStep === 'create') {
        if (pin.length < 6) setPin((p) => p + digit);
      } else {
        if (confirmPin.length < 6) setConfirmPin((p) => p + digit);
      }
    } else {
      if (pin.length < 6) setPin((p) => p + digit);
    }
  };

  const handleBackspace = () => {
    setError('');
    setInfoNotice('');
    if (!settings && setupStep === 'confirm') {
      setConfirmPin((p) => p.slice(0, -1));
    } else {
      setPin((p) => p.slice(0, -1));
    }
  };

  const handleSetupContinue = async () => {
    if (setupStep === 'create') {
      if (pin.length < 4) {
        setError('Please choose a PIN of 4 to 6 digits.');
        return;
      }
      setSetupStep('confirm');
      return;
    }

    if (confirmPin !== pin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const salt = generateSalt();
      const pinHash = await hashPin(pin, salt);
      const baseSettings: SecuritySettings = {
        id: 'security',
        pinHash,
        pinSalt: salt,
        biometricEnabled: false,
        autoLockOnBackground: true,
        updatedAt: new Date().toISOString(),
      };
      await putInStore('settings', baseSettings);

      if (biometricAvail.available && linkFingerprintWithPin) {
        await enrollFingerprintForPin(pin, baseSettings);
      }

      const key = await deriveVaultKey(pin, salt);
      onUnlock(key);
    } catch {
      setError('Could not initialize local lock.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!settings || pin.length < 4) {
      setError('Enter your 4–6 digit Master PIN.');
      return;
    }
    setBusy(true);
    setError('');
    setInfoNotice('');
    try {
      const candidateHash = await hashPin(pin, settings.pinSalt);
      if (candidateHash !== settings.pinHash) {
        setError('Incorrect PIN. Please try again.');
        setPin('');
        setBusy(false);
        return;
      }

      if (!settings.biometricEnabled && biometricAvail.available && linkFingerprintWithPin) {
        const enrolled = await enrollFingerprintForPin(pin, settings);
        if (!enrolled.ok && enrolled.error) {
          // Non-blocking: unlock still succeeds with verified PIN
          setInfoNotice(enrolled.error);
        }
      }

      const key = await deriveVaultKey(pin, settings.pinSalt);
      onUnlock(key);
    } catch {
      setError('Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!settings) return;
    setError('');
    setInfoNotice('');

    if (!settings.biometricEnabled) {
      if (biometricAvail.available) {
        setLinkFingerprintWithPin(true);
        setInfoNotice(
          'Fingerprint is not linked yet. Enter your PIN below with "Enable Fingerprint Unlock" checked, or set it up in Settings.'
        );
      } else {
        setInfoNotice(
          biometricAvail.reason ||
            'Fingerprint hardware is not available here. Enter your Master PIN below.'
        );
      }
      return;
    }

    setBusy(true);
    const result = await unlockVaultWithFingerprint(settings);
    setBusy(false);

    if (!result.ok || !result.key) {
      setError(result.error || 'Fingerprint verification failed. Use your Master PIN.');
      return;
    }

    onUnlock(result.key);
  };

  const handleResetLock = async () => {
    setBusy(true);
    try {
      await clearStore('vault');
      await deleteFromStore('settings', 'security');
      await clearStoredBiometricData();
      if (onResetVault) {
        await onResetVault();
      }
      setSettings(null);
      setPin('');
      setConfirmPin('');
      setSetupStep('create');
      setShowResetConfirm(false);
      setError('');
      setInfoNotice('');
    } catch {
      setError('Could not reset lock settings.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">Preparing locked area...</p>
      </div>
    );
  }

  const activePinValue = !settings && setupStep === 'confirm' ? confirmPin : pin;

  return (
    <div className="max-w-md mx-auto py-6 px-2">
      <div className={`border rounded-3xl p-6 sm:p-8 text-center shadow-sm ${accentBorder}`}>
        <div
          className={`w-12 h-12 rounded-2xl border border-slate-900/[0.08] dark:border-white/[0.1] flex items-center justify-center mx-auto mb-4 ${
            accentColor === 'sky'
              ? 'bg-[#9BC4E2]/25 dark:bg-[#9BC4E2]/15'
              : 'bg-[#BEB4DC]/25 dark:bg-[#BEB4DC]/15'
          }`}
        >
          {settings ? (
            <Lock className={`w-5 h-5 ${accentText}`} />
          ) : (
            <ShieldCheck className={`w-5 h-5 ${accentText}`} />
          )}
        </div>

        <h2 className="font-display text-2xl font-medium text-[#111827] dark:text-[#F1F3F6] tracking-tight">
          {settings ? areaTitle : 'Set Your Master PIN'}
        </h2>
        <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] mt-1.5 leading-relaxed">
          {settings
            ? areaSubtitle
            : setupStep === 'create'
              ? 'Create a 4–6 digit PIN to lock your Secrets Vault and Private Gallery on this device.'
              : 'Re-enter your Master PIN to confirm.'}
        </p>

        {/* PIN Dots */}
        <div className="flex items-center justify-center gap-3 my-6" aria-label="PIN progress">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const filled = idx < activePinValue.length;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  filled
                    ? accentColor === 'sky'
                      ? 'bg-[#255F8A] dark:bg-[#9BC4E2] scale-110'
                      : 'bg-[#5B4D8A] dark:bg-[#BEB4DC] scale-110'
                    : 'bg-slate-900/[0.08] dark:bg-white/[0.08] border border-slate-900/[0.14] dark:border-white/[0.12]'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2] mb-4 min-h-[1rem]" role="alert">
            {error}
          </p>
        )}

        {infoNotice && (
          <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2] mb-4 min-h-[1rem]" role="status">
            {infoNotice}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-13 min-h-[48px] rounded-2xl bg-white/80 dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.06] dark:border-white/[0.06] active:scale-95 text-[#111827] dark:text-[#F1F3F6] font-mono-tabular text-lg font-medium transition-all focus-visible:outline-2 focus-visible:outline-[#9EC5AB]"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={settings ? () => void handleBiometricUnlock() : () => setSetupStep('create')}
            disabled={busy}
            aria-label={settings ? 'Unlock with Fingerprint' : 'Restart PIN'}
            title={
              settings
                ? settings.biometricEnabled
                  ? 'Unlock with Fingerprint'
                  : 'Set up / Use Fingerprint'
                : 'Restart PIN'
            }
            className={`h-13 min-h-[48px] rounded-2xl border flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[#9EC5AB] ${
              settings && settings.biometricEnabled
                ? accentColor === 'sky'
                  ? 'bg-[#9BC4E2]/25 border-[#9BC4E2]/50 hover:bg-[#9BC4E2]/35'
                  : 'bg-[#BEB4DC]/25 border-[#BEB4DC]/50 hover:bg-[#BEB4DC]/35'
                : 'bg-[#E8ECF2] dark:bg-[#1D212A]/60 border-slate-900/[0.06] dark:border-white/[0.06] hover:bg-slate-900/[0.07] dark:hover:bg-white/[0.07]'
            }`}
          >
            {settings ? (
              <Fingerprint
                className={`w-5 h-5 ${
                  settings.biometricEnabled
                    ? accentText
                    : biometricAvail.available
                      ? `${accentText} opacity-75`
                      : 'text-[#5B6472] dark:text-[#98A2B3] opacity-40'
                }`}
              />
            ) : (
              <KeyRound className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-13 min-h-[48px] rounded-2xl bg-white/80 dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.06] dark:border-white/[0.06] active:scale-95 text-[#111827] dark:text-[#F1F3F6] font-mono-tabular text-lg font-medium transition-all focus-visible:outline-2 focus-visible:outline-[#9EC5AB]"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Delete digit"
            className="h-13 min-h-[48px] rounded-2xl bg-[#E8ECF2] dark:bg-[#1D212A]/60 hover:bg-slate-900/[0.07] dark:hover:bg-white/[0.07] border border-slate-900/[0.06] dark:border-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[#9EC5AB]"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Fingerprint enrollment option (on first setup OR when PIN is set but fingerprint not yet enabled) */}
        {biometricAvail.available &&
          ((!settings && setupStep === 'confirm') || (settings && !settings.biometricEnabled)) && (
            <button
              type="button"
              onClick={() => setLinkFingerprintWithPin((v) => !v)}
              className="w-full min-h-[42px] mb-3 px-3.5 rounded-2xl bg-white/75 dark:bg-[#1D212A]/80 border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center gap-2 text-xs font-medium text-[#334155] dark:text-[#D0D5DD]"
            >
              {linkFingerprintWithPin ? (
                <CheckSquare className={`w-4 h-4 shrink-0 ${accentText}`} />
              ) : (
                <Square className="w-4 h-4 shrink-0 text-[#5B6472] dark:text-[#98A2B3]" />
              )}
              <span>Enable Fingerprint unlock for next time</span>
            </button>
          )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busy || activePinValue.length < 4}
            onClick={settings ? () => void handleVerifyPin() : () => void handleSetupContinue()}
            className={`w-full min-h-[48px] rounded-2xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] ${accentBg}`}
          >
            {busy
              ? 'Unlocking...'
              : settings
                ? 'Unlock with PIN'
                : setupStep === 'create'
                  ? 'Continue'
                  : 'Save PIN & Enter'}
          </button>

          {settings && settings.biometricEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBiometricUnlock()}
              className={`w-full min-h-[46px] rounded-2xl border border-slate-900/[0.1] dark:border-white/[0.1] bg-white/85 dark:bg-[#1D212A] hover:bg-white dark:hover:bg-[#232833] text-sm font-medium ${accentText} inline-flex items-center justify-center gap-2 transition-colors`}
            >
              <Fingerprint className="w-4 h-4" />
              Unlock with Fingerprint
            </button>
          )}
        </div>

        {settings && !showResetConfirm && (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="mt-4 min-h-[40px] px-3 rounded-xl text-xs text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Forgot or Reset Lock
          </button>
        )}

        {settings && showResetConfirm && (
          <div className="mt-4 p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-[#F2B8A2]/40 text-left space-y-3">
            <p className="text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]">Reset Master PIN?</p>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
              Resetting your PIN lets you set a new lock code. Previously saved Secrets Vault entries
              locked with the old PIN will be cleared; your Private Gallery photos, Notes, Tasks,
              and Birthdays will stay safe.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="min-h-[38px] px-3 rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.06] text-xs text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResetLock()}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#F2B8A2] text-[#0F1115] text-xs font-semibold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-4">
          Local device lock · Auto-locks whenever you leave or minimize
        </p>
      </div>
    </div>
  );
};
