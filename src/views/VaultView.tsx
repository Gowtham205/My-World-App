import React, { useEffect, useState } from 'react';
import {
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileKey2,
  Globe,
  Heart,
  KeyRound,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  DecryptedVaultItem,
  EncryptedVaultRecord,
  VaultCustomField,
  VaultEntryType,
  VaultSecretPayload,
} from '../types/sanctuary';
import { decryptPayload, encryptPayload } from '../lib/crypto';
import { createId } from '../lib/storage';
import { SecurityGate } from '../components/SecurityGate';

interface VaultViewProps {
  vaultKey: CryptoKey | null;
  encryptedRecords: EncryptedVaultRecord[];
  onUnlock: (key: CryptoKey) => void;
  onLock: () => void;
  onSaveEncrypted: (record: EncryptedVaultRecord) => Promise<void>;
  onDeleteEncrypted: (id: string) => Promise<void>;
}

const ENTRY_TYPES: { value: VaultEntryType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'login', label: 'Website Login', icon: Globe },
  { value: 'secret_note', label: 'Secret Note', icon: FileKey2 },
  { value: 'bank_card', label: 'Bank / Card', icon: CreditCard },
  { value: 'pin', label: 'PIN Code', icon: KeyRound },
  { value: 'relationship', label: 'Relationship Note', icon: Heart },
  { value: 'custom', label: 'Custom Fields', icon: Lock },
];

export const VaultView: React.FC<VaultViewProps> = ({
  vaultKey,
  encryptedRecords,
  onUnlock,
  onLock,
  onSaveEncrypted,
  onDeleteEncrypted,
}) => {
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [decryptError, setDecryptError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state
  const [entryType, setEntryType] = useState<VaultEntryType>('login');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<VaultCustomField[]>([]);

  useEffect(() => {
    let active = true;
    async function decryptAll() {
      if (!vaultKey) {
        setItems([]);
        return;
      }
      setDecryptError('');
      const decryptedList: DecryptedVaultItem[] = [];
      let hadError = false;
      for (const rec of encryptedRecords) {
        try {
          const payload = await decryptPayload<VaultSecretPayload>(
            rec.iv,
            rec.ciphertext,
            vaultKey
          );
          decryptedList.push({
            ...payload,
            id: rec.id,
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
          });
        } catch {
          hadError = true;
        }
      }
      if (!active) return;
      if (hadError && decryptedList.length === 0 && encryptedRecords.length > 0) {
        setDecryptError('Some vault entries could not be decrypted with the current PIN.');
      }
      setItems(decryptedList);
    }
    decryptAll();
    return () => {
      active = false;
    };
  }, [vaultKey, encryptedRecords]);

  if (!vaultKey) {
    return (
      <SecurityGate
        areaTitle="Secrets & Passwords Vault"
        areaSubtitle="Hardware biometric or Master PIN required. Everything inside is encrypted with AES-256-GCM."
        accentColor="lavender"
        onUnlock={onUnlock}
      />
    );
  }

  const resetForm = () => {
    setTitle('');
    setUsername('');
    setPassword('');
    setUrl('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setPinCode('');
    setNotes('');
    setCustomFields([]);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload: VaultSecretPayload = {
      title: title.trim(),
      type: entryType,
      username: username.trim() || undefined,
      password: password || undefined,
      url: url.trim() || undefined,
      cardNumber: cardNumber.trim() || undefined,
      expiry: expiry.trim() || undefined,
      cvv: cvv.trim() || undefined,
      pinCode: pinCode.trim() || undefined,
      notes: notes.trim() || undefined,
      customFields: customFields.filter((f) => f.key.trim() || f.value.trim()),
    };

    const { iv, ciphertext } = await encryptPayload(payload, vaultKey);
    const now = new Date().toISOString();
    const record: EncryptedVaultRecord = {
      id: createId('vault'),
      type: entryType,
      labelHint: 'Encrypted',
      iv,
      ciphertext,
      createdAt: now,
      updatedAt: now,
    };

    await onSaveEncrypted(record);
    resetForm();
    setShowAdd(false);
  };

  const handleCopy = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore clipboard permissions
    }
  };

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { id: createId('cf'), key: '', value: '', secret: false },
    ]);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#BEB4DC]">AES-256-GCM Encrypted Vault</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Secrets & Passwords
          </h1>
          <p className="text-xs text-[#98A2B3] mt-1">
            Auto-locks immediately whenever you minimize or switch away.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onLock}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F2B8A2] flex items-center gap-2 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock Now
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Secret
          </button>
        </div>
      </header>

      {decryptError && (
        <p className="text-xs text-[#F2B8A2]" role="alert">
          {decryptError}
        </p>
      )}

      {showAdd && (
        <form
          onSubmit={handleSaveEntry}
          className="rounded-3xl bg-[#171A21] border border-[#BEB4DC]/30 p-5 sm:p-7 space-y-4"
        >
          <div className="flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setEntryType(t.value)}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                  entryType === t.value
                    ? 'bg-[#BEB4DC]/20 text-[#BEB4DC] border border-[#BEB4DC]/30'
                    : 'bg-[#1D212A] text-[#98A2B3]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title (e.g. Primary Bank, Home Wi-Fi, Private Journal)"
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          {entryType === 'login' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email"
                className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Website URL (optional)"
                className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
            </div>
          )}

          {entryType === 'bank_card' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Card / Account number"
                className="sm:col-span-3 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
              />
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="Expiry (MM/YY)"
                className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
              />
              <input
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder="CVV / Security Code"
                className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
              />
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="ATM PIN"
                className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
              />
            </div>
          )}

          {entryType === 'pin' && (
            <input
              type="password"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="Secret PIN or passcode"
              className="w-full min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
            />
          )}

          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Secret notes, recovery codes, personal relationship notes, or nicknames..."
            className="w-full p-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          {/* Custom Key-Value Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#98A2B3]">Custom Key-Value Fields</span>
              <button
                type="button"
                onClick={addCustomField}
                className="min-h-[36px] px-3 rounded-xl bg-white/[0.05] text-xs text-[#BEB4DC] hover:bg-white/[0.09]"
              >
                + Add Field
              </button>
            </div>
            {customFields.map((field) => (
              <div key={field.id} className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((f) => (f.id === field.id ? { ...f, key: e.target.value } : f))
                    )
                  }
                  placeholder="Field label"
                  className="min-h-[40px] px-3 rounded-xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6]"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((f) => (f.id === field.id ? { ...f, value: e.target.value } : f))
                    )
                  }
                  placeholder="Value"
                  className="min-h-[40px] px-3 rounded-xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6]"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] text-[#0F1115] text-sm font-semibold"
            >
              Encrypt & Save
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#98A2B3]">
            Your encrypted Vault is empty. Store logins, bank cards, PINs, or private notes safely
            offline.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const revealed = Boolean(revealedIds[item.id]);
            const typeMeta = ENTRY_TYPES.find((t) => t.value === item.type) || ENTRY_TYPES[0];
            const Icon = typeMeta.icon;

            return (
              <article
                key={item.id}
                className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#98A2B3] flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-[#BEB4DC]" />
                      <span>{typeMeta.label}</span>
                    </p>
                    <h2 className="text-base font-semibold text-[#F1F3F6] mt-1 truncate">
                      {item.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      aria-label={revealed ? 'Hide secret fields' : 'Reveal secret fields'}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#BEB4DC] flex items-center justify-center"
                    >
                      {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEncrypted(item.id)}
                      aria-label="Delete encrypted entry"
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {item.username && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]">
                      <span className="text-[#98A2B3]">Username</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#F1F3F6] truncate">{item.username}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.username!, `${item.id}-u`)}
                          className="text-[#BEB4DC] hover:underline shrink-0"
                        >
                          {copiedKey === `${item.id}-u` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {item.password && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]">
                      <span className="text-[#98A2B3]">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[#F1F3F6]">
                          {revealed ? item.password : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.password!, `${item.id}-p`)}
                          className="text-[#BEB4DC] shrink-0"
                        >
                          {copiedKey === `${item.id}-p` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {item.cardNumber && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]">
                      <span className="text-[#98A2B3]">Card Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[#F1F3F6]">
                          {revealed ? item.cardNumber : `•••• ${item.cardNumber.slice(-4)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.cardNumber!, `${item.id}-c`)}
                          className="text-[#BEB4DC] shrink-0"
                        >
                          {copiedKey === `${item.id}-c` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {(item.expiry || item.cvv) && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]">
                      <span className="text-[#98A2B3]">Expiry / CVV</span>
                      <span className="font-mono-tabular text-[#F1F3F6]">
                        {item.expiry || '--/--'} · {revealed ? item.cvv || '---' : '•••'}
                      </span>
                    </div>
                  )}

                  {item.pinCode && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]">
                      <span className="text-[#98A2B3]">PIN</span>
                      <span className="font-mono-tabular text-[#F1F3F6]">
                        {revealed ? item.pinCode : '••••'}
                      </span>
                    </div>
                  )}

                  {item.customFields.map((cf) => (
                    <div
                      key={cf.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.05]"
                    >
                      <span className="text-[#98A2B3]">{cf.key}</span>
                      <span className="text-[#F1F3F6]">
                        {revealed ? cf.value : '••••••'}
                      </span>
                    </div>
                  ))}

                  {item.notes && (
                    <p className="text-xs text-[#D0D5DD] pt-1 leading-relaxed whitespace-pre-wrap">
                      {revealed ? item.notes : 'Tap the eye icon to reveal protected notes.'}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
