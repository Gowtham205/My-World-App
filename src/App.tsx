import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  AlarmClock,
  ArrowLeft,
  AudioLines,
  BarChart3,
  Bell,
  Cake,
  Calendar,
  CheckSquare,
  ChevronRight,
  Compass,
  FileText,
  Gamepad2,
  HeartPulse,
  Home,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  MapPin,
  MessageSquareHeart,
  Mic,
  PhoneCall,
  Quote,
  Settings,
  Square,
  Wind,
} from 'lucide-react';
import { onAuthStateChanged, updateProfile, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  AlarmItem,
  AppNotificationItem,
  AppRoute,
  AppTheme,
  BirthdayEntry,
  BottomTab,
  CalendarEventItem,
  CreativeIdeaCard,
  CustomAudioTone,
  EncryptedVaultRecord,
  EventCalmSession,
  HealthProfile,
  MediaAlbum,
  MotivationalQuote,
  PersonalNote,
  PrivateMediaItem,
  SecuritySettings,
  TaskReminderItem,
  VaultSecretPayload,
} from './types/sanctuary';
import {
  addDismissedNotificationKeys,
  createId,
  deleteFromStore,
  getAllFromStore,
  getCalmMinutesByDate,
  getDailyQuoteSelection,
  getDailyStepsByDate,
  getDefaultNotificationSoundId,
  getHealthProfile,
  getLocalPreferredName,
  getNotificationHistory,
  getSavedTheme,
  getSetting,
  hasHealthMilestoneSent,
  markHealthMilestoneSent,
  putInStore,
  recordCalmMinutes,
  saveDailyQuoteSelection,
  saveDailyStepsForDate,
  saveHealthProfileLocal,
  saveLocalPreferredName,
  saveNotificationHistory,
  saveTheme,
  seedInitialSanctuaryDataIfNeeded,
  setDefaultNotificationSoundId as persistDefaultNotificationSoundId,
} from './lib/storage';
import {
  clearStoredBiometricData,
  syncBiometricAfterPinChange,
} from './lib/biometrics';
import {
  decryptPayload,
  deriveVaultKey,
  encryptPayload,
  generateSalt,
  hashPin,
} from './lib/crypto';
import { formatTime12h, getDaysUntilBirthday, getTodayStr } from './lib/dateUtils';
import { doesTaskMatchDate, getNextMatchingDateFromToday } from './lib/taskRecurrence';
import {
  attachNotificationListeners,
  collectMissedAndTodayInboxItems,
  ensureNotificationSetup,
  formatEventCalmPrompts,
  hasBirthdayDrawerSent,
  hashToNotificationId,
  markBirthdayDrawerSent,
  removeNotificationBySlotSeed,
  resetScheduleSyncFingerprint,
  sendSystemNotification,
  syncScheduledNativeNotifications,
} from './lib/notifications';
import {
  attachNativeAudioListeners,
  drainNativePendingEvents,
  startNativeRingtone,
  stopNativeRingtone,
  syncCustomToneFileToNative,
  tryClaimNativeSlot,
  type NativeAlertEvent,
} from './lib/nativeAudio';
import {
  attachNativeStepsListener,
  getNativeStepStatus,
  requestNativeStepTracking,
} from './lib/nativeSteps';
import { getReachedStepMilestones, isWeightRecheckDue } from './lib/healthMonitor';
import { deletePrivateMediaFile } from './lib/privateMediaStorage';
import {
  ALARM_MAX_RING_MS,
  MAX_AUTO_SNOOZES,
  playNotificationSound,
  resolveSoundName,
  startAlarmRinging,
  stopAlarmRinging,
  stopSoundPreview,
} from './lib/sound';
import { ActiveAlarmOverlay } from './components/ActiveAlarmOverlay';
import { AuthGate } from './components/AuthGate';
import { EventCheckInOverlay } from './components/EventCheckInOverlay';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { ProfileSettingsDrawer } from './components/ProfileSettingsDrawer';
import {
  auth,
  db,
  handleFirestoreError,
  loadHealthProfileFromFirestore,
  OperationType,
  reloadCurrentUser,
  resendVerificationEmail,
  saveHealthProfileToFirestore,
  signOutSanctuary,
  upsertUserProfile,
  type UserProfileRecord,
} from './lib/firebase';
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
import { HealthMonitorView } from './views/HealthMonitorView';
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
  activeBox: string;
  activeText: string;
  activeBar: string;
  idleIcon: string;
}[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    activeBox:
      'bg-[#9EC5AB]/32 dark:bg-[#9EC5AB]/24 border-[#6CA982]/55 dark:border-[#9EC5AB]/45',
    activeText: 'text-[#1D5636] dark:text-[#A7D7B8]',
    activeBar: 'bg-[#2E6B48] dark:bg-[#9EC5AB]',
    idleIcon: 'text-[#4B6B58] dark:text-[#86A794]',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    activeBox:
      'bg-[#BEB4DC]/38 dark:bg-[#BEB4DC]/24 border-[#8E7EC4]/55 dark:border-[#BEB4DC]/45',
    activeText: 'text-[#47387A] dark:text-[#CEC3F0]',
    activeBar: 'bg-[#5B4D8A] dark:bg-[#BEB4DC]',
    idleIcon: 'text-[#665C84] dark:text-[#9D95B8]',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    activeBox:
      'bg-[#9BC4E2]/38 dark:bg-[#9BC4E2]/24 border-[#5C9ECC]/55 dark:border-[#9BC4E2]/45',
    activeText: 'text-[#15527A] dark:text-[#A3CEF0]',
    activeBar: 'bg-[#1E5F8A] dark:bg-[#9BC4E2]',
    idleIcon: 'text-[#4E6C84] dark:text-[#88A5BD]',
  },
  {
    id: 'alarms',
    label: 'Alarms',
    icon: AlarmClock,
    activeBox:
      'bg-[#F2B8A2]/42 dark:bg-[#F2B8A2]/24 border-[#DA8668]/55 dark:border-[#F2B8A2]/45',
    activeText: 'text-[#913B22] dark:text-[#F5C1AD]',
    activeBar: 'bg-[#B55437] dark:bg-[#F2B8A2]',
    idleIcon: 'text-[#845E52] dark:text-[#BA968A]',
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: Compass,
    activeBox:
      'bg-[#EAB8CE]/42 dark:bg-[#EAB8CE]/24 border-[#CE7CA2]/55 dark:border-[#EAB8CE]/45',
    activeText: 'text-[#7F3256] dark:text-[#F0C1D6]',
    activeBar: 'bg-[#99456C] dark:bg-[#EAB8CE]',
    idleIcon: 'text-[#7D5B6B] dark:text-[#B592A3]',
  },
];

const SECONDARY_LINKS: {
  route: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}[] = [
  { route: 'notes', label: 'Personal Notes', icon: FileText, iconColor: 'text-[#1E5F8A] dark:text-[#9BC4E2]' },
  { route: 'vault', label: 'Secrets Vault', icon: Lock, iconColor: 'text-[#5B4D8A] dark:text-[#BEB4DC]' },
  { route: 'quotes', label: 'Quotes', icon: Quote, iconColor: 'text-[#843B5C] dark:text-[#EAB8CE]' },
  { route: 'birthdays', label: 'Birthdays', icon: Cake, iconColor: 'text-[#A6482D] dark:text-[#F2B8A2]' },
  { route: 'gallery', label: 'Private Gallery', icon: ImageIcon, iconColor: 'text-[#1E5F8A] dark:text-[#9BC4E2]' },
  { route: 'ideas', label: 'Ideas Hub', icon: Lightbulb, iconColor: 'text-[#8A6218] dark:text-[#EDD59E]' },
  { route: 'event-calm', label: 'Event Calm Mode', icon: Wind, iconColor: 'text-[#2E6B48] dark:text-[#9EC5AB]' },
  { route: 'health', label: 'Health Monitor', icon: HeartPulse, iconColor: 'text-[#2E6B48] dark:text-[#9EC5AB]' },
  { route: 'soundscapes', label: 'Soundscapes', icon: AudioLines, iconColor: 'text-[#1E5F8A] dark:text-[#9BC4E2]' },
  { route: 'analytics', label: 'Analytics', icon: BarChart3, iconColor: 'text-[#8A6218] dark:text-[#EDD59E]' },
  { route: 'maps', label: 'Sanctuary Maps', icon: MapPin, iconColor: 'text-[#2E6B48] dark:text-[#9EC5AB]' },
  { route: 'game', label: 'Stillwater Lanterns', icon: Gamepad2, iconColor: 'text-[#5B4D8A] dark:text-[#BEB4DC]' },
  { route: 'ai-chat', label: 'Gemini Companion', icon: MessageSquareHeart, iconColor: 'text-[#843B5C] dark:text-[#EAB8CE]' },
  { route: 'voice-live', label: 'Live Voice', icon: PhoneCall, iconColor: 'text-[#2E6B48] dark:text-[#9EC5AB]' },
  { route: 'transcribe', label: 'Audio Transcribe', icon: Mic, iconColor: 'text-[#A6482D] dark:text-[#F2B8A2]' },
];

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getNextAlarmStateAfterFire(
  alarm: AlarmItem,
  allTasks: TaskReminderItem[]
): { enabled: boolean; date?: string } {
  if (alarm.repeatDays.length > 0) {
    return { enabled: alarm.enabled, date: alarm.date };
  }
  if (alarm.linkedReminderId) {
    const linked = allTasks.find((t) => t.id === alarm.linkedReminderId);
    if (
      linked &&
      !linked.completed &&
      (linked.recurrence === 'Monthly' ||
        (linked.recurrence === 'Custom' && linked.customRecurrenceUnit === 'monthly'))
    ) {
      const nextDate = getNextMatchingDateFromToday({
        startDate: linked.dueDate || getTodayStr(),
        recurrence: linked.recurrence,
        customRecurrenceUnit: linked.customRecurrenceUnit,
        customRecurrenceMonthDays: linked.customRecurrenceMonthDays,
        afterDateStr: getTodayStr(),
      });
      if (nextDate) {
        return { enabled: true, date: nextDate };
      }
    }
  }
  return { enabled: false, date: alarm.date };
}

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [route, setRoute] = useState<AppRoute>('home');
  const [ready, setReady] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [mapsInitialQuery, setMapsInitialQuery] = useState<string>('');
  const [theme, setTheme] = useState<AppTheme>(() => getSavedTheme());
  const [localPreferredName, setLocalPreferredName] = useState<string>(() =>
    getLocalPreferredName()
  );
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [notificationsDrawerOpen, setNotificationsDrawerOpen] = useState(false);
  const [inboxNotifications, setInboxNotifications] = useState<AppNotificationItem[]>(() =>
    getNotificationHistory()
  );

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
  const [customAudioTones, setCustomAudioTones] = useState<CustomAudioTone[]>([]);
  const [defaultNotificationSoundId, setDefaultNotificationSoundId] = useState<string>(() =>
    getDefaultNotificationSoundId()
  );
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [dailyStepsByDate, setDailyStepsByDate] = useState<Record<string, number>>(() =>
    getDailyStepsByDate()
  );
  const [nativeStepStatus, setNativeStepStatus] = useState<{
    sensorAvailable: boolean;
    permissionGranted: boolean;
  }>({ sensorAvailable: false, permissionGranted: false });

  // In-memory cryptographic key (cleared immediately on background/visibility hidden)
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  // Navigation history stack & per-route scroll memory
  const historyRef = useRef<AppRoute[]>([]);
  const routeRef = useRef<AppRoute>(route);
  routeRef.current = route;
  const scrollPositionsRef = useRef<Partial<Record<AppRoute, number>>>({});
  const pendingScrollYRef = useRef<number | null>(null);

  // Active overlays (Alarms, Reminder Notification Toast, & Event Calm Check-In)
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [ringingStartedAtMs, setRingingStartedAtMs] = useState<number>(Date.now());
  const [activeReminderNotice, setActiveReminderNotice] = useState<TaskReminderItem | null>(null);
  const [breathingPromptState, setBreathingPromptState] = useState<{
    session: EventCalmSession;
    prompt: string;
    startedAtMs: number;
    muteInitialChime?: boolean;
    isRingingAlarm?: boolean;
    autoSnoozeCount?: number;
    snoozeMinutes?: number;
    slotSeed?: string;
  } | null>(null);
  const snoozedCalmAlertsRef = useRef<
    Array<{
      id: string;
      session: EventCalmSession;
      targetDate: string;
      targetTime: string;
      prompt: string;
      fullChecklist: string;
      autoSnoozeCount: number;
      snoozeMinutes: number;
    }>
  >([]);
  const [calmMinutesByDate, setCalmMinutesByDate] = useState<Record<string, number>>(() =>
    getCalmMinutesByDate()
  );
  const [nativeEventsReady, setNativeEventsReady] = useState<boolean>(
    () => !Capacitor.isNativePlatform()
  );

  const ringingAlarmRef = useRef(ringingAlarm);
  ringingAlarmRef.current = ringingAlarm;
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const eventSessionsRef = useRef(eventSessions);
  eventSessionsRef.current = eventSessions;
  const customAudioTonesRef = useRef(customAudioTones);
  customAudioTonesRef.current = customAudioTones;
  const defaultNotificationSoundIdRef = useRef(defaultNotificationSoundId);
  defaultNotificationSoundIdRef.current = defaultNotificationSoundId;
  const healthProfileRef = useRef(healthProfile);
  healthProfileRef.current = healthProfile;
  const activeReminderNoticeRef = useRef(activeReminderNotice);
  activeReminderNoticeRef.current = activeReminderNotice;
  const breathingPromptStateRef = useRef(breathingPromptState);
  breathingPromptStateRef.current = breathingPromptState;
  const profileDrawerOpenRef = useRef(profileDrawerOpen);
  profileDrawerOpenRef.current = profileDrawerOpen;
  const notificationsDrawerOpenRef = useRef(notificationsDrawerOpen);
  notificationsDrawerOpenRef.current = notificationsDrawerOpen;

  // Sync Dark / Light theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  const pushInboxNotification = useCallback(
    (incoming: Omit<AppNotificationItem, 'id'> | AppNotificationItem) => {
      setInboxNotifications((prev) => {
        if (prev.some((n) => n.dedupeKey === incoming.dedupeKey)) {
          return prev;
        }
        const entry: AppNotificationItem =
          'id' in incoming ? incoming : { ...incoming, id: createId('notif') };
        const next = [entry, ...prev].slice(0, 80);
        saveNotificationHistory(next);
        return next;
      });
    },
    []
  );

  const navigateTo = useCallback(
    (nextRoute: AppRoute, options?: { pushHistory?: boolean; restoreScroll?: boolean }) => {
      const prevRoute = routeRef.current;

      // Immediately lock Vault & Private Gallery whenever leaving them
      if ((prevRoute === 'vault' || prevRoute === 'gallery') && nextRoute !== prevRoute) {
        setVaultKey(null);
      }

      if (prevRoute === nextRoute) return;

      // Persist scroll position of the screen we are leaving
      scrollPositionsRef.current[prevRoute] = window.scrollY || window.pageYOffset || 0;

      const isBackNav = options?.restoreScroll ?? options?.pushHistory === false;
      pendingScrollYRef.current = isBackNav
        ? scrollPositionsRef.current[nextRoute] ?? 0
        : 0;

      if (options?.pushHistory !== false) {
        const stack = historyRef.current;
        if (stack[stack.length - 1] !== prevRoute) {
          stack.push(prevRoute);
          if (stack.length > 30) stack.shift();
        }
        try {
          window.history.pushState({ route: nextRoute }, '');
        } catch {
          // ignore history errors inside sandboxed environments
        }
      }

      routeRef.current = nextRoute;
      setRoute(nextRoute);
    },
    []
  );

  // Restore saved scroll position (on Back) or reset to top (on forward navigation) after route renders
  useEffect(() => {
    const targetY = pendingScrollYRef.current;
    if (targetY === null) return;
    pendingScrollYRef.current = null;

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [route]);

  // Enforce relock whenever current route is neither vault nor gallery
  useEffect(() => {
    if (route !== 'vault' && route !== 'gallery') {
      setVaultKey(null);
    }
  }, [route]);

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
    const [n, v, q, t, b, al, m, c, arm, id, ev, tones, hp] = await Promise.all([
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
      getAllFromStore<CustomAudioTone>('custom_audio'),
      getHealthProfile(),
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
    setCustomAudioTones(tones);
    setHealthProfile(hp);
    setReady(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsEmailVerified(Boolean(user?.emailVerified));
      if (!user) {
        setUserProfile(null);
        setEmailVerificationSent(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync & subscribe to user profile only when authenticated AND email-verified
  // (required by hardened Firestore security rules)
  useEffect(() => {
    if (!authReady || !authUser || !isEmailVerified) return;

    void upsertUserProfile(authUser).catch((err) => {
      console.error('Profile sync error:', err);
    });

    const profilePath = `users/${authUser.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfileRecord);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );

    return () => unsubscribe();
  }, [authReady, authUser, isEmailVerified]);

  // Step milestones helper (1,000 steps first, then every 5,000 steps)
  const checkAndDispatchStepMilestones = useCallback(
    (steps: number) => {
      const today = getTodayStr();
      const reached = getReachedStepMilestones(steps);
      if (reached.length === 0) return;

      const newlyReached: number[] = [];
      for (const milestone of reached) {
        const key = `steps:${today}:${milestone}`;
        if (!hasHealthMilestoneSent(key)) {
          markHealthMilestoneSent(key);
          newlyReached.push(milestone);
        }
      }
      if (newlyReached.length === 0) return;

      const highest = newlyReached[newlyReached.length - 1];
      const dedupeKey = `health:steps:${today}:${highest}`;
      const title = `${highest.toLocaleString()} Steps Reached Today`;
      const body =
        highest === 1000
          ? 'Great first 1,000 steps! Your daily movement rhythm is underway. Next milestone: 5,000 steps.'
          : `Awesome stride — you crossed ${highest.toLocaleString()} steps today! Next milestone: ${(highest + 5000).toLocaleString()} steps.`;

      pushInboxNotification({
        dedupeKey,
        kind: 'health',
        status: 'delivered',
        title,
        body,
        scheduledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        route: 'health',
      });

      void sendSystemNotification({
        dedupeKey,
        slotSeed: `health:steps:${today}`,
        title,
        body,
        channel: 'health',
        route: 'health',
        entityId: String(highest),
        replaceInPlace: true,
      });
    },
    [pushInboxNotification]
  );

  // Sync Health Profile with Firestore when verified
  useEffect(() => {
    if (!ready || !authReady || !authUser || !isEmailVerified) return;
    let cancelled = false;

    void (async () => {
      try {
        const remote = await loadHealthProfileFromFirestore(authUser);
        if (cancelled) return;
        const local = healthProfileRef.current;
        if (remote && (!local || remote.updatedAt > local.updatedAt)) {
          await saveHealthProfileLocal(remote);
          setHealthProfile(remote);
        } else if (local && !remote) {
          await saveHealthProfileToFirestore(authUser, local);
        }
      } catch {
        // Offline-first fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authReady, authUser, isEmailVerified]);

  // Listen to native hardware step counter when available on Android
  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return;
    let active = true;

    const applySensorSteps = (todaySteps: number, available: boolean, permGranted?: boolean) => {
      if (!active) return;
      setNativeStepStatus((prev) => ({
        sensorAvailable: available,
        permissionGranted: permGranted ?? prev.permissionGranted,
      }));
      if (todaySteps > 0) {
        const today = getTodayStr();
        const currentStored = getDailyStepsByDate()[today] || 0;
        const merged = Math.max(currentStored, todaySteps);
        if (merged !== currentStored) {
          const updatedMap = saveDailyStepsForDate(today, merged);
          setDailyStepsByDate(updatedMap);
          checkAndDispatchStepMilestones(merged);
        }
      }
    };

    void getNativeStepStatus().then((status) => {
      applySensorSteps(status.todaySteps, status.sensorAvailable, status.permissionGranted);
    });

    const detach = attachNativeStepsListener((ev) => {
      applySensorSteps(ev.todaySteps, ev.sensorAvailable, true);
    });

    return () => {
      active = false;
      detach();
    };
  }, [ready, checkAndDispatchStepMilestones]);

  // Check if periodic weight recheck reminder (default every 30 days) is due
  useEffect(() => {
    if (!ready || !healthProfile) return;
    const today = getTodayStr();
    const recheck = isWeightRecheckDue(healthProfile, today);
    if (!recheck.due) return;

    const sentKey = `weight-recheck:${healthProfile.lastWeightLoggedAt}:${today}`;
    if (hasHealthMilestoneSent(sentKey)) return;
    markHealthMilestoneSent(sentKey);

    const dedupeKey = `health:${sentKey}`;
    const title = 'Weight & Health Check-In Due';
    const body = `It has been ${recheck.daysElapsed} days since your last logged weight (${healthProfile.weightKg} kg). Update your weight in Health Monitor to refresh your BMI & plan.`;

    pushInboxNotification({
      dedupeKey,
      kind: 'health',
      status: 'delivered',
      title,
      body,
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      read: false,
      route: 'health',
    });

    void sendSystemNotification({
      dedupeKey,
      slotSeed: 'health:weight-recheck',
      title,
      body,
      channel: 'health',
      route: 'health',
      replaceInPlace: true,
    });
  }, [ready, healthProfile, pushInboxNotification]);

  const handleSaveHealthProfile = useCallback(
    async (nextProfile: HealthProfile) => {
      await saveHealthProfileLocal(nextProfile);
      setHealthProfile(nextProfile);

      if (authUser && isEmailVerified) {
        try {
          await saveHealthProfileToFirestore(authUser, nextProfile);
        } catch {
          // Offline-first; syncs cleanly next time online
        }
      }

      if (Capacitor.isNativePlatform()) {
        const recheckId = hashToNotificationId('health:weight-recheck');
        try {
          await LocalNotifications.cancel({ notifications: [{ id: recheckId }] }).catch(() => {});
          if (nextProfile.weightReminderDays > 0) {
            const recheck = isWeightRecheckDue(nextProfile, getTodayStr());
            if (recheck.nextDueDate) {
              const [y, m, d] = recheck.nextDueDate.split('-').map(Number);
              const at = new Date(y, m - 1, d, 9, 0, 0, 0);
              if (at.getTime() > Date.now() + 60_000) {
                const granted = await ensureNotificationSetup();
                if (granted) {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: recheckId,
                        title: '30-Day Health & Weight Check-In',
                        body: `Time for your ${nextProfile.weightReminderDays}-day weight update in Personal Health Monitor.`,
                        channelId: 'my-world-reminders',
                        extra: {
                          route: 'health',
                          kind: 'health',
                          slotSeed: 'health:weight-recheck',
                        },
                        schedule: {
                          at,
                          allowWhileIdle: true,
                        },
                      },
                    ],
                  });
                }
              }
            }
          }
        } catch {
          // ignore local schedule failure
        }
      }
    },
    [authUser, isEmailVerified]
  );

  const handleUpdateTodaySteps = useCallback(
    async (steps: number) => {
      const today = getTodayStr();
      const updatedMap = saveDailyStepsForDate(today, steps);
      setDailyStepsByDate(updatedMap);
      checkAndDispatchStepMilestones(steps);
    },
    [checkAndDispatchStepMilestones]
  );

  const handleRequestNativeSteps = useCallback(async () => {
    const status = await requestNativeStepTracking();
    setNativeStepStatus({
      sensorAvailable: status.sensorAvailable,
      permissionGranted: status.permissionGranted,
    });
    if (status.todaySteps > 0) {
      const today = getTodayStr();
      const currentStored = getDailyStepsByDate()[today] || 0;
      const merged = Math.max(currentStored, status.todaySteps);
      const updatedMap = saveDailyStepsForDate(today, merged);
      setDailyStepsByDate(updatedMap);
      checkAndDispatchStepMilestones(merged);
    }
  }, [checkAndDispatchStepMilestones]);

  // Listen for Google Maps Platform Case A quota exhaustion events globally
  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const reconcileMissedNotifications = useCallback(() => {
    if (!ready) return;
    setInboxNotifications((prev) => {
      const additions = collectMissedAndTodayInboxItems({
        alarms,
        tasks,
        eventSessions,
        birthdays,
        existingHistory: prev,
      });
      if (additions.length === 0) return prev;
      const next = [...additions, ...prev].slice(0, 80);
      saveNotificationHistory(next);
      return next;
    });
  }, [ready, alarms, tasks, eventSessions, birthdays]);

  useEffect(() => {
    reconcileMissedNotifications();
  }, [reconcileMissedNotifications]);

  const handleNativeAlertEvent = useCallback(
    async (ev: NativeAlertEvent) => {
      const now = Date.now();

      if (ev.type === 'fired') {
        const minuteKey = ev.minuteKey || '';
        if (ev.kind === 'alarm') {
          const matched = alarmsRef.current.find((a) => a.id === ev.entityId);
          if (matched) {
            const nextState = getNextAlarmStateAfterFire(matched, tasksRef.current);
            const updated: AlarmItem = {
              ...matched,
              lastTriggeredMinute: minuteKey || matched.lastTriggeredMinute,
              snoozedUntilDate: undefined,
              snoozedUntilTime: undefined,
              enabled: nextState.enabled,
              date: nextState.date,
            };
            await putInStore('alarms', updated);
            setAlarms((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

            if (now - (ev.timestampMs || now) < 55_000) {
              setRingingAlarm(updated);
              setRingingStartedAtMs(ev.timestampMs || now);
            }
          }
          if (minuteKey) {
            pushInboxNotification({
              dedupeKey: `alarm:${ev.entityId}:${minuteKey}`,
              kind: 'alarm',
              status: 'delivered',
              title: ev.title || 'Sanctuary Alarm',
              body: ev.body || 'Alarm triggered.',
              scheduledAt: new Date(ev.timestampMs || now).toISOString(),
              createdAt: new Date().toISOString(),
              read: true,
              route: 'alarms',
            });
          }
          return;
        }

        if (ev.kind === 'reminder') {
          const matchedTask = tasksRef.current.find((t) => t.id === ev.entityId);
          if (matchedTask) {
            const updated: TaskReminderItem = {
              ...matchedTask,
              lastNotifiedMinute: minuteKey || matchedTask.lastNotifiedMinute,
            };
            await putInStore('tasks', updated);
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            if (now - (ev.timestampMs || now) < 120_000) {
              setActiveReminderNotice(updated);
            }
          }
          if (minuteKey) {
            pushInboxNotification({
              dedupeKey: `task:${ev.entityId}:${minuteKey}`,
              kind: 'reminder',
              status: 'delivered',
              title: ev.title || 'Smart Reminder',
              body: ev.body || 'Scheduled task reminder.',
              scheduledAt: new Date(ev.timestampMs || now).toISOString(),
              createdAt: new Date().toISOString(),
              read: false,
              route: 'tasks',
            });
          }
          return;
        }

        if (ev.kind === 'calm') {
          const matchedSession = eventSessionsRef.current.find((s) => s.id === ev.entityId);
          if (matchedSession) {
            const updated: EventCalmSession = {
              ...matchedSession,
              lastCheckInMinute: minuteKey || matchedSession.lastCheckInMinute,
            };
            await putInStore('events', updated);
            setEventSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            if (now - (ev.timestampMs || now) < 180_000) {
              const pool = [...updated.selectedPrompts, ...updated.customPrompts]
                .map((p) => p.trim())
                .filter(Boolean);
              const leadPrompt =
                pool[0] || "It's okay. Take 3 slow breaths and return to the present moment.";
              setBreathingPromptState({
                session: updated,
                prompt: leadPrompt,
                startedAtMs: ev.timestampMs || now,
                muteInitialChime: true,
                isRingingAlarm: true,
                autoSnoozeCount: ev.autoSnoozeCount || 0,
                snoozeMinutes: ev.snoozeMinutes || 5,
                slotSeed: ev.scheduleId,
              });
            }
          }
          if (minuteKey) {
            pushInboxNotification({
              dedupeKey: `calm:${ev.entityId}:${minuteKey}`,
              kind: 'calm',
              status: 'delivered',
              title: ev.title || 'Event Calm',
              body: ev.body || 'Event Calm check-in alarm.',
              scheduledAt: new Date(ev.timestampMs || now).toISOString(),
              createdAt: new Date().toISOString(),
              read: false,
              route: 'event-calm',
            });
          }
        }
        return;
      }

      if (ev.type === 'snooze' || ev.type === 'auto_snoozed') {
        const effectiveMinutes = ev.snoozeMinutes && ev.snoozeMinutes > 0 ? ev.snoozeMinutes : 5;
        const snoozeTarget = new Date(
          ev.snoozeTargetMs || Date.now() + effectiveMinutes * 60_000
        );
        const snoozeDate = `${snoozeTarget.getFullYear()}-${String(
          snoozeTarget.getMonth() + 1
        ).padStart(2, '0')}-${String(snoozeTarget.getDate()).padStart(2, '0')}`;
        const snoozeTime = `${String(snoozeTarget.getHours()).padStart(2, '0')}:${String(
          snoozeTarget.getMinutes()
        ).padStart(2, '0')}`;

        if (ev.kind === 'calm') {
          setBreathingPromptState((curr) =>
            !ev.entityId || curr?.session.id === ev.entityId ? null : curr
          );
          if (ev.type === 'auto_snoozed') {
            const count = ev.autoSnoozeCount || 1;
            const formattedTime = formatTime12h(snoozeTime);
            pushInboxNotification({
              dedupeKey: `calm:${ev.entityId}:autosnooze:${snoozeDate}T${snoozeTime}`,
              kind: 'calm',
              status: 'missed',
              title: `Auto-snoozed ${effectiveMinutes}m · ${ev.title || 'Event Calm'}`,
              body: `Next Event Calm check-in at ${formattedTime} (auto-snooze ${count}/${MAX_AUTO_SNOOZES}).`,
              scheduledAt: snoozeTarget.toISOString(),
              createdAt: new Date().toISOString(),
              read: false,
              route: 'event-calm',
            });
          }
          return;
        }

        if (ev.kind === 'reminder') {
          const matchedTask = tasksRef.current.find((t) => t.id === ev.entityId);
          if (matchedTask) {
            const updated: TaskReminderItem = {
              ...matchedTask,
              dueDate: snoozeDate,
              dueTime: snoozeTime,
              lastNotifiedMinute: undefined,
            };
            await putInStore('tasks', updated);
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setActiveReminderNotice((curr) => (curr?.id === updated.id ? null : curr));
          }
          return;
        }

        const matchedAlarm =
          alarmsRef.current.find((a) => a.id === ev.entityId) || ringingAlarmRef.current;
        if (matchedAlarm) {
          const nextCount =
            ev.type === 'auto_snoozed'
              ? ev.autoSnoozeCount ?? (matchedAlarm.autoSnoozeCount || 0) + 1
              : 0;
          const updated: AlarmItem = {
            ...matchedAlarm,
            enabled: true,
            snoozedUntilDate: snoozeDate,
            snoozedUntilTime: snoozeTime,
            autoSnoozeCount: nextCount,
            lastTriggeredMinute: undefined,
          };
          await putInStore('alarms', updated);
          setAlarms((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setRingingAlarm((curr) => (curr?.id === updated.id ? null : curr));

          if (ev.type === 'auto_snoozed') {
            const formattedTime = formatTime12h(snoozeTime);
            const alarmTitle = updated.linkedReminderTitle || updated.label || 'Sanctuary Alarm';
            pushInboxNotification({
              dedupeKey: `alarm:${updated.id}:autosnooze:${snoozeDate}T${snoozeTime}`,
              kind: 'alarm',
              status: 'missed',
              title: `Auto-snoozed ${effectiveMinutes}m · ${alarmTitle}`,
              body: `${
                updated.linkedReminderNotes ? `${updated.linkedReminderNotes} · ` : ''
              }Next alarm at ${formattedTime} (auto-snooze ${nextCount}/${MAX_AUTO_SNOOZES}).`,
              scheduledAt: snoozeTarget.toISOString(),
              createdAt: new Date().toISOString(),
              read: false,
              route: 'alarms',
            });
          }
        } else {
          setRingingAlarm(null);
        }
        return;
      }

      if (ev.type === 'auto_stopped') {
        if (ev.kind === 'calm') {
          setBreathingPromptState((curr) =>
            !ev.entityId || curr?.session.id === ev.entityId ? null : curr
          );
          pushInboxNotification({
            dedupeKey: `calm:${ev.entityId}:exhausted:${Date.now()}`,
            kind: 'calm',
            status: 'missed',
            title: `Missed · ${ev.title || 'Event Calm'}`,
            body: `Auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes without dismissal.`,
            scheduledAt: new Date(ev.timestampMs || now).toISOString(),
            createdAt: new Date().toISOString(),
            read: false,
            route: 'event-calm',
          });
          return;
        }

        const matchedAlarm =
          alarmsRef.current.find((a) => a.id === ev.entityId) || ringingAlarmRef.current;
        if (matchedAlarm) {
          const nextState = getNextAlarmStateAfterFire(matchedAlarm, tasksRef.current);
          const cleaned: AlarmItem = {
            ...matchedAlarm,
            enabled: nextState.enabled,
            date: nextState.date,
            snoozedUntilDate: undefined,
            snoozedUntilTime: undefined,
            autoSnoozeCount: 0,
          };
          await putInStore('alarms', cleaned);
          setAlarms((prev) => prev.map((a) => (a.id === cleaned.id ? cleaned : a)));
          const alarmTitle = cleaned.linkedReminderTitle || cleaned.label || 'Sanctuary Alarm';
          pushInboxNotification({
            dedupeKey: `alarm:${cleaned.id}:exhausted:${Date.now()}`,
            kind: 'alarm',
            status: 'missed',
            title: `Missed · ${alarmTitle}`,
            body: `Auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes without dismissal.`,
            scheduledAt: new Date(ev.timestampMs || now).toISOString(),
            createdAt: new Date().toISOString(),
            read: false,
            route: 'alarms',
          });
        }
        setRingingAlarm((curr) =>
          !ev.entityId || curr?.id === ev.entityId ? null : curr
        );
        return;
      }

      if (ev.type === 'dismiss') {
        if (ev.kind === 'calm') {
          setBreathingPromptState((curr) =>
            !ev.entityId || curr?.session.id === ev.entityId ? null : curr
          );
          return;
        }
        if (ev.kind === 'reminder') {
          setActiveReminderNotice((curr) =>
            !ev.entityId || curr?.id === ev.entityId ? null : curr
          );
          return;
        }
        const matchedAlarm =
          alarmsRef.current.find((a) => a.id === ev.entityId) || ringingAlarmRef.current;
        if (
          matchedAlarm &&
          (matchedAlarm.snoozedUntilDate ||
            matchedAlarm.snoozedUntilTime ||
            (matchedAlarm.autoSnoozeCount || 0) > 0)
        ) {
          const cleaned: AlarmItem = {
            ...matchedAlarm,
            snoozedUntilDate: undefined,
            snoozedUntilTime: undefined,
            autoSnoozeCount: 0,
          };
          await putInStore('alarms', cleaned);
          setAlarms((prev) => prev.map((a) => (a.id === cleaned.id ? cleaned : a)));
        }
        setRingingAlarm((curr) =>
          !ev.entityId || curr?.id === ev.entityId ? null : curr
        );
      }
    },
    [pushInboxNotification]
  );

  const drainAndApplyNativeEvents = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setNativeEventsReady(true);
      return;
    }
    try {
      const { events, pendingRoute } = await drainNativePendingEvents();
      for (const ev of events) {
        await handleNativeAlertEvent(ev);
      }
      if (events.length > 0) {
        resetScheduleSyncFingerprint();
      }
      if (pendingRoute) {
        navigateTo(pendingRoute);
      }
    } finally {
      setNativeEventsReady(true);
    }
  }, [handleNativeAlertEvent, navigateTo]);

  useEffect(() => {
    if (!ready) return;
    void drainAndApplyNativeEvents();
  }, [ready, drainAndApplyNativeEvents]);

  // Immediate AppState / visibilitychange auto-lock + foreground missed-alert reconciliation + native event drain
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setVaultKey(null);
      } else if (document.visibilityState === 'visible') {
        void drainAndApplyNativeEvents().then(() => {
          reconcileMissedNotifications();
        });
      }
    };
    const handlePageHide = () => setVaultKey(null);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    const appStateHandle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        setVaultKey(null);
      } else {
        void drainAndApplyNativeEvents().then(() => {
          reconcileMissedNotifications();
        });
      }
    }).catch(() => null);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      void appStateHandle.then((h) => h?.remove());
    };
  }, [drainAndApplyNativeEvents, reconcileMissedNotifications]);

  const getAlarmSlotSeed = useCallback((alarm: AlarmItem, weekday = new Date().getDay()) => {
    return alarm.repeatDays.length > 0 && alarm.repeatDays.length < 7
      ? `alarm:${alarm.id}:w:${weekday}`
      : `alarm:${alarm.id}`;
  }, []);

  const handleStopAllSoundscapes = useCallback(() => {
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
  }, []);

  const snoozeAlarmByEntity = useCallback(
    async (
      targetAlarm: AlarmItem,
      minutes: number,
      options?: { autoSnoozed?: boolean; slotSeed?: string; nextAutoSnoozeCount?: number }
    ) => {
      stopAlarmRinging();
      const effectiveMinutes = minutes > 0 ? minutes : 5;
      const snoozeTarget = new Date(Date.now() + effectiveMinutes * 60 * 1000);
      const snoozeDate = `${snoozeTarget.getFullYear()}-${String(
        snoozeTarget.getMonth() + 1
      ).padStart(2, '0')}-${String(snoozeTarget.getDate()).padStart(2, '0')}`;
      const snoozeTime = `${String(snoozeTarget.getHours()).padStart(2, '0')}:${String(
        snoozeTarget.getMinutes()
      ).padStart(2, '0')}`;

      const nextAutoCount = options?.autoSnoozed
        ? options.nextAutoSnoozeCount ?? (targetAlarm.autoSnoozeCount || 0) + 1
        : 0;

      const updated: AlarmItem = {
        ...targetAlarm,
        enabled: true,
        snoozedUntilDate: snoozeDate,
        snoozedUntilTime: snoozeTime,
        autoSnoozeCount: nextAutoCount,
        lastTriggeredMinute: undefined,
      };
      await putInStore('alarms', updated);
      setAlarms((prev) => {
        const exists = prev.some((a) => a.id === updated.id);
        return exists ? prev.map((a) => (a.id === updated.id ? updated : a)) : [...prev, updated];
      });
      setRingingAlarm((curr) => (curr?.id === updated.id ? null : curr));

      const slotSeed = options?.slotSeed || getAlarmSlotSeed(updated);
      const alarmTitle = updated.linkedReminderTitle || updated.label || 'Sanctuary Alarm';
      const formattedTime = formatTime12h(snoozeTime);

      if (options?.autoSnoozed) {
        const autoKey = `alarm:${updated.id}:autosnooze:${snoozeDate}T${snoozeTime}`;
        pushInboxNotification({
          dedupeKey: autoKey,
          kind: 'alarm',
          status: 'missed',
          title: `Auto-snoozed ${effectiveMinutes}m · ${alarmTitle}`,
          body: `${
            updated.linkedReminderNotes ? `${updated.linkedReminderNotes} · ` : ''
          }Next alarm at ${formattedTime} (auto-snooze ${nextAutoCount}/${MAX_AUTO_SNOOZES}).`,
          scheduledAt: snoozeTarget.toISOString(),
          createdAt: new Date().toISOString(),
          read: false,
          route: 'alarms',
        });

        void sendSystemNotification({
          dedupeKey: autoKey,
          slotSeed,
          title: `Snoozed ${effectiveMinutes}m · ${alarmTitle}`,
          body: `${
            updated.linkedReminderNotes ? `${updated.linkedReminderNotes} · ` : ''
          }Next at ${formattedTime} (auto-snooze ${nextAutoCount}/${MAX_AUTO_SNOOZES})`,
          channel: 'alarm',
          route: 'alarms',
          entityId: updated.id,
          isPlaying: false,
          ongoing: false,
          replaceInPlace: true,
          snoozeMinutes: effectiveMinutes,
          soundLabel: updated.soundName,
        });
      } else {
        const primarySeed = `alarm:${updated.id}`;
        void removeNotificationBySlotSeed(primarySeed);
        if (slotSeed !== primarySeed) {
          void removeNotificationBySlotSeed(slotSeed);
        }
      }
    },
    [getAlarmSlotSeed, pushInboxNotification]
  );

  const exhaustAlarmAutoSnoozes = useCallback(
    async (targetAlarm: AlarmItem, slotSeedOverride?: string) => {
      stopAlarmRinging();
      setRingingAlarm((curr) => (curr?.id === targetAlarm.id ? null : curr));

      const nextState = getNextAlarmStateAfterFire(targetAlarm, tasksRef.current);
      const cleaned: AlarmItem = {
        ...targetAlarm,
        enabled: nextState.enabled,
        date: nextState.date,
        snoozedUntilDate: undefined,
        snoozedUntilTime: undefined,
        autoSnoozeCount: 0,
      };
      await putInStore('alarms', cleaned);
      setAlarms((prev) => prev.map((a) => (a.id === cleaned.id ? cleaned : a)));

      const slotSeed = slotSeedOverride || getAlarmSlotSeed(cleaned);
      const alarmTitle = cleaned.linkedReminderTitle || cleaned.label || 'Sanctuary Alarm';
      const exhaustedKey = `alarm:${cleaned.id}:exhausted:${Date.now()}`;

      pushInboxNotification({
        dedupeKey: exhaustedKey,
        kind: 'alarm',
        status: 'missed',
        title: `Missed · ${alarmTitle}`,
        body: `Auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes without dismissal.`,
        scheduledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        route: 'alarms',
      });

      void sendSystemNotification({
        dedupeKey: exhaustedKey,
        slotSeed,
        title: `Missed · ${alarmTitle}`,
        body: `Auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes without dismissal`,
        channel: 'alarm',
        route: 'alarms',
        entityId: cleaned.id,
        isPlaying: false,
        ongoing: false,
        replaceInPlace: true,
      });
    },
    [getAlarmSlotSeed, pushInboxNotification]
  );

  const snoozeTaskReminder = useCallback(async (task: TaskReminderItem, minutes = 5) => {
    const snoozeTarget = new Date(Date.now() + (minutes > 0 ? minutes : 5) * 60 * 1000);
    const nextDate = `${snoozeTarget.getFullYear()}-${String(
      snoozeTarget.getMonth() + 1
    ).padStart(2, '0')}-${String(snoozeTarget.getDate()).padStart(2, '0')}`;
    const nextTime = `${String(snoozeTarget.getHours()).padStart(2, '0')}:${String(
      snoozeTarget.getMinutes()
    ).padStart(2, '0')}`;

    const updated: TaskReminderItem = {
      ...task,
      dueDate: nextDate,
      dueTime: nextTime,
      lastNotifiedMinute: undefined,
    };
    await putInStore('tasks', updated);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setActiveReminderNotice((curr) => (curr?.id === updated.id ? null : curr));
    void removeNotificationBySlotSeed(`task:${updated.id}`);
  }, []);

  const triggerActiveAlarm = useCallback(
    async (alarm: AlarmItem, options?: { isTest?: boolean }) => {
      const soundLabel =
        alarm.soundName || resolveSoundName(customAudioTones, alarm.soundId);
      const currentAutoCount = alarm.autoSnoozeCount || 0;
      const alarmWithSound: AlarmItem = {
        ...alarm,
        soundName: soundLabel,
        snoozeMinutes: alarm.snoozeMinutes || 5,
        autoSnoozeCount: currentAutoCount,
      };
      setRingingAlarm(alarmWithSound);
      setRingingStartedAtMs(Date.now());

      const now = new Date();
      const today = getTodayStr();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const minuteKey = `${today}T${currentHHMM}`;
      const alarmDedupeKey = options?.isTest
        ? `alarm:test:${alarm.id}:${Date.now()}`
        : `alarm:${alarm.id}:${minuteKey}`;
      const slotSeed = getAlarmSlotSeed(alarmWithSound, now.getDay());

      if (!options?.isTest) {
        pushInboxNotification({
          dedupeKey: alarmDedupeKey,
          kind: 'alarm',
          status: 'delivered',
          title: alarm.linkedReminderTitle || alarm.label,
          body: alarm.linkedReminderNotes || `Alarm for ${formatTime12h(currentHHMM)}`,
          scheduledAt: now.toISOString(),
          createdAt: now.toISOString(),
          read: true,
          route: 'alarms',
        });
      }

      handleStopAllSoundscapes();
      stopSoundPreview();

      const matchedTone = alarm.soundId
        ? customAudioTones.find((t) => t.id === alarm.soundId)
        : undefined;

      if (Capacitor.isNativePlatform()) {
        const soundPath = matchedTone ? await syncCustomToneFileToNative(matchedTone) : '';
        await startNativeRingtone({
          scheduleId: `alarm:${alarm.id}`,
          notifId: hashToNotificationId(`alarm:${alarm.id}`),
          kind: 'alarm',
          entityId: alarm.id,
          title: alarm.linkedReminderTitle || alarm.label,
          body: (alarm.linkedReminderNotes || '').trim(),
          soundId: alarm.soundId || 'builtin:sanctuary-chime',
          soundPath: soundPath || '',
          soundName: soundLabel,
          route: 'alarms',
          snoozeMinutes: alarmWithSound.snoozeMinutes,
          autoSnoozeCount: currentAutoCount,
          isTest: Boolean(options?.isTest),
          slotKey: options?.isTest ? '' : alarmDedupeKey,
        });
        return;
      }

      // Web fallback: post browser Notification + play HTMLAudioElement / WebAudio
      await sendSystemNotification({
        dedupeKey: alarmDedupeKey,
        slotSeed,
        title: alarm.linkedReminderTitle || alarm.label,
        body: (alarm.linkedReminderNotes || '').trim(),
        channel: 'alarm',
        route: 'alarms',
        entityId: alarm.id,
        isPlaying: true,
        ongoing: true,
        replaceInPlace: true,
        soundLabel,
        snoozeMinutes: alarmWithSound.snoozeMinutes,
      });

      await new Promise<void>((resolve) => window.setTimeout(resolve, 120));

      startAlarmRinging(matchedTone, alarm.soundId, {
        maxDurationMs: ALARM_MAX_RING_MS,
        onAutoTimeout: () => {
          const latestAlarm =
            alarmsRef.current.find((a) => a.id === alarmWithSound.id) || alarmWithSound;
          const count = latestAlarm.autoSnoozeCount ?? currentAutoCount;
          if (count >= MAX_AUTO_SNOOZES) {
            void exhaustAlarmAutoSnoozes(latestAlarm, slotSeed);
          } else {
            void snoozeAlarmByEntity(latestAlarm, latestAlarm.snoozeMinutes || 5, {
              autoSnoozed: true,
              slotSeed,
              nextAutoSnoozeCount: count + 1,
            });
          }
        },
      });
    },
    [
      customAudioTones,
      exhaustAlarmAutoSnoozes,
      getAlarmSlotSeed,
      handleStopAllSoundscapes,
      pushInboxNotification,
      snoozeAlarmByEntity,
    ]
  );

  const triggerCalmCheckInAlarm = useCallback(
    async (params: {
      session: EventCalmSession;
      leadPrompt: string;
      fullChecklist: string;
      minuteKey: string;
      autoSnoozeCount?: number;
      snoozeMinutes?: number;
    }) => {
      const {
        session,
        leadPrompt,
        fullChecklist,
        minuteKey,
        autoSnoozeCount = 0,
        snoozeMinutes = 5,
      } = params;
      const calmDedupeKey = `calm:${session.id}:${minuteKey}`;
      const calmSlotKey = calmDedupeKey;
      const now = new Date();

      pushInboxNotification({
        dedupeKey: calmDedupeKey,
        kind: 'calm',
        status: 'delivered',
        title: `${session.eventName} · Event Calm`,
        body: fullChecklist,
        scheduledAt: now.toISOString(),
        createdAt: now.toISOString(),
        read: false,
        route: 'event-calm',
      });

      handleStopAllSoundscapes();
      stopSoundPreview();

      const soundId = defaultNotificationSoundIdRef.current;
      const matchedTone = customAudioTonesRef.current.find((t) => t.id === soundId);
      const soundLabel = resolveSoundName(customAudioTonesRef.current, soundId);

      if (Capacitor.isNativePlatform()) {
        const soundPath = matchedTone ? await syncCustomToneFileToNative(matchedTone) : '';
        await startNativeRingtone({
          scheduleId: calmDedupeKey,
          notifId: hashToNotificationId(calmDedupeKey),
          kind: 'calm',
          entityId: session.id,
          title: `${session.eventName} · Event Calm`,
          body: fullChecklist,
          soundId,
          soundPath: soundPath || '',
          soundName: soundLabel,
          route: 'event-calm',
          snoozeMinutes,
          autoSnoozeCount,
          slotKey: calmSlotKey,
        });
        setBreathingPromptState({
          session,
          prompt: leadPrompt,
          startedAtMs: Date.now(),
          muteInitialChime: true,
          isRingingAlarm: true,
          autoSnoozeCount,
          snoozeMinutes,
          slotSeed: calmDedupeKey,
        });
        return;
      }

      setBreathingPromptState({
        session,
        prompt: leadPrompt,
        startedAtMs: Date.now(),
        muteInitialChime: true,
        isRingingAlarm: true,
        autoSnoozeCount,
        snoozeMinutes,
        slotSeed: calmDedupeKey,
      });

      await sendSystemNotification({
        dedupeKey: calmDedupeKey,
        slotSeed: calmDedupeKey,
        title: `${session.eventName} · Event Calm`,
        body: fullChecklist,
        channel: 'calm',
        route: 'event-calm',
        entityId: session.id,
        isPlaying: true,
        ongoing: true,
        replaceInPlace: true,
        soundLabel,
        snoozeMinutes,
      });

      await new Promise<void>((resolve) => window.setTimeout(resolve, 120));

      startAlarmRinging(matchedTone, soundId, {
        maxDurationMs: ALARM_MAX_RING_MS,
        onAutoTimeout: () => {
          stopAlarmRinging();
          setBreathingPromptState((curr) =>
            curr?.session.id === session.id ? null : curr
          );

          if (autoSnoozeCount >= MAX_AUTO_SNOOZES) {
            const exhaustedKey = `calm:${session.id}:exhausted:${Date.now()}`;
            pushInboxNotification({
              dedupeKey: exhaustedKey,
              kind: 'calm',
              status: 'missed',
              title: `Missed · ${session.eventName} · Event Calm`,
              body: `Auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes without dismissal.`,
              scheduledAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              read: false,
              route: 'event-calm',
            });
            void sendSystemNotification({
              dedupeKey: exhaustedKey,
              slotSeed: calmDedupeKey,
              title: `Missed · ${session.eventName}`,
              body: `Event Calm alarm auto-stopped after ${MAX_AUTO_SNOOZES} auto-snoozes`,
              channel: 'calm',
              route: 'event-calm',
              entityId: session.id,
              isPlaying: false,
              ongoing: false,
              replaceInPlace: true,
            });
            return;
          }

          const nextCount = autoSnoozeCount + 1;
          const snoozeTarget = new Date(Date.now() + snoozeMinutes * 60_000);
          const sDate = `${snoozeTarget.getFullYear()}-${String(
            snoozeTarget.getMonth() + 1
          ).padStart(2, '0')}-${String(snoozeTarget.getDate()).padStart(2, '0')}`;
          const sTime = `${String(snoozeTarget.getHours()).padStart(2, '0')}:${String(
            snoozeTarget.getMinutes()
          ).padStart(2, '0')}`;

          snoozedCalmAlertsRef.current = [
            ...snoozedCalmAlertsRef.current.filter((item) => item.session.id !== session.id),
            {
              id: createId('calmsnz'),
              session,
              targetDate: sDate,
              targetTime: sTime,
              prompt: leadPrompt,
              fullChecklist,
              autoSnoozeCount: nextCount,
              snoozeMinutes,
            },
          ];

          const autoKey = `calm:${session.id}:autosnooze:${sDate}T${sTime}`;
          pushInboxNotification({
            dedupeKey: autoKey,
            kind: 'calm',
            status: 'missed',
            title: `Auto-snoozed ${snoozeMinutes}m · ${session.eventName}`,
            body: `Next Event Calm check-in at ${formatTime12h(sTime)} (auto-snooze ${nextCount}/${MAX_AUTO_SNOOZES}).`,
            scheduledAt: snoozeTarget.toISOString(),
            createdAt: new Date().toISOString(),
            read: false,
            route: 'event-calm',
          });
          void sendSystemNotification({
            dedupeKey: autoKey,
            slotSeed: calmDedupeKey,
            title: `Snoozed ${snoozeMinutes}m · ${session.eventName}`,
            body: `Next check-in at ${formatTime12h(sTime)} (auto-snooze ${nextCount}/${MAX_AUTO_SNOOZES})`,
            channel: 'calm',
            route: 'event-calm',
            entityId: session.id,
            isPlaying: false,
            ongoing: false,
            replaceInPlace: true,
          });
        },
      });
    },
    [handleStopAllSoundscapes, pushInboxNotification]
  );

  const handleSnoozeCalmOverlay = useCallback((minutes: number) => {
    const active = breathingPromptStateRef.current;
    if (!active) return;

    const effectiveMinutes = minutes > 0 ? minutes : 5;
    stopAlarmRinging();
    if (active.slotSeed) {
      void removeNotificationBySlotSeed(active.slotSeed);
    } else {
      void stopNativeRingtone();
    }

    const snoozeTarget = new Date(Date.now() + effectiveMinutes * 60_000);
    const sDate = `${snoozeTarget.getFullYear()}-${String(
      snoozeTarget.getMonth() + 1
    ).padStart(2, '0')}-${String(snoozeTarget.getDate()).padStart(2, '0')}`;
    const sTime = `${String(snoozeTarget.getHours()).padStart(2, '0')}:${String(
      snoozeTarget.getMinutes()
    ).padStart(2, '0')}`;

    snoozedCalmAlertsRef.current = [
      ...snoozedCalmAlertsRef.current.filter((item) => item.session.id !== active.session.id),
      {
        id: createId('calmsnz'),
        session: active.session,
        targetDate: sDate,
        targetTime: sTime,
        prompt: active.prompt,
        fullChecklist: formatEventCalmPrompts(active.session),
        autoSnoozeCount: 0, // manual snooze resets auto-snooze count
        snoozeMinutes: effectiveMinutes,
      },
    ];

    setBreathingPromptState(null);
  }, []);

  // Setup Android notification channels, native Broadcast listeners, & tap routing
  useEffect(() => {
    if (!ready || !authUser) return;
    void ensureNotificationSetup();

    const detachNative = attachNativeAudioListeners({
      onAlertEvent: (ev) => {
        void handleNativeAlertEvent(ev);
      },
      onRouteIntent: (targetRoute) => {
        navigateTo(targetRoute);
      },
    });

    const detachLocal = attachNotificationListeners({
      onNavigate: (targetRoute) => navigateTo(targetRoute),
      onNativeReceived: (item) => pushInboxNotification(item),
      onActionPerformed: (payload) => {
        if (payload.kind === 'calm') {
          if (payload.actionId === 'snooze') {
            handleSnoozeCalmOverlay(payload.snoozeMinutes || 5);
          } else {
            stopAlarmRinging();
            if (payload.slotSeed) void removeNotificationBySlotSeed(payload.slotSeed);
            setBreathingPromptState((curr) =>
              !payload.entityId || curr?.session.id === payload.entityId ? null : curr
            );
          }
          return;
        }

        if (payload.kind === 'reminder' && payload.entityId) {
          const targetTask = tasksRef.current.find((t) => t.id === payload.entityId);
          if (payload.actionId === 'snooze' && targetTask) {
            void snoozeTaskReminder(targetTask, payload.snoozeMinutes || 5);
          } else {
            setActiveReminderNotice(null);
            if (payload.slotSeed) void removeNotificationBySlotSeed(payload.slotSeed);
          }
          return;
        }

        const matchedAlarm =
          (payload.entityId && alarmsRef.current.find((a) => a.id === payload.entityId)) ||
          ringingAlarmRef.current ||
          undefined;

        if (payload.actionId === 'snooze') {
          if (matchedAlarm) {
            void snoozeAlarmByEntity(
              matchedAlarm,
              payload.snoozeMinutes || matchedAlarm.snoozeMinutes || 5,
              { slotSeed: payload.slotSeed }
            );
          } else {
            stopAlarmRinging();
            setRingingAlarm(null);
          }
        } else if (payload.actionId === 'dismiss') {
          stopAlarmRinging();
          if (
            matchedAlarm &&
            (matchedAlarm.snoozedUntilDate ||
              matchedAlarm.snoozedUntilTime ||
              (matchedAlarm.autoSnoozeCount || 0) > 0)
          ) {
            const cleaned: AlarmItem = {
              ...matchedAlarm,
              snoozedUntilDate: undefined,
              snoozedUntilTime: undefined,
              autoSnoozeCount: 0,
            };
            void putInStore('alarms', cleaned);
            setAlarms((prev) => prev.map((a) => (a.id === cleaned.id ? cleaned : a)));
          }
          if (payload.slotSeed) {
            void removeNotificationBySlotSeed(payload.slotSeed);
          }
          setRingingAlarm(null);
        }
      },
    });
    return () => {
      detachNative();
      detachLocal();
    };
  }, [
    ready,
    authUser,
    handleNativeAlertEvent,
    handleSnoozeCalmOverlay,
    navigateTo,
    pushInboxNotification,
    snoozeAlarmByEntity,
    snoozeTaskReminder,
  ]);

  useEffect(() => {
    if (!ready || !authUser || !nativeEventsReady) return;
    resetScheduleSyncFingerprint();
    void syncScheduledNativeNotifications({
      alarms,
      tasks,
      eventSessions,
      birthdays,
      customAudioTones,
      defaultNotificationSoundId,
    });
  }, [
    ready,
    authUser,
    nativeEventsReady,
    alarms,
    tasks,
    eventSessions,
    birthdays,
    customAudioTones,
    defaultNotificationSoundId,
  ]);

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

  // Refresh minute clock so HomeView Event Calm status activates/expires right on schedule
  const [minuteClockTick, setMinuteClockTick] = useState(() => {
    const d = new Date();
    return `${getTodayStr()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      const next = `${getTodayStr()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setMinuteClockTick((prev) => (prev === next ? prev : next));
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

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
  }, [eventSessions, minuteClockTick]);

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

      // 1. Check Alarms (regular schedule OR snoozed wake-up time)
      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        if (alarm.lastTriggeredMinute === minuteKey) continue;

        const isSnoozeDue =
          alarm.snoozedUntilDate === today && alarm.snoozedUntilTime === currentHHMM;
        const matchesDateIfOneTime =
          !alarm.date || alarm.repeatDays.length > 0 || alarm.date === today;
        const isRegularDue =
          matchesDateIfOneTime &&
          alarm.time === currentHHMM &&
          (alarm.repeatDays.length === 0 || alarm.repeatDays.includes(weekday));

        if (!isSnoozeDue && !isRegularDue) continue;

        const alarmSlotKey = `alarm:${alarm.id}:${minuteKey}`;
        if (Capacitor.isNativePlatform()) {
          const claimed = await tryClaimNativeSlot(alarmSlotKey);
          if (!claimed) {
            // Native SanctuaryAlarmReceiver already triggered this alarm
            const nextState = getNextAlarmStateAfterFire(alarm, tasks);
            const syncedAlarm: AlarmItem = {
              ...alarm,
              lastTriggeredMinute: minuteKey,
              snoozedUntilDate: undefined,
              snoozedUntilTime: undefined,
              enabled: nextState.enabled,
              date: nextState.date,
            };
            setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? syncedAlarm : a)));
            await putInStore('alarms', syncedAlarm);
            continue;
          }
        }

        const nextState = getNextAlarmStateAfterFire(alarm, tasks);
        const updatedAlarm: AlarmItem = {
          ...alarm,
          lastTriggeredMinute: minuteKey,
          snoozedUntilDate: undefined,
          snoozedUntilTime: undefined,
          enabled: nextState.enabled,
          date: nextState.date,
        };
        setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? updatedAlarm : a)));
        await putInStore('alarms', updatedAlarm);

        void triggerActiveAlarm(updatedAlarm);
        break;
      }

      // 1b. Check Smart Task Reminders (linked fallback if alarm missing, plus unlinked reminders)
      for (const task of tasks) {
        if (task.completed) continue;
        if (!task.dueTime || task.dueTime !== currentHHMM || !doesTaskMatchDate(task, today)) {
          continue;
        }
        if (task.lastNotifiedMinute === minuteKey) continue;

        if (task.linkedAlarmId) {
          const linkedAlarm = alarms.find((a) => a.id === task.linkedAlarmId);
          // If linkedAlarm exists, loop #1 above handles it. Only fall back if orphaned/missing.
          if (linkedAlarm) continue;

          const soundId = task.soundId || defaultNotificationSoundId;
          const soundLabel = task.soundName || resolveSoundName(customAudioTones, soundId);
          const fallbackAlarm: AlarmItem = {
            id: task.linkedAlarmId,
            label: task.title,
            time: task.dueTime,
            date: task.dueDate,
            enabled: false,
            repeatDays: task.recurrence === 'Daily' ? [0, 1, 2, 3, 4, 5, 6] : [],
            snoozeMinutes: 5,
            linkedReminderId: task.id,
            linkedReminderTitle: task.title,
            linkedReminderNotes: task.notes,
            soundId,
            soundName: soundLabel,
            lastTriggeredMinute: minuteKey,
            createdAt: task.createdAt,
          };
          const updatedTask: TaskReminderItem = {
            ...task,
            lastNotifiedMinute: minuteKey,
          };
          setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
          await putInStore('tasks', updatedTask);
          void triggerActiveAlarm(fallbackAlarm);
          break;
        }

        const taskSlotKey = `reminder:${task.id}:${minuteKey}`;
        if (Capacitor.isNativePlatform()) {
          const claimed = await tryClaimNativeSlot(taskSlotKey);
          if (!claimed) {
            const syncedTask: TaskReminderItem = { ...task, lastNotifiedMinute: minuteKey };
            setTasks((prev) => prev.map((t) => (t.id === task.id ? syncedTask : t)));
            await putInStore('tasks', syncedTask);
            continue;
          }
        }

        const soundId = task.soundId || defaultNotificationSoundId;
        const soundLabel = task.soundName || resolveSoundName(customAudioTones, soundId);
        const updatedTask: TaskReminderItem = {
          ...task,
          soundId,
          soundName: soundLabel,
          lastNotifiedMinute: minuteKey,
        };
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
        await putInStore('tasks', updatedTask);

        const taskDedupeKey = `task:${task.id}:${minuteKey}`;
        pushInboxNotification({
          dedupeKey: taskDedupeKey,
          kind: 'reminder',
          status: 'delivered',
          title: task.title,
          body: task.notes || `Scheduled reminder at ${formatTime12h(currentHHMM)}`,
          scheduledAt: now.toISOString(),
          createdAt: now.toISOString(),
          read: false,
          route: 'tasks',
        });

        setActiveReminderNotice(updatedTask);

        if (Capacitor.isNativePlatform()) {
          const matchedTone = customAudioTones.find((t) => t.id === soundId);
          const soundPath = matchedTone ? await syncCustomToneFileToNative(matchedTone) : '';
          await startNativeRingtone({
            scheduleId: `task:${task.id}`,
            notifId: hashToNotificationId(`task:${task.id}`),
            kind: 'reminder',
            entityId: task.id,
            title: task.title,
            body: (task.notes || '').trim(),
            soundId,
            soundPath: soundPath || '',
            soundName: soundLabel,
            route: 'tasks',
            snoozeMinutes: 5,
            slotKey: taskSlotKey,
          });
        } else {
          await sendSystemNotification({
            dedupeKey: taskDedupeKey,
            slotSeed: `task:${task.id}`,
            title: task.title,
            body: (task.notes || '').trim(),
            channel: 'reminder',
            route: 'tasks',
            entityId: task.id,
            isPlaying: true,
            ongoing: false,
            replaceInPlace: true,
            soundLabel,
            snoozeMinutes: 5,
          });

          await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
          playNotificationSound(customAudioTones, soundId);
        }
        break;
      }

      // 2. Check All Active Event Calm Mode Check-In Intervals using live clock time
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const session of eventSessions) {
        if (!session.active || session.date !== today) continue;
        if (session.lastCheckInMinute === minuteKey) continue;

        const startMin = parseMinutes(session.startTime);
        const endMin = parseMinutes(session.endTime);
        if (nowMin < startMin || nowMin > endMin) continue;

        const elapsed = nowMin - startMin;

        let shouldTrigger = false;
        if (session.isMidpointOnly) {
          const midpoint = Math.round((startMin + endMin) / 2);
          shouldTrigger = nowMin === midpoint;
        } else if (session.intervalMinutes > 0 && elapsed >= 0) {
          shouldTrigger = elapsed % session.intervalMinutes === 0;
        }

        if (!shouldTrigger) continue;

        const calmSlotKey = `calm:${session.id}:${minuteKey}`;
        if (Capacitor.isNativePlatform()) {
          const claimed = await tryClaimNativeSlot(calmSlotKey);
          if (!claimed) {
            const syncedSession: EventCalmSession = { ...session, lastCheckInMinute: minuteKey };
            setEventSessions((prev) =>
              prev.map((s) => (s.id === syncedSession.id ? syncedSession : s))
            );
            await putInStore('events', syncedSession);
            continue;
          }
        }

        const pool = [...session.selectedPrompts, ...session.customPrompts]
          .map((p) => p.trim())
          .filter(Boolean);
        const leadPrompt =
          pool[Math.floor(Math.random() * pool.length)] ||
          "It's okay. Take 3 slow breaths and return to the present moment.";
        const fullPromptChecklist = formatEventCalmPrompts(session);

        const updatedSession: EventCalmSession = {
          ...session,
          lastCheckInMinute: minuteKey,
        };
        setEventSessions((prev) =>
          prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        );
        await putInStore('events', updatedSession);

        await triggerCalmCheckInAlarm({
          session: updatedSession,
          leadPrompt,
          fullChecklist: fullPromptChecklist,
          minuteKey,
          autoSnoozeCount: 0,
          snoozeMinutes: 5,
        });
      }

      // 2b. Check snoozed Event Calm check-ins (from manual or auto-snooze in foreground/Web)
      const dueCalmSnooze = snoozedCalmAlertsRef.current.find(
        (item) => item.targetDate === today && item.targetTime === currentHHMM
      );
      if (dueCalmSnooze) {
        snoozedCalmAlertsRef.current = snoozedCalmAlertsRef.current.filter(
          (item) => item.id !== dueCalmSnooze.id
        );
        const latestSession =
          eventSessionsRef.current.find((s) => s.id === dueCalmSnooze.session.id) ||
          dueCalmSnooze.session;
        if (latestSession.active) {
          await triggerCalmCheckInAlarm({
            session: latestSession,
            leadPrompt: dueCalmSnooze.prompt,
            fullChecklist: dueCalmSnooze.fullChecklist,
            minuteKey,
            autoSnoozeCount: dueCalmSnooze.autoSnoozeCount,
            snoozeMinutes: dueCalmSnooze.snoozeMinutes,
          });
        }
      }

      // 3. Birthdays: deliver gentle OS drawer notifications (on-the-day & active offsets)
      for (const b of birthdays) {
        const info = getDaysUntilBirthday(b.birthDate);
        if (!info.nextOccurrenceDate) continue;
        const [ny, nm, nd] = info.nextOccurrenceDate.split('-').map(Number);
        if ([ny, nm, nd].some((n) => Number.isNaN(n))) continue;
        const dayTargetMs = new Date(ny, nm - 1, nd, 9, 0, 0, 0).getTime();

        const dispatchBirthdayOsNotice = async (params: {
          key: string;
          title: string;
          body: string;
          scheduledIso: string;
        }) => {
          if (hasBirthdayDrawerSent(params.key)) return;
          markBirthdayDrawerSent(params.key);

          pushInboxNotification({
            dedupeKey: params.key,
            kind: 'birthday',
            status: 'delivered',
            title: params.title,
            body: params.body,
            scheduledAt: params.scheduledIso,
            createdAt: now.toISOString(),
            read: false,
            route: 'birthdays',
          });

          if (Capacitor.isNativePlatform()) {
            const claimed = await tryClaimNativeSlot(params.key);
            if (!claimed) return;
            const matchedTone = customAudioTones.find(
              (t) => t.id === defaultNotificationSoundId
            );
            const soundPath = matchedTone ? await syncCustomToneFileToNative(matchedTone) : '';
            await startNativeRingtone({
              scheduleId: params.key,
              notifId: hashToNotificationId(params.key),
              kind: 'calm',
              entityId: b.id,
              title: params.title,
              body: params.body,
              soundId: defaultNotificationSoundId,
              soundPath: soundPath || '',
              soundName: 'Birthday Reminder',
              route: 'birthdays',
              snoozeMinutes: 5,
              slotKey: params.key,
            });
          } else {
            void sendSystemNotification({
              dedupeKey: params.key,
              slotSeed: params.key,
              title: params.title,
              body: params.body,
              channel: 'birthday',
              route: 'birthdays',
              entityId: b.id,
            });
          }
        };

        // On-the-day birthday notification (9:00 AM onwards)
        if (info.daysUntil === 0 && currentHHMM >= '09:00') {
          await dispatchBirthdayOsNotice({
            key: `bday:${b.id}:day:${today}`,
            title: `🎂 ${b.name}’s Birthday Today`,
            body:
              b.wishTemplate ||
              `Remember to send a warm birthday wish to ${b.name} (${b.relationship}).`,
            scheduledIso: `${today}T09:00:00`,
          });
        }

        // Advance offset reminders
        for (const off of b.offsets || []) {
          if (!off || off.value <= 0) continue;
          const unitMs =
            off.unit === 'minutes'
              ? 60_000
              : off.unit === 'hours'
                ? 3_600_000
                : 86_400_000;
          const offsetTriggerMs = dayTargetMs - off.value * unitMs;
          const deltaMs = now.getTime() - offsetTriggerMs;
          if (deltaMs >= 0 && deltaMs < 120_000) {
            await dispatchBirthdayOsNotice({
              key: `bday:${b.id}:off:${off.id}:${info.nextOccurrenceDate}`,
              title: `🎂 Upcoming Birthday: ${b.name}`,
              body: `${off.value} ${off.unit} until ${b.name}’s birthday (${b.relationship}). ${
                b.wishTemplate ? 'Pre-written wish is ready in Birthdays.' : ''
              }`.trim(),
              scheduledIso: new Date(offsetTriggerMs).toISOString(),
            });
          }
        }
      }
    };

    const interval = window.setInterval(tick, 4000);
    return () => window.clearInterval(interval);
  }, [
    ready,
    alarms,
    tasks,
    eventSessions,
    birthdays,
    customAudioTones,
    defaultNotificationSoundId,
    pushInboxNotification,
    triggerActiveAlarm,
    triggerCalmCheckInAlarm,
  ]);

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
    const target = tasks.find((t) => t.id === id);
    await deleteFromStore('tasks', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setActiveReminderNotice((curr) => (curr?.id === id ? null : curr));
    void removeNotificationBySlotSeed(`task:${id}`);

    if (target?.linkedAlarmId) {
      await deleteFromStore('alarms', target.linkedAlarmId);
      setAlarms((prev) => prev.filter((a) => a.id !== target.linkedAlarmId));
      setRingingAlarm((curr) => (curr?.id === target.linkedAlarmId ? null : curr));
      void removeNotificationBySlotSeed(`alarm:${target.linkedAlarmId}`);
    }
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
    setMediaItems((prev) => {
      const exists = prev.some((m) => m.id === item.id);
      return exists ? prev.map((m) => (m.id === item.id ? item : m)) : [item, ...prev];
    });
  };

  const deleteMedia = async (id: string) => {
    const target = mediaItems.find((m) => m.id === id);
    await deletePrivateMediaFile(target);
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
    setRingingAlarm((curr) => (curr?.id === id ? null : curr));
    void removeNotificationBySlotSeed(`alarm:${id}`);
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

  const saveCustomTone = async (tone: CustomAudioTone) => {
    await putInStore('custom_audio', tone);
    setCustomAudioTones((prev) => {
      const exists = prev.some((t) => t.id === tone.id);
      return exists ? prev.map((t) => (t.id === tone.id ? tone : t)) : [tone, ...prev];
    });
  };

  const deleteCustomTone = async (id: string) => {
    await deleteFromStore('custom_audio', id);
    setCustomAudioTones((prev) => prev.filter((t) => t.id !== id));
  };

  const handleChangeDefaultNotificationSound = (soundId: string) => {
    setDefaultNotificationSoundId(soundId);
    persistDefaultNotificationSoundId(soundId);
  };

  const [dailyQuoteId, setDailyQuoteId] = useState<string | null>(() => {
    const saved = getDailyQuoteSelection();
    return saved && saved.date === getTodayStr() ? saved.quoteId : null;
  });

  useEffect(() => {
    if (quotes.length === 0) return;
    const today = getTodayStr();
    const saved = getDailyQuoteSelection();

    if (saved && saved.date === today && quotes.some((q) => q.id === saved.quoteId)) {
      if (dailyQuoteId !== saved.quoteId) {
        setDailyQuoteId(saved.quoteId);
      }
      return;
    }

    // New day: automatically select a fresh daily quote different from yesterday's quote
    const daysSinceEpoch = Math.floor(Date.now() / 86_400_000);
    const pool =
      quotes.length > 1 && saved?.quoteId
        ? quotes.filter((q) => q.id !== saved.quoteId)
        : quotes;
    const chosen = pool[daysSinceEpoch % pool.length] || quotes[0];
    if (chosen) {
      saveDailyQuoteSelection(today, chosen.id);
      setDailyQuoteId(chosen.id);
    }
  }, [quotes, dailyQuoteId]);

  const featuredDailyQuote = useMemo(() => {
    if (quotes.length === 0) return null;
    return (
      (dailyQuoteId ? quotes.find((q) => q.id === dailyQuoteId) : undefined) ||
      quotes.find((q) => q.pinnedToHome) ||
      quotes[0]
    );
  }, [quotes, dailyQuoteId]);

  const handleShuffleHomeQuote = async () => {
    if (quotes.length <= 1) return;
    const currentId = featuredDailyQuote?.id;
    const candidates = quotes.filter((q) => q.id !== currentId);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (!next) return;
    const today = getTodayStr();
    saveDailyQuoteSelection(today, next.id);
    setDailyQuoteId(next.id);
    const prevPinned = quotes.find((q) => q.pinnedToHome);
    if (prevPinned && prevPinned.id !== next.id) {
      await saveQuote({ ...prevPinned, pinnedToHome: false });
    }
    if (!next.pinnedToHome) {
      await saveQuote({ ...next, pinnedToHome: true });
    }
  };

  const handleOpenBreathing = (session: EventCalmSession) => {
    const pool = [...session.selectedPrompts, ...session.customPrompts];
    const prompt =
      pool[Math.floor(Math.random() * pool.length)] ||
      "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.";
    setBreathingPromptState({ session, prompt, startedAtMs: Date.now() });
  };

  const handleSnoozeAlarm = async (minutes: number) => {
    const active = ringingAlarmRef.current;
    if (!active) return;
    await snoozeAlarmByEntity(active, minutes);
  };

  const handleDismissAlarm = useCallback(() => {
    const active = ringingAlarmRef.current;
    stopAlarmRinging();
    if (active) {
      const primarySeed = `alarm:${active.id}`;
      const slotSeed = getAlarmSlotSeed(active);
      void removeNotificationBySlotSeed(primarySeed);
      if (slotSeed !== primarySeed) {
        void removeNotificationBySlotSeed(slotSeed);
      }
      if (
        active.snoozedUntilDate ||
        active.snoozedUntilTime ||
        (active.autoSnoozeCount || 0) > 0
      ) {
        const cleaned: AlarmItem = {
          ...active,
          snoozedUntilDate: undefined,
          snoozedUntilTime: undefined,
          autoSnoozeCount: 0,
        };
        void putInStore('alarms', cleaned);
        setAlarms((prev) => prev.map((a) => (a.id === cleaned.id ? cleaned : a)));
      }
    } else {
      void stopNativeRingtone();
    }
    setRingingAlarm(null);
  }, [getAlarmSlotSeed]);

  const handleCloseBreathingOverlay = useCallback(() => {
    const active = breathingPromptStateRef.current;
    if (!active) return;
    stopAlarmRinging();
    if (active.slotSeed) {
      void removeNotificationBySlotSeed(active.slotSeed);
    } else if (active.isRingingAlarm) {
      void stopNativeRingtone();
    }
    snoozedCalmAlertsRef.current = snoozedCalmAlertsRef.current.filter(
      (item) => item.session.id !== active.session.id
    );
    const elapsedMinutes = Math.max(
      1,
      Math.round((Date.now() - active.startedAtMs) / 60000)
    );
    const updated = recordCalmMinutes(getTodayStr(), elapsedMinutes);
    setCalmMinutesByDate(updated);
    setBreathingPromptState(null);
  }, []);

  // Android hardware Back button & browser popstate navigation handler
  useEffect(() => {
    const backHandle = CapApp.addListener('backButton', () => {
      if (notificationsDrawerOpenRef.current) {
        setNotificationsDrawerOpen(false);
        return;
      }
      if (profileDrawerOpenRef.current) {
        setProfileDrawerOpen(false);
        return;
      }
      if (breathingPromptStateRef.current) {
        handleCloseBreathingOverlay();
        return;
      }
      if (activeReminderNoticeRef.current) {
        setActiveReminderNotice(null);
        return;
      }
      if (ringingAlarmRef.current) {
        handleDismissAlarm();
        return;
      }

      if (historyRef.current.length > 0) {
        const previousRoute = historyRef.current.pop()!;
        navigateTo(previousRoute, { pushHistory: false, restoreScroll: true });
        return;
      }

      const curr = routeRef.current;
      if (curr !== 'home') {
        const currIsSecondary =
          curr !== 'tasks' && curr !== 'calendar' && curr !== 'alarms' && curr !== 'explore';
        navigateTo(currIsSecondary ? 'explore' : 'home', {
          pushHistory: false,
          restoreScroll: true,
        });
        return;
      }

      void CapApp.minimizeApp();
    }).catch(() => null);

    const handlePopState = () => {
      if (historyRef.current.length > 0) {
        const previousRoute = historyRef.current.pop()!;
        navigateTo(previousRoute, { pushHistory: false, restoreScroll: true });
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      void backHandle.then((h) => h?.remove());
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleCloseBreathingOverlay, handleDismissAlarm, navigateTo]);

  // Master PIN Update (re-encrypts existing Vault secrets with the new PIN) & Reset handler
  const handleChangeMasterPin = useCallback(
    async (currentPin: string, newPin: string): Promise<{ ok: boolean; error?: string }> => {
      const saved = await getSetting<SecuritySettings>('security');
      if (!saved) {
        return { ok: false, error: 'Security lock is not configured yet.' };
      }
      if (!/^\d{4,6}$/.test(newPin)) {
        return { ok: false, error: 'New PIN must be 4 to 6 digits.' };
      }

      const currentHash = await hashPin(currentPin, saved.pinSalt);
      if (currentHash !== saved.pinHash) {
        return { ok: false, error: 'Current Master PIN is incorrect.' };
      }

      try {
        const oldKey = await deriveVaultKey(currentPin, saved.pinSalt);
        const newSalt = generateSalt();
        const newPinHash = await hashPin(newPin, newSalt);
        const newKey = await deriveVaultKey(newPin, newSalt);

        const reencryptedRecords: EncryptedVaultRecord[] = [];
        for (const rec of vaultRecords) {
          const payload = await decryptPayload<VaultSecretPayload>(
            rec.iv,
            rec.ciphertext,
            oldKey
          );
          const { iv, ciphertext } = await encryptPayload(payload, newKey);
          const updatedRec: EncryptedVaultRecord = {
            ...rec,
            iv,
            ciphertext,
            updatedAt: new Date().toISOString(),
          };
          await putInStore('vault', updatedRec);
          reencryptedRecords.push(updatedRec);
        }

        const updatedWithBio = await syncBiometricAfterPinChange(newPin, {
          ...saved,
          pinHash: newPinHash,
          pinSalt: newSalt,
          updatedAt: new Date().toISOString(),
        });
        await putInStore('settings', updatedWithBio);

        setVaultRecords(reencryptedRecords);
        setVaultKey(newKey);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Failed to update Master PIN. Try again.' };
      }
    },
    [vaultRecords]
  );

  const handleResetVaultLock = useCallback(async () => {
    await clearStoredBiometricData();
    setVaultKey(null);
    setVaultRecords([]);
  }, []);

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

  // handleStopAllSoundscapes defined above triggerActiveAlarm

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

  const handleUpdateDisplayName = useCallback(
    async (newName: string): Promise<{ ok: boolean; error?: string }> => {
      const clean = newName.trim().slice(0, 60);
      if (!clean) {
        return { ok: false, error: 'Name cannot be empty.' };
      }

      setLocalPreferredName(clean);
      saveLocalPreferredName(clean);

      if (authUser) {
        try {
          await updateProfile(authUser, { displayName: clean });
        } catch {
          // Non-blocking offline
        }
        if (isEmailVerified) {
          try {
            await upsertUserProfile(authUser, clean);
            setUserProfile((prev) =>
              prev ? { ...prev, displayName: clean, preferredName: clean } : prev
            );
          } catch {
            // Keep local name even if offline
          }
        }
      }
      return { ok: true };
    },
    [authUser, isEmailVerified]
  );

  const handleMarkNotificationRead = useCallback((id: string) => {
    setInboxNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotificationHistory(next);
      return next;
    });
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setInboxNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveNotificationHistory(next);
      return next;
    });
  }, []);

  const handleDismissInboxNotification = useCallback((id: string) => {
    setInboxNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target?.dedupeKey) {
        addDismissedNotificationKeys([target.dedupeKey]);
      }
      const next = prev.filter((n) => n.id !== id);
      saveNotificationHistory(next);
      return next;
    });
  }, []);

  const handleClearAllInboxNotifications = useCallback(() => {
    setInboxNotifications((prev) => {
      const keysToDismiss = prev.map((n) => n.dedupeKey).filter(Boolean);
      const pendingMissed = collectMissedAndTodayInboxItems({
        alarms: alarmsRef.current,
        tasks: tasksRef.current,
        eventSessions,
        birthdays,
        existingHistory: prev,
      }).map((n) => n.dedupeKey);
      addDismissedNotificationKeys([...keysToDismiss, ...pendingMissed]);
      saveNotificationHistory([]);
      return [];
    });
  }, [birthdays, eventSessions]);

  const unreadNotificationCount = useMemo(
    () => inboxNotifications.filter((n) => !n.read).length,
    [inboxNotifications]
  );

  const preferredGreetingName = (
    localPreferredName ||
    userProfile?.preferredName ||
    userProfile?.displayName ||
    authUser?.displayName ||
    ''
  ).trim();

  const activeDisplayName =
    preferredGreetingName ||
    authUser?.email?.split('@')[0] ||
    'My World';

  const profileAvatarInitial =
    (preferredGreetingName || authUser?.email || 'M')[0]?.toUpperCase() || 'M';

  const handleSignOut = async () => {
    setVaultKey(null);
    historyRef.current = [];
    setProfileDrawerOpen(false);
    setNotificationsDrawerOpen(false);
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
    await signOutSanctuary();
    navigateTo('home', { pushHistory: false });
  };

  if (!authReady || !ready) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] dark:bg-[#0F1115] flex items-center justify-center p-6">
        <p className="font-display text-lg text-[#5B6472] dark:text-[#98A2B3]">Opening My World...</p>
      </div>
    );
  }

  if (!authUser) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen text-[#111827] dark:text-[#F1F3F6] flex flex-col transition-colors">
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
      {/* Desktop Left Sanctuary Rail (Frosted Pastel Surface) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-900/[0.08] dark:border-white/[0.08] bg-[#FAFDFB]/88 dark:bg-[#131722]/90 backdrop-blur-md p-6 sticky top-0 h-screen justify-between transition-colors">
        <div className="space-y-8 overflow-y-auto pr-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="text-left focus-visible:outline-2 focus-visible:outline-[#9EC5AB]"
            >
              <span className="font-display text-2xl font-medium text-[#111827] dark:text-[#F1F3F6] tracking-tight block">
                My World
              </span>
              <span className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">
                Personal Sanctuary
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNotificationsDrawerOpen(true)}
              aria-label="Open notifications"
              title="Notifications"
              className="relative min-w-[40px] min-h-[40px] rounded-xl bg-white/85 dark:bg-[#1D2230] hover:bg-white dark:hover:bg-white/[0.09] border border-slate-900/[0.08] dark:border-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center shrink-0 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F2B8A2] text-[#0F1115] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>
          </div>

          <nav className="space-y-1.5" aria-label="Primary sections">
            {PRIMARY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = route === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateTo(tab.id)}
                  className={`w-full min-h-[44px] px-3.5 rounded-2xl flex items-center gap-3 text-sm transition-all whitespace-nowrap border ${
                    active
                      ? `${tab.activeBox} ${tab.activeText} font-semibold shadow-xs`
                      : 'border-transparent text-[#5B6472] dark:text-[#98A2B3] font-medium hover:text-[#111827] dark:hover:text-[#F1F3F6] hover:bg-white/60 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? tab.activeText : tab.idleIcon}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-900/[0.07] dark:border-white/[0.06]">
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] px-3.5 mb-2">Modules</p>
            <nav className="space-y-1" aria-label="All modules">
              {SECONDARY_LINKS.map((item) => {
                const Icon = item.icon;
                const active = route === item.route;
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => navigateTo(item.route)}
                    className={`w-full min-h-[42px] px-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white/90 dark:bg-white/[0.1] text-[#111827] dark:text-[#F1F3F6] font-semibold shadow-xs border border-slate-900/[0.08] dark:border-white/[0.08]'
                        : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6] hover:bg-white/55 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-900/[0.07] dark:border-white/[0.06] space-y-3">
          {activeSoundscapeIds.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#F4F6F8] dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('soundscapes')}
                  className="text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] truncate hover:underline text-left"
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
                  className="w-8 h-8 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.1] dark:hover:bg-white/[0.1] text-[#A6482D] dark:text-[#F2B8A2] flex items-center justify-center shrink-0"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Clickable Profile & Settings Trigger Card (Sign Out & Name live inside this side panel) */}
          <button
            type="button"
            onClick={() => setProfileDrawerOpen(true)}
            aria-label="Open Profile & Settings"
            className="w-full text-left rounded-2xl bg-[#F4F6F8] dark:bg-[#171A21] hover:bg-[#ECEFF3] dark:hover:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.07] p-3 flex items-center justify-between gap-2.5 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={activeDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#9EC5AB]/25 text-[#2E6B48] dark:text-[#9EC5AB] text-xs font-semibold flex items-center justify-center shrink-0">
                  {(activeDisplayName || authUser.email || 'M')[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#111827] dark:text-[#F1F3F6] truncate">
                  {activeDisplayName}
                </p>
                <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] truncate">
                  {authUser.email}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {/* Mobile Account & Navigation Header (non-sticky, restores scroll on Back) */}
          <div className="mb-4 lg:hidden flex items-center justify-between gap-2">
            {isSecondaryRoute ? (
              <button
                type="button"
                onClick={() => {
                  if (historyRef.current[historyRef.current.length - 1] === 'explore') {
                    historyRef.current.pop();
                  }
                  navigateTo('explore', { pushHistory: false, restoreScroll: true });
                }}
                className="min-h-[44px] px-3 -ml-2 rounded-2xl inline-flex items-center gap-2 text-xs font-medium text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Explore Hub
              </button>
            ) : route !== 'home' ? (
              <button
                type="button"
                onClick={() => {
                  if (historyRef.current[historyRef.current.length - 1] === 'home') {
                    historyRef.current.pop();
                  }
                  navigateTo('home', { pushHistory: false, restoreScroll: true });
                }}
                className="min-h-[44px] px-3 -ml-2 rounded-2xl inline-flex items-center gap-2 text-xs font-medium text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setProfileDrawerOpen(true)}
                aria-label="Open Profile & Settings"
                className="min-h-[44px] px-2 -ml-2 rounded-2xl hover:bg-white/60 dark:hover:bg-white/[0.06] inline-flex items-center gap-2.5 min-w-0 transition-colors"
              >
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={activeDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#9EC5AB]/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#9EC5AB]/35 text-[#245A3B] dark:text-[#9EC5AB] text-xs font-semibold flex items-center justify-center shrink-0">
                    {profileAvatarInitial}
                  </div>
                )}
                {preferredGreetingName && (
                  <span className="text-xs font-semibold text-[#334155] dark:text-[#D0D5DD] truncate max-w-[180px]">
                    {preferredGreetingName}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setNotificationsDrawerOpen(true)}
                aria-label="Open notifications"
                className="relative min-w-[44px] min-h-[44px] rounded-2xl bg-white/85 dark:bg-[#191E2B] border border-slate-900/[0.08] dark:border-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center transition-colors shadow-xs"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F2B8A2] text-[#0F1115] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {route !== 'home' && (
                <button
                  type="button"
                  onClick={() => setProfileDrawerOpen(true)}
                  aria-label="Open Profile & Settings"
                  className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/85 dark:bg-[#191E2B] border border-slate-900/[0.08] dark:border-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center transition-colors shadow-xs"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Email verification notice for newly created Email/Password accounts */}
          {!isEmailVerified && (
            <div className="mb-5 rounded-2xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/40 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2]">
                  Verify your email ({authUser.email}) to sync your cloud profile
                </p>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                  {emailVerificationSent
                    ? 'Verification email sent. Check your inbox and click the link, then tap I’ve Verified.'
                    : 'Your local sanctuary works right away. Verify your inbox link whenever ready.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail();
                    setEmailVerificationSent(true);
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] whitespace-nowrap"
                >
                  Resend Link
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const updated = await reloadCurrentUser();
                    if (updated?.emailVerified) {
                      await updated.getIdToken(true);
                      setIsEmailVerified(true);
                    }
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-xs font-semibold whitespace-nowrap"
                >
                  I’ve Verified
                </button>
              </div>
            </div>
          )}

          {/* Mobile Inline Active Soundscapes Bar */}
          {activeSoundscapeIds.length > 0 && route !== 'soundscapes' && (
            <div className="mb-4 lg:hidden rounded-2xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.08] px-4 py-2.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigateTo('soundscapes')}
                className="flex items-center gap-2 text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] min-w-0 truncate"
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
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-[#A6482D] dark:text-[#F2B8A2] flex items-center justify-center shrink-0"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {route === 'home' && (
            <HomeView
              userName={preferredGreetingName}
              quotes={quotes}
              featuredQuote={featuredDailyQuote}
              tasks={tasks}
              birthdays={birthdays}
              eventSessions={eventSessions}
              activeEventSession={activeEventSession}
              onNavigate={navigateTo}
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
                todaySteps: dailyStepsByDate[getTodayStr()] || 0,
              }}
              onNavigate={navigateTo}
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
              onChangeMasterPin={handleChangeMasterPin}
              onResetVault={handleResetVaultLock}
            />
          )}

          {route === 'quotes' && (
            <QuotesView quotes={quotes} onSaveQuote={saveQuote} onDeleteQuote={deleteQuote} />
          )}

          {route === 'tasks' && (
            <TasksView
              tasks={tasks}
              alarms={alarms}
              customAudioTones={customAudioTones}
              defaultNotificationSoundId={defaultNotificationSoundId}
              onSaveTask={saveTask}
              onDeleteTask={deleteTask}
              onCreateLinkedAlarm={saveAlarm}
              onDeleteLinkedAlarm={deleteAlarm}
              onSaveCustomTone={saveCustomTone}
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
              onChangeMasterPin={handleChangeMasterPin}
              onResetVault={handleResetVaultLock}
            />
          )}

          {route === 'calendar' && (
            <CalendarView
              events={calendarEvents}
              tasks={tasks}
              birthdays={birthdays}
              eventSessions={eventSessions}
              alarms={alarms}
              customAudioTones={customAudioTones}
              defaultNotificationSoundId={defaultNotificationSoundId}
              onSaveEvent={saveCalendarEvent}
              onDeleteEvent={deleteCalendarEvent}
              onSaveTask={saveTask}
              onDeleteTask={deleteTask}
              onCreateLinkedAlarm={saveAlarm}
              onDeleteLinkedAlarm={deleteAlarm}
              onSaveCustomTone={saveCustomTone}
              onSaveEventSession={saveEventSession}
              onDeleteEventSession={deleteEventSession}
              onOpenBreathing={handleOpenBreathing}
            />
          )}

          {route === 'alarms' && (
            <AlarmsView
              alarms={alarms}
              customAudioTones={customAudioTones}
              defaultNotificationSoundId={defaultNotificationSoundId}
              onSaveAlarm={saveAlarm}
              onDeleteAlarm={deleteAlarm}
              onTestRingAlarm={(alarm) => {
                void triggerActiveAlarm(alarm, { isTest: true });
              }}
              onSaveCustomTone={saveCustomTone}
              onDeleteCustomTone={deleteCustomTone}
              onChangeDefaultNotificationSound={handleChangeDefaultNotificationSound}
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
                navigateTo('maps');
              }}
            />
          )}

          {route === 'health' && (
            <HealthMonitorView
              profile={healthProfile}
              dailyStepsByDate={dailyStepsByDate}
              nativeStepSensorAvailable={nativeStepStatus.sensorAvailable}
              nativeStepPermissionGranted={nativeStepStatus.permissionGranted}
              isNativePlatform={Capacitor.isNativePlatform()}
              onSaveProfile={handleSaveHealthProfile}
              onUpdateTodaySteps={handleUpdateTodaySteps}
              onRequestNativeSteps={handleRequestNativeSteps}
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
              healthProfile={healthProfile}
              dailyStepsByDate={dailyStepsByDate}
              onNavigate={navigateTo}
            />
          )}

          {route === 'maps' && (
            <MapsView
              initialDestinationQuery={mapsInitialQuery}
              onSaveEventSession={saveEventSession}
              onSaveCalendarEvent={saveCalendarEvent}
              onNavigateToEventCalm={() => navigateTo('event-calm')}
              onNavigateToCalendar={() => navigateTo('calendar')}
            />
          )}

          {route === 'game' && <GameView />}

          {route === 'ai-chat' && <ChatbotView onSaveToNote={saveNote} />}

          {route === 'voice-live' && <VoiceLiveView onSaveToNote={saveNote} />}

          {route === 'transcribe' && <TranscribeView onSaveToNote={saveNote} />}
        </div>
      </main>
      </div>

      {/* Mobile Fixed 5-Tab Bottom Navigation Bar with clear pastel per-tab highlights (<= 15% sticky height cap) */}
      <nav
        aria-label="Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[68px] bg-[#FAFDFB]/92 dark:bg-[#131722]/92 backdrop-blur-md border-t border-slate-900/[0.08] dark:border-white/[0.08] grid grid-cols-5 items-stretch px-1.5 pb-1 transition-colors shadow-[0_-4px_20px_rgba(15,23,42,0.05)]"
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeBottomTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              aria-current={active ? 'page' : undefined}
              className="relative min-h-[48px] flex flex-col items-center justify-center gap-1 pt-1 transition-all"
            >
              {/* Crisp top active indicator bar */}
              <span
                className={`absolute top-0 w-9 h-[3px] rounded-b-full transition-all duration-200 ${
                  active ? `${tab.activeBar} opacity-100 scale-x-100` : 'opacity-0 scale-x-50'
                }`}
              />
              {/* Distinct pastel container for active tab icon */}
              <span
                className={`px-3.5 py-1 rounded-2xl border transition-all duration-200 flex items-center justify-center ${
                  active
                    ? `${tab.activeBox} ${tab.activeText} shadow-xs scale-[1.03]`
                    : `border-transparent ${tab.idleIcon}`
                }`}
              >
                <Icon className="w-[19px] h-[19px]" />
              </span>
              <span
                className={`text-[11px] tracking-tight leading-none whitespace-nowrap transition-colors ${
                  active
                    ? `${tab.activeText} font-semibold`
                    : 'text-[#5B6472] dark:text-[#98A2B3] font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Profile & Settings Side Panel */}
      <ProfileSettingsDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        authUser={authUser}
        currentDisplayName={preferredGreetingName}
        isEmailVerified={isEmailVerified}
        theme={theme}
        onChangeTheme={setTheme}
        onUpdateName={handleUpdateDisplayName}
        defaultNotificationSoundId={defaultNotificationSoundId}
        customAudioTones={customAudioTones}
        onChangeDefaultNotificationSound={handleChangeDefaultNotificationSound}
        unreadNotificationCount={unreadNotificationCount}
        onOpenNotifications={() => setNotificationsDrawerOpen(true)}
        onNavigate={navigateTo}
        onSignOut={handleSignOut}
      />

      {/* Missed & Recent Notifications Bell Drawer */}
      <NotificationsDrawer
        open={notificationsDrawerOpen}
        onClose={() => setNotificationsDrawerOpen(false)}
        notifications={inboxNotifications}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onDismissItem={handleDismissInboxNotification}
        onClearAll={handleClearAllInboxNotifications}
        onNavigate={navigateTo}
      />

      {/* Active Ringing Alarm Modal */}
      {ringingAlarm && (
        <ActiveAlarmOverlay
          alarm={ringingAlarm}
          startedAtMs={ringingStartedAtMs}
          onDismiss={handleDismissAlarm}
          onSnooze={handleSnoozeAlarm}
        />
      )}

      {/* Scheduled Reminder Notification Banner */}
      {activeReminderNotice && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl bg-white dark:bg-[#171A21] border border-[#9EC5AB]/50 p-4 shadow-xl space-y-3"
        >
          <div className="min-w-0">
            <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB] font-medium flex items-center gap-1.5">
              <span>▶</span>
              <span>
                Scheduled Reminder
                {activeReminderNotice.soundName ? ` · ${activeReminderNotice.soundName}` : ''}
              </span>
            </p>
            <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6] mt-0.5 truncate">
              {activeReminderNotice.title}
            </p>
            {activeReminderNotice.notes && (
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1 line-clamp-2">
                {activeReminderNotice.notes}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void snoozeTaskReminder(activeReminderNotice, 5)}
              className="min-h-[38px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-xs font-medium text-[#5B4D8A] dark:text-[#BEB4DC] shrink-0"
            >
              Snooze 5m
            </button>
            <button
              type="button"
              onClick={() => {
                void removeNotificationBySlotSeed(`task:${activeReminderNotice.id}`);
                setActiveReminderNotice(null);
              }}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-xs font-semibold text-[#0F1115] shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Event Calm Mode Breathing & Grounding Modal */}
      {breathingPromptState && (
        <EventCheckInOverlay
          session={breathingPromptState.session}
          promptMessage={breathingPromptState.prompt}
          customAudioTones={customAudioTones}
          notificationSoundId={defaultNotificationSoundId}
          muteInitialChime={breathingPromptState.muteInitialChime}
          isRingingAlarm={breathingPromptState.isRingingAlarm}
          ringingStartedAtMs={breathingPromptState.startedAtMs}
          autoSnoozeCount={breathingPromptState.autoSnoozeCount}
          snoozeMinutes={breathingPromptState.snoozeMinutes}
          onSnooze={handleSnoozeCalmOverlay}
          onClose={handleCloseBreathingOverlay}
        />
      )}
    </div>
  );
}

export default App;
