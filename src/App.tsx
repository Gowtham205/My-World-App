import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  ArrowLeft,
  AudioLines,
  BarChart3,
  Cake,
  Calendar,
  CheckSquare,
  Compass,
  FileText,
  Gamepad2,
  Home,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  MapPin,
  MessageSquareHeart,
  Mic,
  PhoneCall,
  Quote,
  Square,
  Wind,
} from 'lucide-react';
import type {
  AlarmItem,
  AppRoute,
  BirthdayEntry,
  BottomTab,
  CalendarEventItem,
  CreativeIdeaCard,
  EncryptedVaultRecord,
  EventCalmSession,
  MediaAlbum,
  MotivationalQuote,
  PersonalNote,
  PrivateMediaItem,
  TaskReminderItem,
} from './types/sanctuary';
import {
  deleteFromStore,
  getAllFromStore,
  getCalmMinutesByDate,
  putInStore,
  recordCalmMinutes,
  seedInitialSanctuaryDataIfNeeded,
} from './lib/storage';
import { getTodayStr } from './lib/dateUtils';
import { startAlarmRinging, stopAlarmRinging } from './lib/sound';
import { ActiveAlarmOverlay } from './components/ActiveAlarmOverlay';
import { EventCheckInOverlay } from './components/EventCheckInOverlay';
import { HomeView } from './views/HomeView';
import { ExploreHubView } from './views/ExploreHubView';
import { NotesView } from './views/NotesView';
import { VaultView } from './views/VaultView';
import { QuotesView } from './views/QuotesView';
import { TasksView } from './views/TasksView';
import { BirthdaysView } from './views/BirthdaysView';
import { GalleryView } from './views/GalleryView';
import { CalendarView } from './views/CalendarView';
import { AlarmsView } from './views/AlarmsView';
import { IdeasView } from './views/IdeasView';
import { EventCalmView } from './views/EventCalmView';
import { SoundscapesView } from './views/SoundscapesView';
import { AnalyticsView } from './views/AnalyticsView';
import { MapsView } from './views/MapsView';
import { GameView } from './views/GameView';
import { ChatbotView } from './views/ChatbotView';
import { VoiceLiveView } from './views/VoiceLiveView';
import { TranscribeView } from './views/TranscribeView';
import {
  SOUNDSCAPE_TRACKS,
  soundscapeEngine,
  type SoundscapeId,
} from './lib/soundscapes';

const PRIMARY_TABS: {
  id: BottomTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'alarms', label: 'Alarms', icon: AlarmClock },
  { id: 'explore', label: 'Explore', icon: Compass },
];

const SECONDARY_LINKS: {
  route: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { route: 'notes', label: 'Personal Notes', icon: FileText },
  { route: 'vault', label: 'Secrets Vault', icon: Lock },
  { route: 'quotes', label: 'Quotes', icon: Quote },
  { route: 'birthdays', label: 'Birthdays', icon: Cake },
  { route: 'gallery', label: 'Private Gallery', icon: ImageIcon },
  { route: 'ideas', label: 'Ideas Hub', icon: Lightbulb },
  { route: 'event-calm', label: 'Event Calm Mode', icon: Wind },
  { route: 'soundscapes', label: 'Soundscapes', icon: AudioLines },
  { route: 'analytics', label: 'Analytics', icon: BarChart3 },
  { route: 'maps', label: 'Sanctuary Maps', icon: MapPin },
  { route: 'game', label: 'Stillwater Lanterns', icon: Gamepad2 },
  { route: 'ai-chat', label: 'Gemini Companion', icon: MessageSquareHeart },
  { route: 'voice-live', label: 'Live Voice', icon: PhoneCall },
  { route: 'transcribe', label: 'Audio Transcribe', icon: Mic },
];

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function App() {
  const [route, setRoute] = useState<AppRoute>('home');
  const [ready, setReady] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [mapsInitialQuery, setMapsInitialQuery] = useState<string>('');

  // Local-first state hydrated from IndexedDB
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [vaultRecords, setVaultRecords] = useState<EncryptedVaultRecord[]>([]);
  const [quotes, setQuotes] = useState<MotivationalQuote[]>([]);
  const [tasks, setTasks] = useState<TaskReminderItem[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [mediaItems, setMediaItems] = useState<PrivateMediaItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [ideas, setIdeas] = useState<CreativeIdeaCard[]>([]);
  const [eventSessions, setEventSessions] = useState<EventCalmSession[]>([]);

  // In-memory cryptographic key (cleared immediately on background/visibility hidden)
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  // Active overlays (Alarms & Event Calm Check-In)
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [breathingPromptState, setBreathingPromptState] = useState<{
    session: EventCalmSession;
    prompt: string;
    startedAtMs: number;
  } | null>(null);
  const [calmMinutesByDate, setCalmMinutesByDate] = useState<Record<string, number>>(() =>
    getCalmMinutesByDate()
  );

  // Persistent Soundscapes state (lives at App level so audio continues across views)
  const [activeSoundscapes, setActiveSoundscapes] = useState<Record<SoundscapeId, boolean>>({
    rain: false,
    forest: false,
    ocean: false,
    'white-noise': false,
    'brown-noise': false,
    hearth: false,
  });
  const [soundscapeVolumes, setSoundscapeVolumes] = useState<Record<SoundscapeId, number>>({
    rain: 0.65,
    forest: 0.5,
    ocean: 0.65,
    'white-noise': 0.45,
    'brown-noise': 0.6,
    hearth: 0.6,
  });
  const [masterSoundVolume, setMasterSoundVolume] = useState(0.75);
  const [soundTimerRemainingSec, setSoundTimerRemainingSec] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    await seedInitialSanctuaryDataIfNeeded();
    const [n, v, q, t, b, al, m, c, arm, id, ev] = await Promise.all([
      getAllFromStore<PersonalNote>('notes'),
      getAllFromStore<EncryptedVaultRecord>('vault'),
      getAllFromStore<MotivationalQuote>('quotes'),
      getAllFromStore<TaskReminderItem>('tasks'),
      getAllFromStore<BirthdayEntry>('birthdays'),
      getAllFromStore<MediaAlbum>('albums'),
      getAllFromStore<PrivateMediaItem>('media'),
      getAllFromStore<CalendarEventItem>('calendar'),
      getAllFromStore<AlarmItem>('alarms'),
      getAllFromStore<CreativeIdeaCard>('ideas'),
      getAllFromStore<EventCalmSession>('events'),
    ]);
    setNotes(n);
    setVaultRecords(v);
    setQuotes(q);
    setTasks(t);
    setBirthdays(b);
    setAlbums(al);
    setMediaItems(m);
    setCalendarEvents(c);
    setAlarms(arm);
    setIdeas(id);
    setEventSessions(ev);
    setReady(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Listen for Google Maps Platform Case A quota exhaustion events globally
  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Immediate AppState / visibilitychange auto-lock for Vault & Private Gallery
  useEffect(() => {
    const lockSensitiveAreas = () => {
      if (document.visibilityState === 'hidden') {
        setVaultKey(null);
      }
    };
    const handlePageHide = () => setVaultKey(null);

    document.addEventListener('visibilitychange', lockSensitiveAreas);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', lockSensitiveAreas);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Soundscapes sleep/focus timer countdown
  useEffect(() => {
    if (soundTimerRemainingSec === null) return;
    if (soundTimerRemainingSec <= 0) {
      soundscapeEngine.stopAll();
      setActiveSoundscapes({
        rain: false,
        forest: false,
        ocean: false,
        'white-noise': false,
        'brown-noise': false,
        hearth: false,
      });
      setSoundTimerRemainingSec(null);
      return;
    }
    const id = window.setInterval(() => {
      setSoundTimerRemainingSec((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [soundTimerRemainingSec]);

  // Active Event Calm session right now (matching date & time window)
  const activeEventSession = useMemo(() => {
    const now = new Date();
    const today = getTodayStr();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    return (
      eventSessions.find((s) => {
        if (!s.active || s.date !== today) return false;
        const startM = parseMinutes(s.startTime);
        const endM = parseMinutes(s.endTime);
        return nowMin >= startM && nowMin <= endM;
      }) || null
    );
  }, [eventSessions]);

  // Real-time background scheduler for Alarms & Event Calm Mode interval check-ins
  useEffect(() => {
    if (!ready) return;

    const tick = async () => {
      const now = new Date();
      const today = getTodayStr();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHHMM = `${hh}:${mm}`;
      const minuteKey = `${today}T${currentHHMM}`;
      const weekday = now.getDay();

      // 1. Check Alarms
      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        if (alarm.time !== currentHHMM) continue;
        if (alarm.lastTriggeredMinute === minuteKey) continue;
        if (alarm.repeatDays.length > 0 && !alarm.repeatDays.includes(weekday)) continue;

        const updatedAlarm: AlarmItem = {
          ...alarm,
          lastTriggeredMinute: minuteKey,
          enabled: alarm.repeatDays.length === 0 ? false : alarm.enabled,
        };
        setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? updatedAlarm : a)));
        await putInStore('alarms', updatedAlarm);

        setRingingAlarm(updatedAlarm);
        startAlarmRinging();

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(alarm.linkedReminderTitle || alarm.label, {
            body: alarm.linkedReminderNotes || `Alarm for ${currentHHMM}`,
          });
        }
        break;
      }

      // 2. Check Active Event Calm Mode Check-In Intervals
      if (activeEventSession && activeEventSession.lastCheckInMinute !== minuteKey) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const startMin = parseMinutes(activeEventSession.startTime);
        const endMin = parseMinutes(activeEventSession.endTime);
        const elapsed = nowMin - startMin;

        let shouldTrigger = false;
        if (activeEventSession.isMidpointOnly) {
          const midpoint = Math.round((startMin + endMin) / 2);
          shouldTrigger = nowMin === midpoint;
        } else if (activeEventSession.intervalMinutes > 0 && elapsed > 0) {
          shouldTrigger = elapsed % activeEventSession.intervalMinutes === 0;
        }

        if (shouldTrigger) {
          const pool = [
            ...activeEventSession.selectedPrompts,
            ...activeEventSession.customPrompts,
          ];
          const prompt =
            pool[Math.floor(Math.random() * pool.length)] ||
            "It's okay. Take 3 slow breaths and return to the present moment.";

          const updatedSession: EventCalmSession = {
            ...activeEventSession,
            lastCheckInMinute: minuteKey,
          };
          setEventSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
          );
          await putInStore('events', updatedSession);

          setBreathingPromptState({
            session: updatedSession,
            prompt,
            startedAtMs: Date.now(),
          });
        }
      }
    };

    const interval = window.setInterval(tick, 4000);
    return () => window.clearInterval(interval);
  }, [ready, alarms, activeEventSession]);

  // Persistence Handlers
  const saveNote = async (note: PersonalNote) => {
    await putInStore('notes', note);
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === note.id);
      return exists ? prev.map((n) => (n.id === note.id ? note : n)) : [note, ...prev];
    });
  };

  const deleteNote = async (id: string) => {
    await deleteFromStore('notes', id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const saveVaultRecord = async (rec: EncryptedVaultRecord) => {
    await putInStore('vault', rec);
    setVaultRecords((prev) => {
      const exists = prev.some((v) => v.id === rec.id);
      return exists ? prev.map((v) => (v.id === rec.id ? rec : v)) : [rec, ...prev];
    });
  };

  const deleteVaultRecord = async (id: string) => {
    await deleteFromStore('vault', id);
    setVaultRecords((prev) => prev.filter((v) => v.id !== id));
  };

  const saveQuote = async (quote: MotivationalQuote) => {
    await putInStore('quotes', quote);
    setQuotes((prev) => {
      const exists = prev.some((q) => q.id === quote.id);
      return exists ? prev.map((q) => (q.id === quote.id ? quote : q)) : [quote, ...prev];
    });
  };

  const deleteQuote = async (id: string) => {
    await deleteFromStore('quotes', id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  const saveTask = async (task: TaskReminderItem) => {
    await putInStore('tasks', task);
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      return exists ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev];
    });
  };

  const deleteTask = async (id: string) => {
    await deleteFromStore('tasks', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const saveBirthday = async (entry: BirthdayEntry) => {
    await putInStore('birthdays', entry);
    setBirthdays((prev) => {
      const exists = prev.some((b) => b.id === entry.id);
      return exists ? prev.map((b) => (b.id === entry.id ? entry : b)) : [entry, ...prev];
    });
  };

  const deleteBirthday = async (id: string) => {
    await deleteFromStore('birthdays', id);
    setBirthdays((prev) => prev.filter((b) => b.id !== id));
  };

  const saveAlbum = async (album: MediaAlbum) => {
    await putInStore('albums', album);
    setAlbums((prev) => {
      const exists = prev.some((a) => a.id === album.id);
      return exists ? prev.map((a) => (a.id === album.id ? album : a)) : [...prev, album];
    });
  };

  const saveMedia = async (item: PrivateMediaItem) => {
    await putInStore('media', item);
    setMediaItems((prev) => [item, ...prev]);
  };

  const deleteMedia = async (id: string) => {
    await deleteFromStore('media', id);
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
  };

  const saveCalendarEvent = async (ev: CalendarEventItem) => {
    await putInStore('calendar', ev);
    setCalendarEvents((prev) => {
      const exists = prev.some((e) => e.id === ev.id);
      return exists ? prev.map((e) => (e.id === ev.id ? ev : e)) : [...prev, ev];
    });
  };

  const deleteCalendarEvent = async (id: string) => {
    await deleteFromStore('calendar', id);
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const saveAlarm = async (alarm: AlarmItem) => {
    await putInStore('alarms', alarm);
    setAlarms((prev) => {
      const exists = prev.some((a) => a.id === alarm.id);
      return exists ? prev.map((a) => (a.id === alarm.id ? alarm : a)) : [...prev, alarm];
    });
  };

  const deleteAlarm = async (id: string) => {
    await deleteFromStore('alarms', id);
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const saveIdea = async (idea: CreativeIdeaCard) => {
    await putInStore('ideas', idea);
    setIdeas((prev) => {
      const exists = prev.some((i) => i.id === idea.id);
      return exists ? prev.map((i) => (i.id === idea.id ? idea : i)) : [idea, ...prev];
    });
  };

  const deleteIdea = async (id: string) => {
    await deleteFromStore('ideas', id);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  };

  const saveEventSession = async (session: EventCalmSession) => {
    await putInStore('events', session);
    setEventSessions((prev) => {
      const exists = prev.some((s) => s.id === session.id);
      return exists ? prev.map((s) => (s.id === session.id ? session : s)) : [session, ...prev];
    });
  };

  const deleteEventSession = async (id: string) => {
    await deleteFromStore('events', id);
    setEventSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleShuffleHomeQuote = async () => {
    if (quotes.length <= 1) return;
    const currentPinned = quotes.find((q) => q.pinnedToHome);
    const candidates = quotes.filter((q) => q.id !== currentPinned?.id);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (!next) return;
    if (currentPinned) {
      await saveQuote({ ...currentPinned, pinnedToHome: false });
    }
    await saveQuote({ ...next, pinnedToHome: true });
  };

  const handleOpenBreathing = (session: EventCalmSession) => {
    const pool = [...session.selectedPrompts, ...session.customPrompts];
    const prompt =
      pool[Math.floor(Math.random() * pool.length)] ||
      "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.";
    setBreathingPromptState({ session, prompt, startedAtMs: Date.now() });
  };

  const handleSnoozeAlarm = async (minutes: number) => {
    if (!ringingAlarm) return;
    stopAlarmRinging();
    const target = new Date(Date.now() + minutes * 60 * 1000);
    const snoozeTime = `${String(target.getHours()).padStart(2, '0')}:${String(
      target.getMinutes()
    ).padStart(2, '0')}`;
    await saveAlarm({
      ...ringingAlarm,
      time: snoozeTime,
      enabled: true,
      lastTriggeredMinute: undefined,
    });
    setRingingAlarm(null);
  };

  const handleDismissAlarm = () => {
    stopAlarmRinging();
    setRingingAlarm(null);
  };

  const handleToggleSoundscape = (id: SoundscapeId) => {
    const currentlyActive = activeSoundscapes[id];
    if (currentlyActive) {
      soundscapeEngine.stopTrack(id);
      setActiveSoundscapes((prev) => ({ ...prev, [id]: false }));
    } else {
      soundscapeEngine.setMasterVolume(masterSoundVolume);
      soundscapeEngine.startTrack(id, soundscapeVolumes[id] ?? 0.6);
      setActiveSoundscapes((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handleChangeSoundscapeVolume = (id: SoundscapeId, vol: number) => {
    setSoundscapeVolumes((prev) => ({ ...prev, [id]: vol }));
    if (activeSoundscapes[id]) {
      soundscapeEngine.setTrackVolume(id, vol);
    }
  };

  const handleChangeMasterSoundVolume = (vol: number) => {
    setMasterSoundVolume(vol);
    soundscapeEngine.setMasterVolume(vol);
  };

  const handleStopAllSoundscapes = () => {
    soundscapeEngine.stopAll();
    setActiveSoundscapes({
      rain: false,
      forest: false,
      ocean: false,
      'white-noise': false,
      'brown-noise': false,
      hearth: false,
    });
    setSoundTimerRemainingSec(null);
  };

  const handleApplySoundPreset = (mix: Partial<Record<SoundscapeId, number>>) => {
    soundscapeEngine.stopAll();
    const nextActive: Record<SoundscapeId, boolean> = {
      rain: false,
      forest: false,
      ocean: false,
      'white-noise': false,
      'brown-noise': false,
      hearth: false,
    };
    const nextVolumes = { ...soundscapeVolumes };
    soundscapeEngine.setMasterVolume(masterSoundVolume);

    (Object.keys(mix) as SoundscapeId[]).forEach((id) => {
      const vol = mix[id];
      if (typeof vol === 'number') {
        nextActive[id] = true;
        nextVolumes[id] = vol;
        soundscapeEngine.startTrack(id, vol);
      }
    });
    setActiveSoundscapes(nextActive);
    setSoundscapeVolumes(nextVolumes);
  };

  const activeSoundscapeIds = (Object.keys(activeSoundscapes) as SoundscapeId[]).filter(
    (id) => activeSoundscapes[id]
  );

  const isSecondaryRoute =
    route !== 'home' &&
    route !== 'tasks' &&
    route !== 'calendar' &&
    route !== 'alarms' &&
    route !== 'explore';

  const activeBottomTab: BottomTab = isSecondaryRoute ? 'explore' : route;

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center p-6">
        <p className="font-display text-lg text-[#98A2B3]">Opening My World...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#F1F3F6] flex flex-col">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* Desktop Left Sanctuary Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-white/[0.06] bg-[#13161C] p-6 sticky top-0 h-screen justify-between">
        <div className="space-y-8 overflow-y-auto pr-1">
          <div>
            <button
              type="button"
              onClick={() => setRoute('home')}
              className="text-left focus-visible:outline-2 focus-visible:outline-[#9EC5AB]"
            >
              <span className="font-display text-2xl font-medium text-[#F1F3F6] tracking-tight block">
                My World
              </span>
              <span className="text-xs text-[#98A2B3]">Local Personal Sanctuary</span>
            </button>
          </div>

          <nav className="space-y-1" aria-label="Primary sections">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = route === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoute(tab.id)}
                  className={`w-full min-h-[44px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#9EC5AB]/15 text-[#9EC5AB]'
                      : 'text-[#98A2B3] hover:text-[#F1F3F6] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-[#98A2B3] px-3.5 mb-2">Modules</p>
            <nav className="space-y-1" aria-label="All modules">
              {SECONDARY_LINKS.map((item) => {
                const Icon = item.icon;
                const active = route === item.route;
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => setRoute(item.route)}
                    className={`w-full min-h-[42px] px-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white/[0.08] text-[#F1F3F6]'
                        : 'text-[#98A2B3] hover:text-[#F1F3F6] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06] space-y-3">
          {activeSoundscapeIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#171A21] border border-white/[0.07] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setRoute('soundscapes')}
                  className="text-xs font-medium text-[#9BC4E2] truncate hover:underline text-left"
                >
                  {activeSoundscapeIds
                    .map((id) => SOUNDSCAPE_TRACKS.find((t) => t.id === id)?.title)
                    .filter(Boolean)
                    .join(' + ')}
                </button>
                <button
                  type="button"
                  onClick={handleStopAllSoundscapes}
                  aria-label="Stop soundscapes"
                  className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[#F2B8A2] flex items-center justify-center shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-[#98A2B3]">Offline storage · Zero tracking</p>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {/* Mobile Back Navigation when inside a sub-module */}
          {isSecondaryRoute && (
            <div className="mb-4 lg:hidden">
              <button
                type="button"
                onClick={() => setRoute('explore')}
                className="min-h-[44px] px-3 -ml-2 rounded-2xl inline-flex items-center gap-2 text-xs font-medium text-[#98A2B3] hover:text-[#F1F3F6]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Explore Hub
              </button>
            </div>
          )}

          {/* Mobile Inline Active Soundscapes Bar */}
          {activeSoundscapeIds.length > 0 && route !== 'soundscapes' && (
            <div className="mb-4 lg:hidden rounded-2xl bg-[#171A21] border border-white/[0.08] px-4 py-2.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setRoute('soundscapes')}
                className="flex items-center gap-2 text-xs font-medium text-[#9BC4E2] min-w-0 truncate"
              >
                <AudioLines className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {activeSoundscapeIds
                    .map((id) => SOUNDSCAPE_TRACKS.find((t) => t.id === id)?.title)
                    .filter(Boolean)
                    .join(' + ')}
                </span>
              </button>
              <button
                type="button"
                onClick={handleStopAllSoundscapes}
                aria-label="Stop soundscapes"
                className="min-w-[36px] min-h-[36px] rounded-xl bg-white/[0.05] text-[#F2B8A2] flex items-center justify-center shrink-0"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {route === 'home' && (
            <HomeView
              quotes={quotes}
              tasks={tasks}
              birthdays={birthdays}
              eventSessions={eventSessions}
              activeEventSession={activeEventSession}
              onNavigate={setRoute}
              onShuffleQuote={handleShuffleHomeQuote}
              onToggleTask={async (id) => {
                const target = tasks.find((t) => t.id === id);
                if (target) {
                  await saveTask({
                    ...target,
                    completed: !target.completed,
                    completedAt: !target.completed ? new Date().toISOString() : undefined,
                  });
                }
              }}
              onOpenBreathing={handleOpenBreathing}
            />
          )}

          {route === 'explore' && (
            <ExploreHubView
              counts={{
                notes: notes.length,
                vault: vaultRecords.length,
                quotes: quotes.length,
                tasks: tasks.filter((t) => !t.completed).length,
                birthdays: birthdays.length,
                media: mediaItems.length,
                calendar: calendarEvents.length,
                alarms: alarms.length,
                ideas: ideas.length,
                events: eventSessions.length,
                activeSoundscapes: activeSoundscapeIds.length,
              }}
              onNavigate={setRoute}
            />
          )}

          {route === 'notes' && (
            <NotesView notes={notes} onSaveNote={saveNote} onDeleteNote={deleteNote} />
          )}

          {route === 'vault' && (
            <VaultView
              vaultKey={vaultKey}
              encryptedRecords={vaultRecords}
              onUnlock={(key) => setVaultKey(key)}
              onLock={() => setVaultKey(null)}
              onSaveEncrypted={saveVaultRecord}
              onDeleteEncrypted={deleteVaultRecord}
            />
          )}

          {route === 'quotes' && (
            <QuotesView quotes={quotes} onSaveQuote={saveQuote} onDeleteQuote={deleteQuote} />
          )}

          {route === 'tasks' && (
            <TasksView
              tasks={tasks}
              onSaveTask={saveTask}
              onDeleteTask={deleteTask}
              onCreateLinkedAlarm={saveAlarm}
            />
          )}

          {route === 'birthdays' && (
            <BirthdaysView
              birthdays={birthdays}
              onSaveBirthday={saveBirthday}
              onDeleteBirthday={deleteBirthday}
            />
          )}

          {route === 'gallery' && (
            <GalleryView
              unlocked={Boolean(vaultKey)}
              albums={albums}
              mediaItems={mediaItems}
              onUnlock={(key) => setVaultKey(key)}
              onLock={() => setVaultKey(null)}
              onSaveAlbum={saveAlbum}
              onSaveMedia={saveMedia}
              onDeleteMedia={deleteMedia}
            />
          )}

          {route === 'calendar' && (
            <CalendarView
              events={calendarEvents}
              tasks={tasks}
              birthdays={birthdays}
              onSaveEvent={saveCalendarEvent}
              onDeleteEvent={deleteCalendarEvent}
            />
          )}

          {route === 'alarms' && (
            <AlarmsView
              alarms={alarms}
              onSaveAlarm={saveAlarm}
              onDeleteAlarm={deleteAlarm}
              onTestRingAlarm={(alarm) => {
                setRingingAlarm(alarm);
                startAlarmRinging();
              }}
            />
          )}

          {route === 'ideas' && (
            <IdeasView ideas={ideas} onSaveIdea={saveIdea} onDeleteIdea={deleteIdea} />
          )}

          {route === 'event-calm' && (
            <EventCalmView
              sessions={eventSessions}
              onSaveSession={saveEventSession}
              onDeleteSession={deleteEventSession}
              onOpenBreathing={handleOpenBreathing}
              onOpenOnMap={(venue) => {
                setMapsInitialQuery(venue);
                setRoute('maps');
              }}
            />
          )}

          {route === 'soundscapes' && (
            <SoundscapesView
              activeTracks={activeSoundscapes}
              trackVolumes={soundscapeVolumes}
              masterVolume={masterSoundVolume}
              timerRemainingSec={soundTimerRemainingSec}
              onToggleTrack={handleToggleSoundscape}
              onChangeTrackVolume={handleChangeSoundscapeVolume}
              onChangeMasterVolume={handleChangeMasterSoundVolume}
              onApplyPreset={handleApplySoundPreset}
              onStopAll={handleStopAllSoundscapes}
              onSetTimerMinutes={(mins) =>
                setSoundTimerRemainingSec(mins === null ? null : mins * 60)
              }
            />
          )}

          {route === 'analytics' && (
            <AnalyticsView
              tasks={tasks}
              notes={notes}
              eventSessions={eventSessions}
              calmMinutesByDate={calmMinutesByDate}
              quotes={quotes}
              ideas={ideas}
            />
          )}

          {route === 'maps' && (
            <MapsView
              initialDestinationQuery={mapsInitialQuery}
              onSaveEventSession={saveEventSession}
              onSaveCalendarEvent={saveCalendarEvent}
              onNavigateToEventCalm={() => setRoute('event-calm')}
              onNavigateToCalendar={() => setRoute('calendar')}
            />
          )}

          {route === 'game' && <GameView />}

          {route === 'ai-chat' && <ChatbotView onSaveToNote={saveNote} />}

          {route === 'voice-live' && <VoiceLiveView onSaveToNote={saveNote} />}

          {route === 'transcribe' && <TranscribeView onSaveToNote={saveNote} />}
        </div>
      </main>
      </div>

      {/* Mobile Fixed 5-Tab Bottom Navigation Bar (<= 15% sticky height cap) */}
      <nav
        aria-label="Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#13161C]/90 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-5 items-center px-1"
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeBottomTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoute(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-[#9EC5AB]' : 'text-[#98A2B3] hover:text-[#F1F3F6]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium tracking-tight leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Active Ringing Alarm Modal */}
      {ringingAlarm && (
        <ActiveAlarmOverlay
          alarm={ringingAlarm}
          onDismiss={handleDismissAlarm}
          onSnooze={handleSnoozeAlarm}
        />
      )}

      {/* Event Calm Mode Breathing & Grounding Modal */}
      {breathingPromptState && (
        <EventCheckInOverlay
          session={breathingPromptState.session}
          promptMessage={breathingPromptState.prompt}
          onClose={() => {
            const elapsedMinutes = Math.max(
              1,
              Math.round((Date.now() - breathingPromptState.startedAtMs) / 60000)
            );
            const updated = recordCalmMinutes(getTodayStr(), elapsedMinutes);
            setCalmMinutesByDate(updated);
            setBreathingPromptState(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
