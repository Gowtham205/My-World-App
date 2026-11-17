import React, { useState } from 'react';
import {
  AlarmClock,
  AudioLines,
  BarChart3,
  Cake,
  Calendar,
  CheckSquare,
  Download,
  FileText,
  Gamepad2,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  MapPin,
  MessageSquareHeart,
  Mic,
  PhoneCall,
  Quote,
  Shield,
  Wind,
} from 'lucide-react';
import type { AppRoute } from '../types/sanctuary';
import { exportLocalBackupJson } from '../lib/storage';

interface ExploreHubViewProps {
  counts: {
    notes: number;
    vault: number;
    quotes: number;
    tasks: number;
    birthdays: number;
    media: number;
    calendar: number;
    alarms: number;
    ideas: number;
    events: number;
    activeSoundscapes: number;
  };
  onNavigate: (route: AppRoute) => void;
}

interface ModuleTile {
  id: string;
  route: AppRoute;
  title: string;
  subtitle: string;
  meta: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ExploreHubView: React.FC<ExploreHubViewProps> = ({ counts, onNavigate }) => {
  const [exportStatus, setExportStatus] = useState('');

  const modules: ModuleTile[] = [
    {
      id: 'notes',
      route: 'notes',
      title: 'Personal Notes',
      subtitle: 'Everyday thoughts, clickable links, checklists, and pinned reminders.',
      meta: `${counts.notes} notes · Offline`,
      accent: 'text-[#9BC4E2]',
      icon: FileText,
    },
    {
      id: 'vault',
      route: 'vault',
      title: 'Secrets & Passwords Vault',
      subtitle: 'AES-256 encrypted logins, bank cards, PINs, and custom fields.',
      meta: `${counts.vault} encrypted · Auto-locks`,
      accent: 'text-[#BEB4DC]',
      icon: Lock,
    },
    {
      id: 'quotes',
      route: 'quotes',
      title: 'Motivational Quotes',
      subtitle: 'Save calming passages and shuffle anytime by mood or purpose.',
      meta: `${counts.quotes} quotes · Mood shuffle`,
      accent: 'text-[#BEB4DC]',
      icon: Quote,
    },
    {
      id: 'tasks',
      route: 'tasks',
      title: 'Tasks & Smart Reminders',
      subtitle: 'Priority tasks, recurring habits, and one-tap Alarm linking.',
      meta: `${counts.tasks} items · Alarm bridge`,
      accent: 'text-[#9EC5AB]',
      icon: CheckSquare,
    },
    {
      id: 'birthdays',
      route: 'birthdays',
      title: 'Birthday Tracker & Wishes',
      subtitle: 'Countdowns, custom wishes to copy, and early notification offsets.',
      meta: `${counts.birthdays} people tracked`,
      accent: 'text-[#F2B8A2]',
      icon: Cake,
    },
    {
      id: 'gallery',
      route: 'gallery',
      title: 'Private Media Gallery',
      subtitle: 'Biometric/PIN-locked folders stored privately inside your app sandbox.',
      meta: `${counts.media} private files`,
      accent: 'text-[#9BC4E2]',
      icon: ImageIcon,
    },
    {
      id: 'calendar',
      route: 'calendar',
      title: 'General Calendar',
      subtitle: 'Monthly plans, birthdays, reminders, and .ICS / Google Calendar export.',
      meta: `${counts.calendar} events · Local first`,
      accent: 'text-[#9BC4E2]',
      icon: Calendar,
    },
    {
      id: 'alarms',
      route: 'alarms',
      title: 'Dedicated Alarms',
      subtitle: 'Wake-up, medicine, and reminder-linked alarms with gentle chimes.',
      meta: `${counts.alarms} alarms`,
      accent: 'text-[#F2B8A2]',
      icon: AlarmClock,
    },
    {
      id: 'ideas',
      route: 'ideas',
      title: 'Creative Ideas Hub',
      subtitle: 'Color-coded sticky cards, moodboards, and connected idea boards.',
      meta: `${counts.ideas} cards · Visual boards`,
      accent: 'text-[#BEB4DC]',
      icon: Lightbulb,
    },
    {
      id: 'event-calm',
      route: 'event-calm',
      title: 'Event Calm Mode',
      subtitle: 'Social anxiety companion with check-ins, breathing, and Maps directions.',
      meta: `${counts.events} sessions · Grounding`,
      accent: 'text-[#9EC5AB]',
      icon: Wind,
    },
    {
      id: 'soundscapes',
      route: 'soundscapes',
      title: 'Soundscapes',
      subtitle: 'Looping rain, misty forest, ocean waves, and warm noise synthesized locally.',
      meta:
        counts.activeSoundscapes > 0
          ? `${counts.activeSoundscapes} playing · Web Audio`
          : '6 ambient layers · Offline',
      accent: 'text-[#9BC4E2]',
      icon: AudioLines,
    },
    {
      id: 'analytics',
      route: 'analytics',
      title: 'Analytics & Wellbeing',
      subtitle: 'Charts for daily tasks completed, notes written, and Event Calm Mode time.',
      meta: 'Trends · Charts',
      accent: 'text-[#9EC5AB]',
      icon: BarChart3,
    },
    {
      id: 'maps',
      route: 'maps',
      title: 'Sanctuary Maps',
      subtitle: 'Search venues, preview calm routes, and send destinations to Event Calm Mode.',
      meta: 'Places · Routes',
      accent: 'text-[#9BC4E2]',
      icon: MapPin,
    },
    {
      id: 'game',
      route: 'game',
      title: 'Stillwater Lanterns',
      subtitle: 'Soothing nocturnal pond game—collect drifting lanterns and build flow.',
      meta: 'Zen Arcade · 60fps',
      accent: 'text-[#9EC5AB]',
      icon: Gamepad2,
    },
    {
      id: 'ai-chat',
      route: 'ai-chat',
      title: 'Gemini Companion',
      subtitle: 'Multi-turn thoughtful chat with tone presets and one-tap saving to Notes.',
      meta: 'Multi-turn · Streaming',
      accent: 'text-[#BEB4DC]',
      icon: MessageSquareHeart,
    },
    {
      id: 'voice-live',
      route: 'voice-live',
      title: 'Live Voice Sanctuary',
      subtitle: 'Real-time bidirectional voice conversations with live transcripts.',
      meta: 'Live Voice · 24kHz',
      accent: 'text-[#9EC5AB]',
      icon: PhoneCall,
    },
    {
      id: 'transcribe',
      route: 'transcribe',
      title: 'Audio Transcription',
      subtitle: 'Record voice memos or upload audio files to convert speech into Notes.',
      meta: 'Speech-to-Text',
      accent: 'text-[#F2B8A2]',
      icon: Mic,
    },
  ];

  const handleExportBackup = async () => {
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
      setExportStatus('Local backup exported (Vault remains AES-256 encrypted).');
    } catch {
      setExportStatus('Could not export backup.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#9EC5AB]">Sanctuary Directory</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Explore Your World
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1">
            Everything stays strictly offline inside your device’s private storage.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportBackup}
          className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F1F3F6] flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 text-[#9EC5AB]" />
          Export Local Backup
        </button>
      </header>

      {exportStatus && (
        <p className="text-xs text-[#9EC5AB]" role="status">
          {exportStatus}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigate(mod.route)}
              className="group text-left bg-[#171A21] hover:bg-[#1D212A] border border-white/[0.07] rounded-3xl p-5 sm:p-6 transition-all active:scale-[0.99] flex flex-col justify-between min-h-[148px]"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${mod.accent}`} />
                  </div>
                  <span className="text-xs text-[#98A2B3] tabular-nums">{mod.meta}</span>
                </div>
                <h2 className="text-base font-semibold text-[#F1F3F6] group-hover:text-white">
                  {mod.title}
                </h2>
                <p className="text-xs text-[#98A2B3] mt-1.5 leading-relaxed">{mod.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[#9EC5AB]/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-[#9EC5AB]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F1F3F6]">100% Local-First Privacy</h3>
          <p className="text-xs text-[#98A2B3] mt-1 leading-relaxed">
            Zero cloud accounts, zero trackers, and zero analytics. Notes, Tasks, Birthdays,
            Calendar, Private Media blobs, and AES-256 encrypted Vault entries live exclusively in
            your local IndexedDB storage.
          </p>
        </div>
      </section>
    </div>
  );
};
