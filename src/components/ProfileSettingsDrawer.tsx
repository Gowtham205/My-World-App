import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Download,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Moon,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AppRoute, AppTheme, CustomAudioTone } from '../types/sanctuary';
import { BUILTIN_TONES } from '../lib/sound';
import { exportLocalBackupJson } from '../lib/storage';

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

  useEffect(() => {
    if (open) {
      setNameInput(currentDisplayName);
      setNameFeedback(null);
      setNameError(null);
    }
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

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const json = await exportLocalBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-world-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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
        className="w-full max-w-md h-full bg-white dark:bg-[#13161C] border-l border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display text-lg font-medium text-[#111827] dark:text-[#F1F3F6]">
              Profile & Settings
            </h2>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
              Account, appearance, preferences & app info
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile & Settings"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* 1. Account & Display Name */}
          <section className="rounded-3xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={currentDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-900/10 dark:border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#9EC5AB]/25 text-[#2E6B48] dark:text-[#9EC5AB] text-base font-semibold flex items-center justify-center shrink-0">
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

            <form onSubmit={handleSaveName} className="space-y-2 pt-2 border-t border-slate-900/[0.07] dark:border-white/[0.06]">
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
          <section className="rounded-3xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Appearance
              </h3>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                Switch between Dark sanctuary mode and crisp Light mode.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => onChangeTheme('dark')}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                  theme === 'dark'
                    ? 'bg-[#171A21] text-[#F1F3F6] shadow-sm border border-white/[0.08]'
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
                    ? 'bg-white text-[#111827] shadow-sm border border-slate-900/[0.08]'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light Mode
              </button>
            </div>
          </section>

          {/* 3. Notifications & Default Sound */}
          <section className="rounded-3xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-3.5">
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
                className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
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
              <select
                id="settings-default-chime"
                value={defaultNotificationSoundId}
                onChange={(e) => onChangeDefaultNotificationSound(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#1D212A] border border-slate-900/[0.1] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
              >
                <optgroup label="Built-In Tones">
                  {BUILTIN_TONES.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.label}
                    </option>
                  ))}
                </optgroup>
                {customAudioTones.length > 0 && (
                  <optgroup label="Uploaded Audio">
                    {customAudioTones.map((tone) => (
                      <option key={tone.id} value={tone.id}>
                        {tone.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </section>

          {/* 4. Security & Local Backup */}
          <section className="rounded-3xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-2.5">
            <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
              Security & Device Data
            </h3>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('vault');
              }}
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#1D212A] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
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
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#1D212A] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
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
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#1D212A] hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] border border-slate-900/[0.07] dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#111827] dark:text-[#F1F3F6]"
            >
              <span className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
                {exporting ? 'Preparing Backup...' : 'Export Local Backup (.json)'}
              </span>
              <span className="text-[#5B6472] dark:text-[#98A2B3]">Device only</span>
            </button>
          </section>

          {/* 5. About App */}
          <section className="rounded-3xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 space-y-2">
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
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[#F2B8A2]/20 hover:bg-[#F2B8A2]/30 border border-[#F2B8A2]/40 text-[#A6482D] dark:text-[#F2B8A2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </div>
  );
};
