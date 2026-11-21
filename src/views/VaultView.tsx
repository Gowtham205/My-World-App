import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileKey2,
  Globe,
  Heart,
  KeyRound,
  Lock,
  Pencil,
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
import { getTodayStr } from '../lib/dateUtils';
import { exportToDevicePublicStorage } from '../lib/nativeAudio';
import { createId } from '../lib/storage';
import { copyText } from '../lib/share';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SecurityGate } from '../components/SecurityGate';

interface VaultViewProps {
  vaultKey: CryptoKey | null;
  encryptedRecords: EncryptedVaultRecord[];
  onUnlock: (key: CryptoKey) => void;
  onLock: () => void;
  onSaveEncrypted: (record: EncryptedVaultRecord) => Promise<void>;
  onDeleteEncrypted: (id: string) => Promise<void>;
  onChangeMasterPin: (currentPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  onResetVault: () => Promise<void>;
}

const ENTRY_TYPES: {
  value: VaultEntryType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
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
  onChangeMasterPin,
  onResetVault,
}) => {
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [decryptError, setDecryptError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<DecryptedVaultItem | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<DecryptedVaultItem | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    ok: boolean;
    message: string;
    path?: string;
  } | null>(null);

  // Update PIN modal/form state
  const [showPinUpdate, setShowPinUpdate] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinUpdateError, setPinUpdateError] = useState('');
  const [pinUpdateSuccess, setPinUpdateSuccess] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

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
  const inlineEditFormRef = useRef<HTMLFormElement | null>(null);

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
        areaSubtitle="Enter your Master PIN or device biometrics to unlock."
        accentColor="lavender"
        onUnlock={onUnlock}
        onResetVault={onResetVault}
      />
    );
  }

  const resetForm = () => {
    setEditingItem(null);
    setEntryType('login');
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

  const openAddForm = () => {
    resetForm();
    setShowAdd((v) => !v);
    setShowPinUpdate(false);
  };

  const openEditForm = (item: DecryptedVaultItem) => {
    setShowAdd(false);
    setEditingItem(item);
    setEntryType(item.type);
    setTitle(item.title);
    setUsername(item.username || '');
    setPassword(item.password || '');
    setUrl(item.url || '');
    setCardNumber(item.cardNumber || '');
    setExpiry(item.expiry || '');
    setCvv(item.cvv || '');
    setPinCode(item.pinCode || '');
    setNotes(item.notes || '');
    setCustomFields(item.customFields ? item.customFields.map((f) => ({ ...f })) : []);
    setShowPinUpdate(false);
    window.setTimeout(() => {
      inlineEditFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
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
      id: editingItem ? editingItem.id : createId('vault'),
      type: entryType,
      labelHint: 'Encrypted',
      iv,
      ciphertext,
      createdAt: editingItem ? editingItem.createdAt : now,
      updatedAt: now,
    };

    await onSaveEncrypted(record);
    resetForm();
    setShowAdd(false);
  };

  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinUpdateError('');
    setPinUpdateSuccess('');

    if (!/^\d{4,6}$/.test(newPin)) {
      setPinUpdateError('New PIN must be 4 to 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinUpdateError('New PIN and confirmation do not match.');
      return;
    }

    setPinBusy(true);
    const result = await onChangeMasterPin(currentPin, newPin);
    setPinBusy(false);

    if (!result.ok) {
      setPinUpdateError(result.error || 'Could not update PIN.');
      return;
    }

    setCurrentPin('');
    setNewPin('');
    setConfirmNewPin('');
    setShowPinUpdate(false);
    setPinUpdateSuccess('Master PIN updated and all Vault records re-encrypted.');
    setTimeout(() => setPinUpdateSuccess(''), 3500);
  };

  const handleCopy = async (val: string, key: string) => {
    const ok = await copyText(val);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { id: createId('cf'), key: '', value: '', secret: false },
    ]);
  };

  const handleDownloadTxt = async () => {
    setExportNotice(null);
    if (items.length === 0) {
      setExportNotice({
        ok: false,
        message: 'No secrets saved yet to export.',
      });
      return;
    }

    const lines: string[] = [
      'My World - Secrets & Passwords Export',
      `Exported At : ${new Date().toLocaleString()}`,
      `Total Items : ${items.length}`,
      '==================================================',
      '',
    ];

    items.forEach((item, index) => {
      const typeLabel = ENTRY_TYPES.find((t) => t.value === item.type)?.label || item.type;
      lines.push(`[${index + 1}] ${item.title}`);
      lines.push(`Type        : ${typeLabel}`);
      if (item.username) lines.push(`Username    : ${item.username}`);
      if (item.password) lines.push(`Password    : ${item.password}`);
      if (item.url) lines.push(`Website URL : ${item.url}`);
      if (item.cardNumber) lines.push(`Card Number : ${item.cardNumber}`);
      if (item.expiry) lines.push(`Expiry      : ${item.expiry}`);
      if (item.cvv) lines.push(`CVV         : ${item.cvv}`);
      if (item.pinCode) lines.push(`PIN         : ${item.pinCode}`);
      if (item.customFields.length > 0) {
        for (const cf of item.customFields) {
          if (cf.key || cf.value) {
            lines.push(`${cf.key || 'Field'} : ${cf.value}`);
          }
        }
      }
      if (item.notes) {
        lines.push(`Notes       : ${item.notes.replace(/\r?\n/g, '\n              ')}`);
      }
      lines.push('--------------------------------------------------');
      lines.push('');
    });

    const filename = `my-world-secrets-${getTodayStr()}.txt`;
    const res = await exportToDevicePublicStorage({
      filename,
      mimeType: 'text/plain;charset=utf-8',
      folderType: 'backup',
      textContent: lines.join('\n'),
    });

    if (res.ok) {
      setExportNotice({
        ok: true,
        message: `Exported ${items.length} ${items.length === 1 ? 'entry' : 'entries'} as .txt.`,
        path: res.displayPath,
      });
    } else {
      setExportNotice({
        ok: false,
        message: res.error || 'Could not download secrets text file.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6]">
            Secrets & Passwords
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Auto-locks automatically whenever you leave or minimize.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadTxt()}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download .txt
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPinUpdate((v) => !v);
              setPinUpdateError('');
              setShowAdd(false);
            }}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#5B4D8A] dark:text-[#BEB4DC] flex items-center gap-2 whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Update PIN
          </button>
          <button
            type="button"
            onClick={onLock}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2] flex items-center gap-2 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock Now
          </button>
          <button
            type="button"
            onClick={openAddForm}
            className="min-h-[44px] px-5 py-2 rounded-2xl bg-[#BEB4DC] hover:bg-[#AFA3D4] text-[#0F1115] text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Secret
          </button>
        </div>
      </header>

      {exportNotice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-xs space-y-1 ${
            exportNotice.ok
              ? 'bg-[#EAF5EE] dark:bg-[#17251F] border-[#9EC5AB]/45 text-[#1F5636] dark:text-[#A9DFBE]'
              : 'bg-[#FDF1EB] dark:bg-[#2A1D1B] border-[#F2B8A2]/45 text-[#A6482D] dark:text-[#F2B8A2]'
          }`}
        >
          <p className="font-semibold">{exportNotice.message}</p>
          {exportNotice.path && (
            <p className="text-[11px] opacity-90">Saved to: {exportNotice.path}</p>
          )}
        </div>
      )}

      {pinUpdateSuccess && (
        <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]" role="status">
          {pinUpdateSuccess}
        </p>
      )}

      {decryptError && (
        <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]" role="alert">
          {decryptError}
        </p>
      )}

      {showPinUpdate && (
        <form
          onSubmit={handlePinChangeSubmit}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#BEB4DC]/30 p-5 sm:p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">Update Master Lock PIN</h2>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
              Applies to both Secrets & Passwords and Private Gallery.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Current PIN"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="New PIN (4–6 digits)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm new PIN"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
            />
          </div>
          {pinUpdateError && (
            <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]" role="alert">
              {pinUpdateError}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowPinUpdate(false);
                setPinUpdateError('');
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pinBusy}
              className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] text-[#0F1115] text-sm font-semibold disabled:opacity-50"
            >
              {pinBusy ? 'Updating...' : 'Save New PIN'}
            </button>
          </div>
        </form>
      )}

      {(() => {
        const renderEntryForm = (isInlineEdit: boolean) => (
          <form
            ref={isInlineEdit ? inlineEditFormRef : undefined}
            onSubmit={handleSaveEntry}
            className={`rounded-3xl bg-white dark:bg-[#171A21] border border-[#BEB4DC]/35 p-5 sm:p-7 space-y-4 ${
              isInlineEdit ? 'md:col-span-2' : ''
            }`}
          >
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
              {editingItem ? 'Edit Secret Entry' : 'Add Secret Entry'}
            </h2>

            <div className="flex flex-wrap gap-1.5">
              {ENTRY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEntryType(t.value)}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    entryType === t.value
                      ? 'bg-[#BEB4DC]/20 text-[#5B4D8A] dark:text-[#BEB4DC] border border-[#BEB4DC]/30'
                      : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#5B6472] dark:text-[#98A2B3]'
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
              className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />

            {entryType === 'login' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or email"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
                />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Website URL (optional)"
                  className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
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
                  className="sm:col-span-3 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
                />
                <input
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="Expiry (MM/YY)"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
                />
                <input
                  type="password"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="CVV / Security Code"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
                />
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="ATM PIN"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
                />
              </div>
            )}

            {entryType === 'pin' && (
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Secret PIN or passcode"
                className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
              />
            )}

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Secret notes, recovery codes, personal relationship notes, or nicknames..."
              className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />

            {/* Custom Key-Value Fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Custom Key-Value Fields</span>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="min-h-[36px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-xs text-[#5B4D8A] dark:text-[#BEB4DC] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09]"
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
                    className="min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
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
                    className="min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
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
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] text-[#0F1115] text-sm font-semibold"
              >
                {editingItem ? 'Update Secret' : 'Encrypt & Save'}
              </button>
            </div>
          </form>
        );

        return (
          <>
            {showAdd && !editingItem && renderEntryForm(false)}

            {items.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
                <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
                  Your encrypted Vault is empty. Store logins, bank cards, PINs, or private notes safely
                  offline.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  if (editingItem && editingItem.id === item.id) {
                    return <React.Fragment key={item.id}>{renderEntryForm(true)}</React.Fragment>;
                  }
                  const revealed = Boolean(revealedIds[item.id]);
                  const typeMeta = ENTRY_TYPES.find((t) => t.value === item.type) || ENTRY_TYPES[0];
                  const Icon = typeMeta.icon;

                  return (
                    <article
                      key={item.id}
                      className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 space-y-3"
                    >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-[#5B4D8A] dark:text-[#BEB4DC]" />
                      <span>{typeMeta.label}</span>
                    </p>
                    <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1 truncate">
                      {item.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      aria-label={`Edit ${item.title}`}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      aria-label={revealed ? 'Hide secret fields' : 'Reveal secret fields'}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#5B4D8A] dark:hover:text-[#BEB4DC] flex items-center justify-center"
                    >
                      {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteItem(item)}
                      aria-label="Delete encrypted entry"
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {item.username && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">Username</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#111827] dark:text-[#F1F3F6] truncate">{item.username}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.username!, `${item.id}-u`)}
                          className="text-[#5B4D8A] dark:text-[#BEB4DC] hover:underline shrink-0"
                        >
                          {copiedKey === `${item.id}-u` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {item.password && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[#111827] dark:text-[#F1F3F6]">
                          {revealed ? item.password : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.password!, `${item.id}-p`)}
                          className="text-[#5B4D8A] dark:text-[#BEB4DC] shrink-0"
                        >
                          {copiedKey === `${item.id}-p` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {item.url && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">Website</span>
                      <span className="text-[#255F8A] dark:text-[#9BC4E2] truncate max-w-[200px]">{item.url}</span>
                    </div>
                  )}

                  {item.cardNumber && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">Card Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-[#111827] dark:text-[#F1F3F6]">
                          {revealed ? item.cardNumber : `•••• ${item.cardNumber.slice(-4)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.cardNumber!, `${item.id}-c`)}
                          className="text-[#5B4D8A] dark:text-[#BEB4DC] shrink-0"
                        >
                          {copiedKey === `${item.id}-c` ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {(item.expiry || item.cvv) && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">Expiry / CVV</span>
                      <span className="font-mono-tabular text-[#111827] dark:text-[#F1F3F6]">
                        {item.expiry || '--/--'} · {revealed ? item.cvv || '---' : '•••'}
                      </span>
                    </div>
                  )}

                  {item.pinCode && (
                    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]">
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">PIN</span>
                      <span className="font-mono-tabular text-[#111827] dark:text-[#F1F3F6]">
                        {revealed ? item.pinCode : '••••'}
                      </span>
                    </div>
                  )}

                  {item.customFields.map((cf) => (
                    <div
                      key={cf.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.06] dark:border-white/[0.05]"
                    >
                      <span className="text-[#5B6472] dark:text-[#98A2B3]">{cf.key}</span>
                      <span className="text-[#111827] dark:text-[#F1F3F6]">
                        {revealed ? cf.value : '••••••'}
                      </span>
                    </div>
                  ))}

                  {item.notes && (
                    <p className="text-xs text-[#334155] dark:text-[#D0D5DD] pt-1 leading-relaxed whitespace-pre-wrap">
                      {revealed ? item.notes : 'Tap the eye icon to reveal protected notes.'}
                    </p>
                  )}
                </div>
                </article>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title="Delete Secret Entry?"
        message={
          pendingDeleteItem
            ? `“${pendingDeleteItem.title}” will be permanently removed from your encrypted Vault.`
            : ''
        }
        onConfirm={async () => {
          if (!pendingDeleteItem) return;
          const id = pendingDeleteItem.id;
          setPendingDeleteItem(null);
          await onDeleteEncrypted(id);
        }}
        onCancel={() => setPendingDeleteItem(null)}
      />
    </div>
  );
};
