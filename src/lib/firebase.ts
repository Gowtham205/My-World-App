import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  preferredName?: string;
  email: string;
  photoUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isEmbeddedMobileWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroidWebView = /; wv\)/i.test(ua) || /\bVersion\/\d+\.\d+.*Chrome\//i.test(ua);
  const isIosWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua);
  const isKnownInAppBrowser = /\b(FBAN|FBAV|Instagram|Line|MicroMessenger|WhatsApp|Snapchat)\b/i.test(ua);
  return isAndroidWebView || isIosWebView || isKnownInAppBrowser;
}

export function isMobileEnvironment(): boolean {
  if (isCapacitorNative() || isEmbeddedMobileWebView()) return true;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) {
      return true;
    }
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
      return true;
    }
  }
  if (typeof window !== 'undefined') {
    const isStandalonePwa =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalonePwa) return true;
    if (window.innerWidth < 768) return true;
    if (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 1024) {
      return true;
    }
  }
  return false;
}

export async function signInWithGoogle(): Promise<User> {
  if (isCapacitorNative()) {
    const err = new Error(
      'Google Sign-In web popups are blocked inside Android APK WebViews. Use Email & Password to sign in.'
    ) as Error & { code?: string };
    err.code = 'auth/native-webview-google-blocked';
    throw err;
  }
  if (isEmbeddedMobileWebView()) {
    const err = new Error(
      'Google Sign-In is blocked inside in-app browsers. Use Email & Password to sign in.'
    ) as Error & { code?: string };
    err.code = 'auth/in-app-webview-blocked';
    throw err;
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = name.trim().slice(0, 100);
  if (cleanName) {
    await updateProfile(result.user, { displayName: cleanName });
  }
  try {
    await sendEmailVerification(result.user);
  } catch {
    // Non-blocking if verification email cannot be sent immediately
  }
  return result.user;
}

export async function sendResetPasswordEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

export async function reloadCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

export async function signOutSanctuary(): Promise<void> {
  await signOut(auth);
}

export async function upsertUserProfile(
  user: User,
  preferredName?: string
): Promise<void> {
  const path = `users/${user.uid}`;
  const docRef = doc(db, 'users', user.uid);

  const safeDisplayName = (
    user.displayName ||
    user.email?.split('@')[0] ||
    'Sanctuary Member'
  )
    .trim()
    .slice(0, 100);
  const safeEmail = (user.email || '').trim().slice(0, 254);
  const safePhoto = user.photoURL ? user.photoURL.trim().slice(0, 500) : undefined;
  const safePreferred =
    preferredName !== undefined ? preferredName.trim().slice(0, 60) : undefined;

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    const createPayload: Record<string, unknown> = {
      uid: user.uid.slice(0, 128),
      displayName: safeDisplayName,
      email: safeEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (safePhoto) createPayload.photoUrl = safePhoto;
    if (safePreferred) createPayload.preferredName = safePreferred;

    try {
      await setDoc(docRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    const updatePayload: Record<string, unknown> = {
      displayName: safeDisplayName,
      email: safeEmail,
      updatedAt: serverTimestamp(),
    };
    if (safePhoto) updatePayload.photoUrl = safePhoto;
    if (safePreferred !== undefined) updatePayload.preferredName = safePreferred;

    try {
      await updateDoc(docRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function saveHealthProfileToFirestore(
  user: User,
  profile: {
    weightKg: number;
    heightCm: number;
    dob: string;
    biologicalSex?: 'male' | 'female' | 'other';
    dietPreference: 'veg' | 'non-veg' | 'both';
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
    dailyStepGoal: number;
    targetWeightKg?: number;
    sunSign?: string;
    birthStar?: string;
    weightReminderDays: number;
    lastWeightLoggedAt: string;
    weightHistory: Array<{ date: string; weightKg: number; note?: string }>;
  }
): Promise<void> {
  const path = `users/${user.uid}/health/profile`;
  const docRef = doc(db, 'users', user.uid, 'health', 'profile');

  const safeWeight = Math.max(20, Math.min(400, Number(profile.weightKg) || 68));
  const safeHeight = Math.max(50, Math.min(260, Number(profile.heightCm) || 168));
  const safeStepGoal = Math.max(500, Math.min(100000, Math.round(Number(profile.dailyStepGoal) || 8000)));
  const safeReminderDays = Math.max(0, Math.min(365, Math.round(Number(profile.weightReminderDays ?? 30))));
  const safeDob = /^\d{4}-\d{2}-\d{2}$/.test(profile.dob) ? profile.dob : '1996-01-01';
  const safeLastLog = /^\d{4}-\d{2}-\d{2}$/.test(profile.lastWeightLoggedAt)
    ? profile.lastWeightLoggedAt
    : new Date().toISOString().slice(0, 10);

  const commonFields: Record<string, unknown> = {
    weightKg: safeWeight,
    heightCm: safeHeight,
    dob: safeDob,
    biologicalSex:
      profile.biologicalSex && ['male', 'female', 'other'].includes(profile.biologicalSex)
        ? profile.biologicalSex
        : 'other',
    dietPreference: profile.dietPreference,
    activityLevel: profile.activityLevel,
    dailyStepGoal: safeStepGoal,
    weightReminderDays: safeReminderDays,
    lastWeightLoggedAt: safeLastLog,
    weightHistory: Array.isArray(profile.weightHistory) ? profile.weightHistory.slice(-60) : [],
    updatedAt: serverTimestamp(),
  };

  if (
    typeof profile.targetWeightKg === 'number' &&
    Number.isFinite(profile.targetWeightKg) &&
    profile.targetWeightKg >= 20 &&
    profile.targetWeightKg <= 400
  ) {
    commonFields.targetWeightKg = profile.targetWeightKg;
  }
  if (typeof profile.sunSign === 'string' && profile.sunSign.trim()) {
    commonFields.sunSign = profile.sunSign.trim().slice(0, 40);
  }
  if (typeof profile.birthStar === 'string' && profile.birthStar.trim()) {
    commonFields.birthStar = profile.birthStar.trim().slice(0, 40);
  }

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        uid: user.uid.slice(0, 128),
        ...commonFields,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(docRef, commonFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function loadHealthProfileFromFirestore(user: User): Promise<{
  id: 'health_profile';
  weightKg: number;
  heightCm: number;
  dob: string;
  biologicalSex?: 'male' | 'female' | 'other';
  dietPreference: 'veg' | 'non-veg' | 'both';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
  dailyStepGoal: number;
  targetWeightKg?: number;
  sunSign?: string;
  birthStar?: string;
  weightReminderDays: number;
  lastWeightLoggedAt: string;
  weightHistory: Array<{ date: string; weightKg: number; note?: string }>;
  updatedAt: string;
  createdAt: string;
} | null> {
  const path = `users/${user.uid}/health/profile`;
  const docRef = doc(db, 'users', user.uid, 'health', 'profile');
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    const toIso = (val: unknown) => {
      if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().toISOString();
      }
      return typeof val === 'string' ? val : new Date().toISOString();
    };
    return {
      id: 'health_profile',
      weightKg: Number(raw.weightKg) || 68,
      heightCm: Number(raw.heightCm) || 168,
      dob: typeof raw.dob === 'string' ? raw.dob : '1996-01-01',
      biologicalSex: (raw.biologicalSex as 'male' | 'female' | 'other' | undefined) || 'other',
      dietPreference: (raw.dietPreference as 'veg' | 'non-veg' | 'both') || 'both',
      activityLevel: (raw.activityLevel as 'sedentary' | 'light' | 'moderate' | 'active') || 'moderate',
      dailyStepGoal: Number(raw.dailyStepGoal) || 8000,
      targetWeightKg: typeof raw.targetWeightKg === 'number' ? raw.targetWeightKg : undefined,
      sunSign: typeof raw.sunSign === 'string' ? raw.sunSign : undefined,
      birthStar: typeof raw.birthStar === 'string' ? raw.birthStar : undefined,
      weightReminderDays: typeof raw.weightReminderDays === 'number' ? raw.weightReminderDays : 30,
      lastWeightLoggedAt:
        typeof raw.lastWeightLoggedAt === 'string'
          ? raw.lastWeightLoggedAt
          : new Date().toISOString().slice(0, 10),
      weightHistory: Array.isArray(raw.weightHistory)
        ? (raw.weightHistory as Array<{ date: string; weightKg: number; note?: string }>)
        : [],
      createdAt: toIso(raw.createdAt),
      updatedAt: toIso(raw.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
