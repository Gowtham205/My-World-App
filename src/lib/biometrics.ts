import { Capacitor } from '@capacitor/core';
import {
  AccessControl,
  BiometricAuthError,
  NativeBiometric,
} from '@capgo/capacitor-native-biometric';
import type { SecuritySettings } from '../types/sanctuary';
import {
  decryptPayload,
  deriveVaultKey,
  encryptPayload,
  enrollDeviceBiometric,
  hashPin,
  isPlatformBiometricAvailable,
  verifyDeviceBiometric,
} from './crypto';
import { deleteFromStore, getSetting, putInStore } from './storage';

const BIOMETRIC_SERVER_ID = 'com.myworld.sanctuary';
const BIOMETRIC_USERNAME = 'sanctuary-owner';
const BIOMETRIC_WRAP_SETTING_ID = 'biometric_wrap_key';

interface StoredWrapKeyRecord {
  id: 'biometric_wrap_key';
  key: CryptoKey;
  updatedAt: string;
}

export interface BiometricAvailability {
  available: boolean;
  platform: 'native' | 'web';
  reason?: string;
  needsDeviceEnrollment?: boolean;
}

function mapNativeBiometricError(err: unknown): string {
  const obj = (err || {}) as { code?: number; message?: string };
  switch (obj.code) {
    case BiometricAuthError.BIOMETRICS_NOT_ENROLLED:
      return 'No fingerprint is enrolled on this phone yet. Add one in Android Settings > Security & privacy, then try again.';
    case BiometricAuthError.PASSCODE_NOT_SET:
      return 'Set a screen lock PIN/pattern on this device first to use fingerprint unlock.';
    case BiometricAuthError.USER_CANCEL:
    case BiometricAuthError.SYSTEM_CANCEL:
      return 'Fingerprint prompt cancelled. You can use your Master PIN.';
    case BiometricAuthError.USER_LOCKOUT:
    case BiometricAuthError.USER_TEMPORARY_LOCKOUT:
      return 'Too many fingerprint attempts. Please wait a moment or use your Master PIN.';
    case BiometricAuthError.BIOMETRICS_UNAVAILABLE:
      return 'Fingerprint sensor is unavailable on this device.';
    default:
      return obj.message || 'Fingerprint verification could not be completed. Use your Master PIN.';
  }
}

async function getOrCreateWebWrapKey(): Promise<CryptoKey> {
  const existing = await getSetting<StoredWrapKeyRecord>(BIOMETRIC_WRAP_SETTING_ID);
  if (existing?.key) return existing.key;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable CryptoKey stored directly in IndexedDB
    ['encrypt', 'decrypt']
  );
  await putInStore('settings', {
    id: BIOMETRIC_WRAP_SETTING_ID,
    key,
    updatedAt: new Date().toISOString(),
  } satisfies StoredWrapKeyRecord);
  return key;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable({ useFallback: false });
      if (res.isAvailable) {
        return { available: true, platform: 'native' };
      }
      if (res.errorCode === BiometricAuthError.BIOMETRICS_NOT_ENROLLED) {
        return {
          available: false,
          platform: 'native',
          needsDeviceEnrollment: true,
          reason:
            'No fingerprint is enrolled in Android Settings yet. Add a fingerprint in your phone settings first.',
        };
      }
      return {
        available: false,
        platform: 'native',
        reason: 'Biometric hardware is unavailable on this device.',
      };
    } catch {
      return {
        available: false,
        platform: 'native',
        reason: 'Biometric hardware check failed on this device.',
      };
    }
  }

  const webAvail = await isPlatformBiometricAvailable();
  return {
    available: webAvail,
    platform: 'web',
    reason: webAvail
      ? undefined
      : 'Device biometrics (WebAuthn) are not available in this browser.',
  };
}

export async function enrollFingerprintForPin(
  pin: string,
  settings: SecuritySettings
): Promise<{ ok: boolean; updatedSettings?: SecuritySettings; error?: string }> {
  const candidateHash = await hashPin(pin, settings.pinSalt);
  if (candidateHash !== settings.pinHash) {
    return { ok: false, error: 'Current Master PIN is incorrect.' };
  }

  const avail = await getBiometricAvailability();
  if (!avail.available) {
    return {
      ok: false,
      error: avail.reason || 'Fingerprint unlock is not available on this device.',
    };
  }

  if (Capacitor.isNativePlatform()) {
    try {
      // Prompt fingerprint + protect Master PIN in Android Keystore
      await NativeBiometric.setCredentials({
        server: BIOMETRIC_SERVER_ID,
        username: BIOMETRIC_USERNAME,
        password: pin,
        accessControl: AccessControl.BIOMETRY_ANY,
        title: 'Set Up Fingerprint Unlock',
        negativeButtonText: 'Cancel',
        maxAttempts: 4,
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      // If user explicitly cancelled, abort setup cleanly
      if (
        code === BiometricAuthError.USER_CANCEL ||
        code === BiometricAuthError.SYSTEM_CANCEL ||
        code === BiometricAuthError.AUTHENTICATION_FAILED
      ) {
        return { ok: false, error: mapNativeBiometricError(err) };
      }

      // Some Android emulators / Class 2 sensors support verifyIdentity even when Keystore BIOMETRY_ANY fails.
      // Verify identity live first, then save Keystore-encrypted credential without BIOMETRY_ANY gate.
      try {
        await NativeBiometric.verifyIdentity({
          title: 'Set Up Fingerprint Unlock',
          subtitle: 'Verify your fingerprint to unlock Secrets & Private Gallery',
          negativeButtonText: 'Cancel',
          maxAttempts: 4,
        });
        await NativeBiometric.setCredentials({
          server: BIOMETRIC_SERVER_ID,
          username: BIOMETRIC_USERNAME,
          password: pin,
          accessControl: AccessControl.NONE,
        });
      } catch (fallbackErr) {
        return { ok: false, error: mapNativeBiometricError(fallbackErr) };
      }
    }

    const updated: SecuritySettings = {
      ...settings,
      biometricEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    await putInStore('settings', updated);
    return { ok: true, updatedSettings: updated };
  }

  // Web Browser path: WebAuthn + non-extractable IndexedDB wrapping key
  try {
    const credId = await enrollDeviceBiometric();
    if (!credId) {
      return {
        ok: false,
        error: 'Fingerprint / biometric enrollment was cancelled or not supported here.',
      };
    }

    const wrapKey = await getOrCreateWebWrapKey();
    const { iv, ciphertext } = await encryptPayload({ pin }, wrapKey);

    const updated: SecuritySettings = {
      ...settings,
      biometricEnabled: true,
      webAuthnCredentialId: credId,
      wrappedPinIv: iv,
      wrappedPinCiphertext: ciphertext,
      updatedAt: new Date().toISOString(),
    };
    await putInStore('settings', updated);
    return { ok: true, updatedSettings: updated };
  } catch {
    return {
      ok: false,
      error: 'Could not enroll browser biometrics. Please continue using your Master PIN.',
    };
  }
}

export async function unlockVaultWithFingerprint(
  settings: SecuritySettings
): Promise<{ ok: boolean; key?: CryptoKey; error?: string }> {
  if (!settings.biometricEnabled) {
    return {
      ok: false,
      error: 'Fingerprint unlock is not set up yet. Enter your PIN or enable Fingerprint in Settings.',
    };
  }

  if (Capacitor.isNativePlatform()) {
    let recoveredPin: string | null = null;

    try {
      const creds = await NativeBiometric.getSecureCredentials({
        server: BIOMETRIC_SERVER_ID,
        title: 'Unlock Sanctuary',
        subtitle: 'Verify your fingerprint to unlock',
        negativeButtonText: 'Use PIN',
        maxAttempts: 4,
      });
      recoveredPin = creds.password;
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND) {
        // Check if saved with AccessControl.NONE after verifyIdentity fallback
        try {
          const check = await NativeBiometric.isCredentialsSaved({
            server: BIOMETRIC_SERVER_ID,
          });
          if (!check.isSaved) {
            return {
              ok: false,
              error: 'Saved fingerprint key was cleared. Enter your PIN and re-enable Fingerprint.',
            };
          }
          await NativeBiometric.verifyIdentity({
            title: 'Unlock Sanctuary',
            subtitle: 'Verify your fingerprint to unlock',
            negativeButtonText: 'Use PIN',
            maxAttempts: 4,
          });
          const creds = await NativeBiometric.getCredentials({
            server: BIOMETRIC_SERVER_ID,
          });
          recoveredPin = creds.password;
        } catch (innerErr) {
          return { ok: false, error: mapNativeBiometricError(innerErr) };
        }
      } else {
        return { ok: false, error: mapNativeBiometricError(err) };
      }
    }

    if (!recoveredPin) {
      return { ok: false, error: 'Could not read protected unlock key. Use your Master PIN.' };
    }

    const hash = await hashPin(recoveredPin, settings.pinSalt);
    if (hash !== settings.pinHash) {
      return {
        ok: false,
        error: 'Stored fingerprint key is out of sync with your current PIN. Please re-enable Fingerprint in Settings.',
      };
    }

    const derived = await deriveVaultKey(recoveredPin, settings.pinSalt);
    return { ok: true, key: derived };
  }

  // Web Browser path
  if (!settings.webAuthnCredentialId || !settings.wrappedPinIv || !settings.wrappedPinCiphertext) {
    return {
      ok: false,
      error: 'Fingerprint unlock is not set up on this browser yet. Enter your PIN first.',
    };
  }

  const verified = await verifyDeviceBiometric(settings.webAuthnCredentialId);
  if (!verified) {
    return { ok: false, error: 'Fingerprint prompt cancelled or unavailable. Use your Master PIN.' };
  }

  try {
    const wrapRecord = await getSetting<StoredWrapKeyRecord>(BIOMETRIC_WRAP_SETTING_ID);
    if (!wrapRecord?.key) {
      return {
        ok: false,
        error: 'Device unlock key missing. Enter your PIN and re-enable Fingerprint.',
      };
    }
    const payload = await decryptPayload<{ pin: string }>(
      settings.wrappedPinIv,
      settings.wrappedPinCiphertext,
      wrapRecord.key
    );
    const hash = await hashPin(payload.pin, settings.pinSalt);
    if (hash !== settings.pinHash) {
      return {
        ok: false,
        error: 'Master PIN changed since fingerprint setup. Enter your PIN and re-enable Fingerprint.',
      };
    }
    const derived = await deriveVaultKey(payload.pin, settings.pinSalt);
    return { ok: true, key: derived };
  } catch {
    return { ok: false, error: 'Could not unlock with fingerprint. Enter your Master PIN.' };
  }
}

export async function syncBiometricAfterPinChange(
  newPin: string,
  settings: SecuritySettings
): Promise<SecuritySettings> {
  if (!settings.biometricEnabled) return settings;

  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBiometric.setCredentials({
        server: BIOMETRIC_SERVER_ID,
        username: BIOMETRIC_USERNAME,
        password: newPin,
        accessControl: AccessControl.NONE,
      });
      return settings;
    } catch {
      return { ...settings, biometricEnabled: false };
    }
  }

  try {
    const wrapKey = await getOrCreateWebWrapKey();
    const { iv, ciphertext } = await encryptPayload({ pin: newPin }, wrapKey);
    return {
      ...settings,
      wrappedPinIv: iv,
      wrappedPinCiphertext: ciphertext,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ...settings,
      biometricEnabled: false,
      wrappedPinIv: undefined,
      wrappedPinCiphertext: undefined,
    };
  }
}

export async function disableFingerprintUnlock(
  settings: SecuritySettings
): Promise<SecuritySettings> {
  if (Capacitor.isNativePlatform()) {
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_ID }).catch(() => {});
  } else {
    await deleteFromStore('settings', BIOMETRIC_WRAP_SETTING_ID).catch(() => {});
  }

  const updated: SecuritySettings = {
    ...settings,
    biometricEnabled: false,
    webAuthnCredentialId: undefined,
    wrappedPinIv: undefined,
    wrappedPinCiphertext: undefined,
    updatedAt: new Date().toISOString(),
  };
  await putInStore('settings', updated);
  return updated;
}

export async function clearStoredBiometricData(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_ID }).catch(() => {});
  } else {
    await deleteFromStore('settings', BIOMETRIC_WRAP_SETTING_ID).catch(() => {});
  }
}
