// Local-first Web Crypto API module for AES-256-GCM Vault encryption & Master PIN hashing

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltBase64}:${pin}:my-world-sanctuary`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64(new Uint8Array(digest));
}

export async function deriveVaultKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBytes = fromBase64(saltBase64);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload<T>(
  payload: T,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  );
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptPayload<T>(
  ivBase64: string,
  ciphertextBase64: string,
  key: CryptoKey
): Promise<T> {
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted)) as T;
}

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

export async function enrollDeviceBiometric(): Promise<string | null> {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return null;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'My World Sanctuary' },
        user: {
          id: userId,
          name: 'local-owner',
          displayName: 'Sanctuary Owner',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 45000,
      },
    })) as PublicKeyCredential | null;

    if (!cred) return null;
    return toBase64(new Uint8Array(cred.rawId));
  } catch {
    return null;
  }
}

export async function verifyDeviceBiometric(credentialIdBase64: string): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const rawId = fromBase64(credentialIdBase64);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: rawId.buffer as ArrayBuffer,
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 45000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}
