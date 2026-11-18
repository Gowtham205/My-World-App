import type {
  AlarmItem,
  AppNotificationItem,
  AppTheme,
  BirthdayEntry,
  CalendarEventItem,
  CreativeIdeaCard,
  CustomAudioTone,
  EventCalmSession,
  MediaAlbum,
  MotivationalQuote,
  PersonalNote,
  PrivateMediaItem,
  SecuritySettings,
  TaskReminderItem,
  EncryptedVaultRecord,
} from '../types/sanctuary';

const DB_NAME = 'my_world_sanctuary_db';
const DB_VERSION = 2;

export type StoreName =
  | 'notes'
  | 'vault'
  | 'quotes'
  | 'tasks'
  | 'birthdays'
  | 'albums'
  | 'media'
  | 'calendar'
  | 'alarms'
  | 'ideas'
  | 'events'
  | 'settings'
  | 'custom_audio';

const ALL_STORES: StoreName[] = [
  'notes',
  'vault',
  'quotes',
  'tasks',
  'birthdays',
  'albums',
  'media',
  'calendar',
  'alarms',
  'ideas',
  'events',
  'settings',
  'custom_audio',
];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putInStore<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSetting<T>(id: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function createId(prefix = 'mw'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatOffsetDate(daysDelta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysDelta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SEED_FLAG_KEY = 'my_world_seeded_v1';

export async function seedInitialSanctuaryDataIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SEED_FLAG_KEY)) return;

  const existingQuotes = await getAllFromStore<MotivationalQuote>('quotes');
  const existingNotes = await getAllFromStore<PersonalNote>('notes');
  if (existingQuotes.length > 0 || existingNotes.length > 0) {
    localStorage.setItem(SEED_FLAG_KEY, '1');
    return;
  }

  const nowIso = new Date().toISOString();
  const todayStr = formatOffsetDate(0);

  const starterNotes: PersonalNote[] = [
    {
      id: createId('note'),
      title: 'Quiet Evening Reset Ritual',
      content:
        'Keep screens dim after 9 PM. Write down tomorrow’s top 2 priorities so the mind can rest without carrying loose threads.\n\nReference reading: https://calnewport.com/blog/',
      folder: 'Personal',
      tags: ['ritual', 'calm'],
      pinned: true,
      isTodoIntent: false,
      checklist: [
        { id: createId('chk'), text: 'Prepare chamomile tea', done: true },
        { id: createId('chk'), text: 'Set morning wake-up alarm', done: false },
        { id: createId('chk'), text: 'Leave phone across the room', done: false },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: createId('note'),
      title: 'I have to finish the studio desk cable tidy',
      content:
        'Measure velcro sleeves and mount the power brick under the desk tray before Friday.',
      folder: 'Home',
      tags: ['errands'],
      pinned: false,
      isTodoIntent: true,
      checklist: [
        { id: createId('chk'), text: 'Label USB-C charging leads', done: false },
        { id: createId('chk'), text: 'Clear desk surface completely', done: false },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const starterQuotes: MotivationalQuote[] = [
    {
      id: createId('quote'),
      text: 'You do not have to respond to every wave in the room. Stillness is also an answer.',
      author: 'Personal Sanctuary',
      mood: 'Calm',
      pinnedToHome: true,
      createdAt: nowIso,
    },
    {
      id: createId('quote'),
      text: 'Small, steady bricks laid in silence build things that outlast noise.',
      author: 'Daily Practice',
      mood: 'Focus',
      pinnedToHome: false,
      createdAt: nowIso,
    },
    {
      id: createId('quote'),
      text: 'Notice the story your mind is rehearsing, thank it for trying to protect you, and return to the breath.',
      author: 'Grounding Note',
      mood: 'Overthinking',
      pinnedToHome: false,
      createdAt: nowIso,
    },
    {
      id: createId('quote'),
      text: 'Confidence is quiet readiness—walking in knowing you do not need everyone’s applause.',
      author: 'Self Reminder',
      mood: 'Confidence',
      pinnedToHome: false,
      createdAt: nowIso,
    },
    {
      id: createId('quote'),
      text: 'Begin gently. One clear hour of unhurried work is worth four hours of scattered rush.',
      author: 'Morning Pages',
      mood: 'Morning',
      pinnedToHome: false,
      createdAt: nowIso,
    },
  ];

  const linkedAlarmId = createId('alarm');
  const starterTasks: TaskReminderItem[] = [
    {
      id: createId('task'),
      title: 'Take a mindful break while working',
      notes: 'Step away from the monitor, stretch shoulders, drink a full glass of water.',
      priority: 'High',
      category: 'Health',
      dueDate: todayStr,
      dueTime: '16:00',
      endTime: '17:00',
      recurrence: 'Daily',
      completed: false,
      linkedAlarmId,
      createdAt: nowIso,
    },
    {
      id: createId('task'),
      title: 'Review weekly design notes',
      notes: 'Sort loose sketches into the Creative Ideas Hub.',
      priority: 'Medium',
      category: 'Work',
      dueDate: formatOffsetDate(1),
      dueTime: '10:30',
      recurrence: 'Weekly',
      completed: false,
      createdAt: nowIso,
    },
  ];

  const starterAlarms: AlarmItem[] = [
    {
      id: createId('alarm'),
      label: 'Gentle Morning Wake-Up',
      time: '07:00',
      enabled: true,
      repeatDays: [1, 2, 3, 4, 5],
      snoozeMinutes: 10,
      createdAt: nowIso,
    },
    {
      id: linkedAlarmId,
      label: 'Take a mindful break while working',
      time: '16:00',
      enabled: true,
      repeatDays: [0, 1, 2, 3, 4, 5, 6],
      snoozeMinutes: 5,
      linkedReminderId: starterTasks[0].id,
      linkedReminderTitle: starterTasks[0].title,
      linkedReminderNotes: starterTasks[0].notes,
      createdAt: nowIso,
    },
  ];

  const starterBirthdays: BirthdayEntry[] = [
    {
      id: createId('bday'),
      name: 'Aarav Mehta',
      birthDate: `1996-${formatOffsetDate(4).slice(5)}`,
      relationship: 'Close Friend',
      wishTemplate:
        'Happy Birthday, Aarav! Wishing you a peaceful, grounded year filled with good health and moments that genuinely make you smile.',
      offsets: [
        { id: createId('off'), value: 1, unit: 'days' },
        { id: createId('off'), value: 2, unit: 'hours' },
      ],
      createdAt: nowIso,
    },
    {
      id: createId('bday'),
      name: 'Mom',
      birthDate: `1968-${formatOffsetDate(18).slice(5)}`,
      relationship: 'Family',
      wishTemplate:
        'Happy Birthday, Mom! Thank you for always being my calmest anchor. Cannot wait to celebrate with dinner tonight.',
      offsets: [
        { id: createId('off'), value: 3, unit: 'days' },
        { id: createId('off'), value: 30, unit: 'minutes' },
      ],
      createdAt: nowIso,
    },
  ];

  const starterEvents: CalendarEventItem[] = [
    {
      id: createId('cal'),
      title: 'Evening Walk at Botanical Park',
      date: todayStr,
      startTime: '18:15',
      endTime: '19:00',
      location: 'Botanical Trail North Gate',
      notes: 'Leave headphones behind and notice the twilight sky.',
      color: 'sage',
      createdAt: nowIso,
    },
    {
      id: createId('cal'),
      title: 'Pottery Wheel Trial Class',
      date: formatOffsetDate(3),
      startTime: '11:00',
      endTime: '12:30',
      location: 'Clay & Stone Studio',
      notes: 'Wear clothes that can get dusty.',
      color: 'lavender',
      createdAt: nowIso,
    },
  ];

  const starterAlbums: MediaAlbum[] = [
    {
      id: 'album_sanctuary',
      name: 'Quiet Moments',
      description: 'Private keepsakes stored strictly inside your browser sandbox.',
      createdAt: nowIso,
    },
    {
      id: 'album_documents',
      name: 'Personal Documents',
      description: 'IDs, scans, and receipts hidden from public views.',
      createdAt: nowIso,
    },
  ];

  const idea1Id = createId('idea');
  const idea2Id = createId('idea');
  const idea3Id = createId('idea');

  const starterIdeas: CreativeIdeaCard[] = [
    {
      id: idea1Id,
      title: 'Ceramic Glaze & Texture Study',
      body: 'Explore matte stoneware finishes paired with muted lavender and slate mineral tones for an offline studio journal.',
      board: 'Moodboard',
      color: 'lavender',
      imageUrl: '/src/assets/images/moodboard_ceramic_studio_1794911112803.jpg',
      paletteSwatches: ['#9EC5AB', '#BEB4DC', '#1E232E', '#F2B8A2'],
      connectedIds: [idea2Id],
      createdAt: nowIso,
    },
    {
      id: idea2Id,
      title: 'Learn Hand-Built Tea Cups',
      body: 'Practice pinching and trimming raw clay edges for 20 minutes every Sunday morning without perfectionism.',
      board: 'Learn',
      color: 'sage',
      imageUrl: '/src/assets/images/moodboard_quiet_rain_1794911113970.jpg',
      connectedIds: [idea1Id],
      createdAt: nowIso,
    },
    {
      id: idea3Id,
      title: 'Local-Only Micro Journal Concept',
      body: 'Zero accounts, zero analytics, tactile paper-like typography. Built purely for calm daily reflection.',
      board: 'Projects',
      color: 'peach',
      connectedIds: [],
      createdAt: nowIso,
    },
  ];

  const starterEventSessions: EventCalmSession[] = [
    {
      id: createId('evcalm'),
      eventName: 'Cousin’s Reception Dinner',
      venue: 'The Glasshouse Conservatory, MG Road',
      date: formatOffsetDate(2),
      startTime: '18:30',
      endTime: '21:30',
      intervalMinutes: 20,
      isMidpointOnly: false,
      selectedPrompts: [
        "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.",
        'Step outside for 2 minutes of fresh air and take 3 slow breaths.',
        'Release overthinking—focus only on the present moment.',
      ],
      customPrompts: ['Sip water slowly whenever you feel rushed.'],
      active: false,
      createdAt: nowIso,
    },
  ];

  for (const n of starterNotes) await putInStore('notes', n);
  for (const q of starterQuotes) await putInStore('quotes', q);
  for (const t of starterTasks) await putInStore('tasks', t);
  for (const a of starterAlarms) await putInStore('alarms', a);
  for (const b of starterBirthdays) await putInStore('birthdays', b);
  for (const c of starterEvents) await putInStore('calendar', c);
  for (const al of starterAlbums) await putInStore('albums', al);
  for (const idea of starterIdeas) await putInStore('ideas', idea);
  for (const ev of starterEventSessions) await putInStore('events', ev);

  localStorage.setItem(SEED_FLAG_KEY, '1');
}

export async function exportLocalBackupJson(): Promise<string> {
  const [notes, vault, quotes, tasks, birthdays, calendar, alarms, ideas, events, albums] =
    await Promise.all([
      getAllFromStore<PersonalNote>('notes'),
      getAllFromStore<EncryptedVaultRecord>('vault'),
      getAllFromStore<MotivationalQuote>('quotes'),
      getAllFromStore<TaskReminderItem>('tasks'),
      getAllFromStore<BirthdayEntry>('birthdays'),
      getAllFromStore<CalendarEventItem>('calendar'),
      getAllFromStore<AlarmItem>('alarms'),
      getAllFromStore<CreativeIdeaCard>('ideas'),
      getAllFromStore<EventCalmSession>('events'),
      getAllFromStore<MediaAlbum>('albums'),
    ]);

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'My World Local Sanctuary',
      notes,
      vault, // encrypted ciphertext only
      quotes,
      tasks,
      birthdays,
      calendar,
      alarms,
      ideas,
      events,
      albums,
    },
    null,
    2
  );
}

const CALM_MINUTES_KEY = 'my_world_calm_minutes_v1';

export function getCalmMinutesByDate(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CALM_MINUTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function recordCalmMinutes(dateStr: string, minutes: number): Record<string, number> {
  const current = getCalmMinutesByDate();
  const safeAdd = Math.max(1, Math.round(minutes));
  const updated = {
    ...current,
    [dateStr]: (current[dateStr] || 0) + safeAdd,
  };
  try {
    localStorage.setItem(CALM_MINUTES_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
  return updated;
}

const DEFAULT_NOTIF_SOUND_KEY = 'my_world_default_notif_sound_v1';

export function getDefaultNotificationSoundId(): string {
  if (typeof window === 'undefined') return 'builtin:calm-chime';
  try {
    return localStorage.getItem(DEFAULT_NOTIF_SOUND_KEY) || 'builtin:calm-chime';
  } catch {
    return 'builtin:calm-chime';
  }
}

export function setDefaultNotificationSoundId(soundId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEFAULT_NOTIF_SOUND_KEY, soundId);
  } catch {
    // ignore storage quota errors
  }
}

const THEME_STORAGE_KEY = 'my_world_theme_v1';

export function getSavedTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage quota errors
  }
}

const LOCAL_PREFERRED_NAME_KEY = 'my_world_preferred_name_v1';

export function getLocalPreferredName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(LOCAL_PREFERRED_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLocalPreferredName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = name.trim().slice(0, 60);
    if (clean) {
      localStorage.setItem(LOCAL_PREFERRED_NAME_KEY, clean);
    } else {
      localStorage.removeItem(LOCAL_PREFERRED_NAME_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

const NOTIFICATION_INBOX_KEY = 'my_world_notification_inbox_v1';
const MAX_NOTIFICATION_INBOX = 80;

export function getNotificationHistory(): AppNotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_INBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotificationItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotificationHistory(items: AppNotificationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      NOTIFICATION_INBOX_KEY,
      JSON.stringify(items.slice(0, MAX_NOTIFICATION_INBOX))
    );
  } catch {
    // ignore storage quota errors
  }
}

const DISMISSED_NOTIFICATION_KEYS_STORAGE = 'my_world_dismissed_notif_keys_v1';
const MAX_DISMISSED_NOTIFICATION_KEYS = 350;

export function getDismissedNotificationKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_NOTIFICATION_KEYS_STORAGE);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === 'string'));
  } catch {
    return new Set();
  }
}

export function addDismissedNotificationKeys(keys: string[]): void {
  if (typeof window === 'undefined' || keys.length === 0) return;
  try {
    const raw = localStorage.getItem(DISMISSED_NOTIFICATION_KEYS_STORAGE);
    const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const merged = Array.isArray(existing) ? [...existing] : [];
    const seen = new Set(merged);
    for (const k of keys) {
      if (typeof k === 'string' && k && !seen.has(k)) {
        seen.add(k);
        merged.push(k);
      }
    }
    localStorage.setItem(
      DISMISSED_NOTIFICATION_KEYS_STORAGE,
      JSON.stringify(merged.slice(-MAX_DISMISSED_NOTIFICATION_KEYS))
    );
  } catch {
    // ignore storage quota errors
  }
}

const DAILY_QUOTE_STORAGE_KEY = 'my_world_daily_quote_v1';

export interface DailyQuoteSelection {
  date: string;
  quoteId: string;
}

export function getDailyQuoteSelection(): DailyQuoteSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_QUOTE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyQuoteSelection>;
    if (typeof parsed.date === 'string' && typeof parsed.quoteId === 'string') {
      return { date: parsed.date, quoteId: parsed.quoteId };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDailyQuoteSelection(date: string, quoteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_QUOTE_STORAGE_KEY, JSON.stringify({ date, quoteId }));
  } catch {
    // ignore storage quota errors
  }
}

export type {
  PersonalNote,
  EncryptedVaultRecord,
  MotivationalQuote,
  TaskReminderItem,
  BirthdayEntry,
  MediaAlbum,
  PrivateMediaItem,
  CalendarEventItem,
  AlarmItem,
  CreativeIdeaCard,
  EventCalmSession,
  SecuritySettings,
  CustomAudioTone,
  AppTheme,
  AppNotificationItem,
};
