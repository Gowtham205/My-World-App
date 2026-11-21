import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Download,
  Fingerprint,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Moon,
  Share2,
  ShieldCheck,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { User } from 'firebase/auth';
import type {
  AppRoute,
  AppTheme,
  CustomAudioTone,
  SecuritySettings,
} from '../types/sanctuary';
import {
  disableFingerprintUnlock,
  enrollFingerprintForPin,
  getBiometricAvailability,
  type BiometricAvailability,
} from '../lib/biometrics';
import { generateSalt, hashPin } from '../lib/crypto';
import { exportToDevicePublicStorage } from '../lib/nativeAudio';
import { BUILTIN_TONES } from '../lib/sound';
import { exportLocalBackupJson, getSetting, putInStore } from '../lib/storage';
import { ModernSelect } from './ModernSelect';

interface ProfileSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  authUser: User;
  currentDisplayName: string;
  isEmailVerified: boolean;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  onUpdateName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  defaultNotificationSoundId: string;
  customAudioTones: CustomAudioTone[];
  onChangeDefaultNotificationSound: (soundId: string) => void;
  unreadNotificationCount: number;
  onOpenNotifications: () => void;
  onNavigate: (route: AppRoute) => void;
  onSignOut: () => Promise<void>;
}

export const ProfileSettingsDrawer: React.FC<ProfileSettingsDrawerProps> = ({
  open,
  onClose,
  authUser,
  currentDisplayName,
  isEmailVerified,
  theme,
  onChangeTheme,
  onUpdateName,
  defaultNotificationSoundId,
  customAudioTones,
  onChangeDefaultNotificationSound,
  unreadNotificationCount,
  onOpenNotifications,
  onNavigate,
  onSignOut,
}) => {
  const [nameInput, setNameInput] = useState(currentDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{
    ok: boolean;
    message: string;
    path?: string;
    filename?: string;
    jsonCache?: string;
  } | null>(null);

  // Fingerprint & Master Lock setup state
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [biometricAvail, setBiometricAvail] = useState<BiometricAvailability>({
    available: false,
    platform: 'web',
  });
  const [showFingerprintForm, setShowFingerprintForm] = useState(false);
  const [fpPinInput, setFpPinInput] = useState('');
  const [fpConfirmPinInput, setFpConfirmPinInput] = useState('');
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNameInput(currentDisplayName);
    setNameFeedback(null);
    setNameError(null);
    setShowFingerprintForm(false);
    setFpPinInput('');
    setFpConfirmPinInput('');
    setFpError(null);
    setFpSuccess(null);
    setBackupNotice(null);

    let mounted = true;
    Promise.all([
      getSetting<SecuritySettings>('security'),
      getBiometricAvailability(),
    ]).then(([savedSec, bioAvail]) => {
      if (!mounted) return;
      setSecuritySettings(savedSec ?? null);
      setBiometricAvail(bioAvail);
    });

    return () => {
      mounted = false;
    };
  }, [open, currentDisplayName]);

  if (!open) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setNameError('Enter a name to display in your sanctuary.');
      return;
    }
    setSavingName(true);
    setNameError(null);
    setNameFeedback(null);
    const res = await onUpdateName(clean);
    setSavingName(false);
    if (res.ok) {
      setNameFeedback('Saved');
      window.setTimeout(() => setNameFeedback(null), 2200);
    } else {
      setNameError(res.error || 'Could not update name.');
    }
  };

  const handleSetupFingerprintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError(null);
    setFpSuccess(null);

    if (!/^\d{4,6}$/.test(fpPinInput)) {
      setFpError('Master PIN must be 4 to 6 digits.');
      return;
    }

    setFpBusy(true);
    try {
      let targetSettings = securitySettings;

      // If Master PIN hasn't been created yet, create it right here first
      if (!targetSettings) {
        if (fpPinInput !== fpConfirmPinInput) {
          setFpError('Master PIN and confirmation do not match.');
          setFpBusy(false);
          return;
        }
        const salt = generateSalt();
        const pinHash = await hashPin(fpPinInput, salt);
        targetSettings = {
          id: 'security',
          pinHash,
          pinSalt: salt,
          biometricEnabled: false,
          autoLockOnBackground: true,
          updatedAt: new Date().toISOString(),
        };
        await putInStore('settings', targetSettings);
        setSecuritySettings(targetSettings);
      }

      const enrollResult = await enrollFingerprintForPin(fpPinInput, targetSettings);
      if (!enrollResult.ok || !enrollResult.updatedSettings) {
        setFpError(enrollResult.error || 'Could not verify your fingerprint.');
        setFpBusy(false);
        return;
      }

      setSecuritySettings(enrollResult.updatedSettings);
      setShowFingerprintForm(false);
      setFpPinInput('');
      setFpConfirmPinInput('');
      setFpSuccess('Fingerprint unlock enabled for Secrets Vault & Private Gallery.');
    } catch {
      setFpError('Could not complete fingerprint setup.');
    } finally {
      setFpBusy(false);
    }
  };

  const handleDisableFingerprint = async () => {
    if (!securitySettings) return;
    setFpBusy(true);
    setFpError(null);
    setFpSuccess(null);
    try {
      const updated = await disableFingerprintUnlock(securitySettings);
      setSecuritySettings(updated);
      setFpSuccess('Fingerprint unlock disabled. Master PIN remains active.');
    } finally {
      setFpBusy(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    setBackupNotice(null);
    try {
      const json = await exportLocalBackupJson();
      const filename = `my-world-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await exportToDevicePublicStorage({
        filename,
        mimeType: 'application/json',
        folderType: 'backup',
        textContent: json,
      });

      if (result.ok) {
        setBackupNotice({
          ok: true,
          message: 'Backup saved successfully!',
          path: result.displayPath,
          filename,
          jsonCache: json,
        });
      } else {
        setBackupNotice({
          ok: false,
          message: result.error || 'Could not save backup file.',
        });
      }
    } catch {
      setBackupNotice({
        ok: false,
        message: 'Could not generate local backup.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleShareBackup = async () => {
    if (!backupNotice?.jsonCache || !backupNotice.filename) return;
    try {
      if (Capacitor.isNativePlatform()) {
        const cachePath = `backup_share/${backupNotice.filename}`;
        await Filesystem.writeFile({
          directory: Directory.Cache,
          path: cachePath,
          data: backupNotice.jsonCache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        const { uri } = await Filesystem.getUri({
          directory: Directory.Cache,
          path: cachePath,
        });
        await Share.share({
          title: 'My World Backup',
          text: 'My World Sanctuary local backup JSON',
          url: uri,
          dialogTitle: 'Share or save backup file',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'My World Backup',
          text: backupNotice.jsonCache,
        });
      }
    } catch {
      // ignore cancelled share sheet
    }
  };

  const providerIds = authUser.providerData?.map((p) => p.providerId) || [];
  const authProviderLabel = providerIds.includes('google.com')
    ? 'Google Account'
    : 'Email & Password';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 dark:bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Profile and Settings"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-md h-full bg-[#FAFDFB] dark:bg-[#131722] border-l border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[0.07] bg-gradient-to-r from-[#EEF7F1] via-[#F4F1FA] to-[#EDF5FB] dark:from-[#17211F] dark:via-[#1B1826] dark:to-[#16202B] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display text-lg font-medium text-[#111827] dark:text-[#F1F3F6]">
              Profile & Settings
            </h2>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
              Account, appearance, preferences & fingerprint lock
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile & Settings"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/80 dark:bg-[#1D212A] hover:bg-white dark:hover:bg-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center transition-colors shrink-0 border border-slate-900/[0.08] dark:border-white/[0.08]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* 1. Account & Display Name */}
          <section className="rounded-3xl bg-gradient-to-br from-[#EDF7F0] to-[#F9FCFA] dark:from-[#17231E] dark:to-[#171B24] border border-[#9EC5AB]/35 dark:border-[#9EC5AB]/20 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={currentDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-[#9EC5AB]/40"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#9EC5AB]/30 text-[#2E6B48] dark:text-[#9EC5AB] text-base font-semibold flex items-center justify-center shrink-0">
                  {(currentDisplayName || authUser.email || 'M')[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] truncate">
                  {currentDisplayName || authUser.email?.split('@')[0] || 'My World'}
                </p>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] truncate">
                  {authUser.email}
                </p>
                <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB] mt-0.5">
                  {authProviderLabel} · {isEmailVerified ? 'Verified' : 'Local active'}
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSaveName}
              className="space-y-2 pt-2 border-t border-slate-900/[0.07] dark:border-white/[0.06]"
            >
              <label
                htmlFor="profile-preferred-name"
                className="block text-xs font-medium text-[#5B6472] dark:text-[#98A2B3]"
              >
                Preferred Greeting Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="profile-preferred-name"
                  type="text"
                  maxLength={60}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Add preferred greeting name"
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#1D212A] border border-slate-900/[0.1] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="min-h-[44px] px-4 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] disabled:opacity-60 text-[#0F1115] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {nameFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {nameFeedback}
                    </>
                  ) : savingName ? (
                    'Saving...'
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
              {nameError && (
                <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]" role="alert">
                  {nameError}
                </p>
              )}
            </form>
          </section>

          {/* 2. Appearance (Light / Dark Mode) */}
          <section className="rounded-3xl bg-gradient-to-br from-[#F4F0FA] to-[#FAF9FD] dark:from-[#1D1A2B] dark:to-[#171B24] border border-[#BEB4DC]/35 dark:border-[#BEB4DC]/20 p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Appearance
              </h3>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                Switch between Dark twilight pastels and Light morning pastels.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/80 dark:bg-[#1D212A] border border-slate-900/[0.07] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => onChangeTheme('dark')}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  theme === 'dark'
                    ? 'bg-[#262238] text-[#EDE9FE] shadow-sm border border-[#BEB4DC]/35'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark Mode
              </button>
              <button
                type="button"
                onClick={() => onChangeTheme('light')}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  theme === 'light'
                    ? 'bg-[#EAE4F7] text-[#3B2E66] shadow-sm border border-[#BEB4DC]/50'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light Mode
              </button>
            </div>
          </section>

          {/* 3. Notifications & Default Sound */}
          <section className="rounded-3xl bg-gradient-to-br from-[#EDF5FB] to-[#F9FCFF] dark:from-[#16202C] dark:to-[#171B24] border border-[#9BC4E2]/35 dark:border-[#9BC4E2]/20 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Notifications & Sounds
                </h3>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                  Review missed alerts and choose your default chime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNotifications();
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#1D212A] border border-[#9BC4E2]/35 text-xs font-medium text-[#1E5F8A] dark:text-[#9BC4E2] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bell className="w-3.5 h-3.5" />
                Inbox{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}
              </button>
            </div>

            <div>
              <label
                htmlFor="settings-default-chime"
                className="flex items-center gap-1.5 text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Default Reminder & Event Calm Sound
              </label>
              <ModernSelect
                id="settings-default-chime"
                ariaLabel="Default Reminder and Event Calm Sound"
                title="Default Notification Sound"
                accent="sky"
                triggerClassName="bg-white dark:bg-[#1D212A]"
                value={defaultNotificationSoundId}
                onChange={onChangeDefaultNotificationSound}
                options={[
                  ...BUILTIN_TONES.map((tone) => ({
                    value: tone.id,
                    label: tone.label,
                    group: 'Built-In Tones',
                  })),
                  ...customAudioTones.map((tone) => ({
                    value: tone.id,
                    label: tone.name,
                    group: 'Uploaded Audio',
                  })),
                ]}
              />
            </div>
          </section>

          {/* 4. Security, Fingerprint Unlock & Local Backup */}
          <section className="rounded-3xl bg-gradient-to-br from-[#FDF4F0] to-[#FFFCFA] dark:from-[#241B1C] dark:to-[#171B24] border border-[#F2B8A2]/35 dark:border-[#F2B8A2]/20 p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
              Security & Fingerprint Lock
            </h3>

            {/* Set Fingerprint Card */}
            <div className="rounded-2xl bg-white/90 dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.08] p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#BEB4DC]/25 dark:bg-[#BEB4DC]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Fingerprint className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111827] dark:text-[#F1F3F6]">
                      Fingerprint Unlock
                    </p>
                    <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] mt-0.5 leading-relaxed">
                      {securitySettings?.biometricEnabled
                        ? 'Active for Secrets Vault & Private Media Gallery.'
                        : biometricAvail.available
                          ? 'Unlock Vault & Private Gallery directly with your fingerprint.'
                          : biometricAvail.reason ||
                            'Use your Master PIN when biometrics are unavailable.'}
                    </p>
                  </div>
                </div>

                {securitySettings?.biometricEnabled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E6B48] dark:text-[#9EC5AB] shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    On
                  </span>
                ) : null}
              </div>

              {fpSuccess && (
                <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]" role="status">
                  {fpSuccess}
                </p>
              )}
              {fpError && (
                <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]" role="alert">
                  {fpError}
                </p>
              )}

              {!showFingerprintForm ? (
                <div className="flex flex-wrap items-center gap-2">
                  {biometricAvail.available && (
                    <button
                      type="button"
                      disabled={fpBusy}
                      onClick={() => {
                        setFpError(null);
                        setFpSuccess(null);
                        setShowFingerprintForm(true);
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      {securitySettings?.biometricEnabled
                        ? 'Re-link Fingerprint'
                        : securitySettings
                          ? 'Set Fingerprint'
                          : 'Set PIN & Fingerprint'}
                    </button>
                  )}

                  {securitySettings?.biometricEnabled && (
                    <button
                      type="button"
                      disabled={fpBusy}
                      onClick={() => void handleDisableFingerprint()}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.06] text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
                    >
                      Disable
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSetupFingerprintSubmit} className="space-y-2.5 pt-1">
                  <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                    {securitySettings
                      ? 'Confirm your current Master PIN, then scan your fingerprint.'
                      : 'Create a 4–6 digit Master PIN, then scan your fingerprint.'}
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={fpPinInput}
                    onChange={(e) => setFpPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={securitySettings ? 'Current Master PIN' : 'New Master PIN (4–6 digits)'}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F6F8] dark:bg-[#13161C] border border-slate-900/[0.1] dark:border-white/[0.08] text-xs font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
                  />
                  {!securitySettings && (
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={fpConfirmPinInput}
                      onChange={(e) => setFpConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Confirm Master PIN"
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F6F8] dark:bg-[#13161C] border border-slate-900/[0.1] dark:border-white/[0.08] text-xs font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
                    />
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFingerprintForm(false);
                        setFpPinInput('');
                        setFpConfirmPinInput('');
                        setFpError(null);
                      }}
                      className="min-h-[38px] px-3 rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.06] text-xs text-[#334155] dark:text-[#D0D5DD]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={fpBusy}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      {fpBusy ? 'Verifying...' : 'Verify Fingerprint'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('vault');
              }}
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/90 dark:bg-[#1D212A] hover:bg-white dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
            >
              <span className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />
                Secrets Vault & PIN Lock
              </span>
              <span className="text-[#5B6472] dark:text-[#98A2B3]">Open</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('gallery');
              }}
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/90 dark:bg-[#1D212A] hover:bg-white dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
            >
              <span className="flex items-center gap-2.5">
                <ImageIcon className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2]" />
                Private Media Gallery
              </span>
              <span className="text-[#5B6472] dark:text-[#98A2B3]">Open</span>
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportBackup()}
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/90 dark:bg-[#1D212A] hover:bg-white dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
            >
              <span className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
                {exporting ? 'Saving Backup...' : 'Export Local Backup (.json)'}
              </span>
              <span className="text-[#5B6472] dark:text-[#98A2B3]">Download</span>
            </button>

            {backupNotice && (
              <div
                role="status"
                className={`rounded-2xl p-3.5 text-xs space-y-2 border ${
                  backupNotice.ok
                    ? 'bg-[#E4F2E9] dark:bg-[#192B22] border-[#9EC5AB]/45 text-[#1F5638] dark:text-[#A9DFBE]'
                    : 'bg-[#FCEEE9] dark:bg-[#2B1B18] border-[#F2B8A2]/45 text-[#A6482D] dark:text-[#F2B8A2]'
                }`}
              >
                <p className="font-semibold">{backupNotice.message}</p>
                {backupNotice.path && (
                  <p className="font-mono-tabular text-[11px] break-all opacity-90">
                    Saved to: {backupNotice.path}
                  </p>
                )}
                {backupNotice.ok && backupNotice.jsonCache && (
                  <button
                    type="button"
                    onClick={() => void handleShareBackup()}
                    className="min-h-[36px] px-3 rounded-xl bg-white/85 dark:bg-[#131722] border border-slate-900/[0.08] dark:border-white/[0.08] text-[11px] font-semibold text-[#255F8A] dark:text-[#9BC4E2] inline-flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share / Save Copy
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 5. About App */}
          <section className="rounded-3xl bg-white/75 dark:bg-[#171B24] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3]" />
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                About My World
              </h3>
            </div>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
              My World keeps your notes, tasks, alarms, custom audio, secrets vault, and private
              gallery stored strictly on your own device in local IndexedDB storage.
            </p>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
              Version 1.0 · Offline-first personal sanctuary
            </p>
          </section>
        </div>

        {/* Footer Sign Out */}
        <div className="p-5 border-t border-slate-900/[0.08] dark:border-white/[0.07] shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              void onSignOut();
            }}
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[#F2B8A2]/25 hover:bg-[#F2B8A2]/35 border border-[#F2B8A2]/45 text-[#A6482D] dark:text-[#F2B8A2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </div>
  );
};
