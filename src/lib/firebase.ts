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

export async function signInWithGoogle(): Promise<User> {
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
