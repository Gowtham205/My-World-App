export type AppRoute =
  | 'home'
  | 'tasks'
  | 'calendar'
  | 'alarms'
  | 'explore'
  | 'notes'
  | 'vault'
  | 'quotes'
  | 'birthdays'
  | 'gallery'
  | 'ideas'
  | 'event-calm'
  | 'soundscapes'
  | 'analytics'
  | 'maps'
  | 'game'
  | 'ai-chat'
  | 'voice-live'
  | 'transcribe';

export type BottomTab = 'home' | 'tasks' | 'calendar' | 'alarms' | 'explore';

export interface NoteChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PersonalNote {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  pinned: boolean;
  isTodoIntent: boolean; // "I have to do this" marker
  checklist: NoteChecklistItem[];
  updatedAt: string;
  createdAt: string;
}

export type VaultEntryType =
  | 'login'
  | 'secret_note'
  | 'bank_card'
  | 'pin'
  | 'relationship'
  | 'custom';

export interface VaultCustomField {
  id: string;
  key: string;
  value: string;
  secret?: boolean;
}

export interface VaultSecretPayload {
  title: string;
  type: VaultEntryType;
  username?: string;
  password?: string;
  url?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  pinCode?: string;
  notes?: string;
  customFields: VaultCustomField[];
}

export interface EncryptedVaultRecord {
  id: string;
  type: VaultEntryType;
  labelHint: string; // Stored only in encrypted payload if desired, or unencrypted minimal label? Let's keep ALL sensitive fields inside ciphertext! Store only id, iv, ciphertext, updatedAt.
  iv: string;
  ciphertext: string;
  updatedAt: string;
  createdAt: string;
}

export interface DecryptedVaultItem extends VaultSecretPayload {
  id: string;
  updatedAt: string;
  createdAt: string;
}

export type QuoteMood = 'Calm' | 'Confidence' | 'Focus' | 'Overthinking' | 'Morning';

export interface MotivationalQuote {
  id: string;
  text: string;
  author: string;
  mood: QuoteMood;
  pinnedToHome: boolean;
  createdAt: string;
}

export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskCategory = 'Personal' | 'Work' | 'Health' | 'Learning' | 'Home';
export type RecurrencePattern = 'Once' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';

export interface TaskReminderItem {
  id: string;
  title: string;
  notes: string;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM or ''
  endTime?: string; // optional e.g. 17:00
  recurrence: RecurrencePattern;
  customRecurrenceNote?: string;
  completed: boolean;
  completedAt?: string;
  linkedAlarmId?: string;
  soundId?: string;
  soundName?: string;
  lastNotifiedMinute?: string;
  createdAt: string;
}

export type OffsetUnit = 'minutes' | 'hours' | 'days';

export interface BirthdayOffset {
  id: string;
  value: number;
  unit: OffsetUnit;
}

export interface BirthdayEntry {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  relationship: string;
  wishTemplate: string;
  offsets: BirthdayOffset[];
  createdAt: string;
}

export interface MediaAlbum {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface PrivateMediaItem {
  id: string;
  albumId: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  blob: Blob;
  createdAt: string;
}

export type CalendarEventColor = 'sage' | 'lavender' | 'peach' | 'sky';

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM or ''
  endTime: string;
  location: string;
  notes: string;
  color: CalendarEventColor;
  syncedToDevice?: boolean;
  createdAt: string;
}

export interface AlarmItem {
  id: string;
  label: string;
  time: string; // HH:MM (24h)
  enabled: boolean;
  repeatDays: number[]; // 0=Sun..6=Sat, empty = once
  snoozeMinutes: number;
  linkedReminderId?: string;
  linkedReminderTitle?: string;
  linkedReminderNotes?: string;
  soundId?: string;
  soundName?: string;
  lastTriggeredMinute?: string; // YYYY-MM-DDTHH:MM
  snoozedUntilDate?: string; // YYYY-MM-DD
  snoozedUntilTime?: string; // HH:MM
  createdAt: string;
}

export type AudioToneCategory = 'alarm' | 'reminder' | 'notification';

export interface CustomAudioTone {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  category: AudioToneCategory;
  createdAt: string;
}

export type IdeaCardColor = 'sage' | 'lavender' | 'peach' | 'sky' | 'slate';
export type IdeaBoardType = 'Learn' | 'Practice' | 'Business' | 'Projects' | 'Moodboard';

export interface CreativeIdeaCard {
  id: string;
  title: string;
  body: string;
  board: IdeaBoardType;
  color: IdeaCardColor;
  imageUrl?: string;
  paletteSwatches?: string[];
  connectedIds: string[];
  createdAt: string;
}

export interface EventCalmSession {
  id: string;
  eventName: string;
  venue: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  intervalMinutes: number; // e.g. 15, 20, 30, or 0 for midpoint
  isMidpointOnly: boolean;
  selectedPrompts: string[];
  customPrompts: string[];
  active: boolean;
  lastCheckInMinute?: string;
  createdAt: string;
}

export interface SecuritySettings {
  id: 'security';
  pinHash: string;
  pinSalt: string;
  biometricEnabled: boolean;
  webAuthnCredentialId?: string;
  autoLockOnBackground: boolean;
  updatedAt: string;
}

export type AppTheme = 'dark' | 'light';

export type AppNotificationKind = 'alarm' | 'reminder' | 'calm' | 'birthday';

export type AppNotificationStatus = 'missed' | 'delivered';

export interface AppNotificationItem {
  id: string;
  dedupeKey: string;
  kind: AppNotificationKind;
  status: AppNotificationStatus;
  title: string;
  body: string;
  scheduledAt: string;
  createdAt: string;
  read: boolean;
  route: AppRoute;
}
