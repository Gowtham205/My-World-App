import React, { useEffect, useMemo, useState } from 'react';
import {
  FolderPlus,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { MediaAlbum, PrivateMediaItem } from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  importPrivateMediaFile,
  loadPrivateMediaObjectUrl,
} from '../lib/privateMediaStorage';
import { SecurityGate } from '../components/SecurityGate';

interface GalleryViewProps {
  unlocked: boolean;
  albums: MediaAlbum[];
  mediaItems: PrivateMediaItem[];
  onUnlock: (key: CryptoKey) => void;
  onLock: () => void;
  onSaveAlbum: (album: MediaAlbum) => Promise<void>;
  onSaveMedia: (item: PrivateMediaItem) => Promise<void>;
  onDeleteMedia: (id: string) => Promise<void>;
  onChangeMasterPin: (currentPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>;
  onResetVault: () => Promise<void>;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  unlocked,
  albums,
  mediaItems,
  onUnlock,
  onLock,
  onSaveAlbum,
  onSaveMedia,
  onDeleteMedia,
  onChangeMasterPin,
  onResetVault,
}) => {
  const [activeAlbumId, setActiveAlbumId] = useState<string>('all');
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [viewerItem, setViewerItem] = useState<PrivateMediaItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<PrivateMediaItem | null>(null);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});

  const [importingCount, setImportingCount] = useState(0);
  const [importNotice, setImportNotice] = useState('');

  // Update PIN state
  const [showPinUpdate, setShowPinUpdate] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinUpdateError, setPinUpdateError] = useState('');
  const [pinUpdateSuccess, setPinUpdateSuccess] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    if (!unlocked) {
      setObjectUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const hydrateUrls = async () => {
      const nextUrls: Record<string, string> = {};
      for (const item of mediaItems) {
        if (cancelled) break;
        const resolvedUrl = await loadPrivateMediaObjectUrl(item);
        if (resolvedUrl) {
          if (cancelled) {
            URL.revokeObjectURL(resolvedUrl);
          } else {
            createdUrls.push(resolvedUrl);
            nextUrls[item.id] = resolvedUrl;
          }
        }
      }
      if (!cancelled) {
        setObjectUrls(nextUrls);
      }
    };

    void hydrateUrls();

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [mediaItems, unlocked]);

  const filteredItems = useMemo(() => {
    if (activeAlbumId === 'all') return mediaItems;
    return mediaItems.filter((m) => m.albumId === activeAlbumId);
  }, [mediaItems, activeAlbumId]);

  if (!unlocked) {
    return (
      <SecurityGate
        areaTitle="Private Media Gallery"
        areaSubtitle="Enter your Master PIN or device biometrics to view your private folders."
        accentColor="sky"
        onUnlock={onUnlock}
        onResetVault={onResetVault}
      />
    );
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const pickedFiles = Array.from(files);
    e.target.value = '';

    const targetAlbumId =
      activeAlbumId !== 'all'
        ? activeAlbumId
        : albums[0]?.id || 'album_sanctuary';

    setImportingCount(pickedFiles.length);
    setImportNotice('');

    let imported = 0;
    for (const file of pickedFiles) {
      try {
        const item = await importPrivateMediaFile(file, targetAlbumId);
        await onSaveMedia(item);
        imported += 1;
      } catch {
        // Continue importing remaining items if one fails
      }
    }

    setImportingCount(0);
    if (imported > 0) {
      setImportNotice(
        `Saved ${imported} ${imported === 1 ? 'item' : 'items'} into hidden app-only storage. Removing the original from your phone Gallery keeps this private copy safe.`
      );
      window.setTimeout(() => setImportNotice(''), 6000);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumName.trim()) return;
    const id = createId('album');
    await onSaveAlbum({
      id,
      name: albumName.trim(),
      description: 'Private sandbox folder',
      createdAt: new Date().toISOString(),
    });
    setAlbumName('');
    setShowNewAlbum(false);
    setActiveAlbumId(id);
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
    setPinUpdateSuccess('Master Lock PIN updated.');
    setTimeout(() => setPinUpdateSuccess(''), 3500);
  };

  const confirmDeleteMedia = async () => {
    if (!pendingDeleteItem) return;
    const idToDelete = pendingDeleteItem.id;
    setPendingDeleteItem(null);
    if (viewerItem?.id === idToDelete) {
      setViewerItem(null);
    }
    await onDeleteMedia(idToDelete);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#EDF5FC] via-[#F4F9FE] to-[#F3F1FA] dark:from-[#16222E] dark:via-[#171F2A] dark:to-[#1C1B2B] border border-[#9BC4E2]/40 dark:border-[#9BC4E2]/25 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 shadow-xs">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6]">
            Private Gallery
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Copied to hidden app-only internal storage · Hidden from Albums &amp; stays safe even if you delete the original from your phone · Auto-locks when leaving.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowPinUpdate((v) => !v);
              setPinUpdateError('');
              setShowNewAlbum(false);
            }}
            className="min-h-[44px] px-4 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-2 whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Update PIN
          </button>
          <button
            type="button"
            onClick={onLock}
            className="min-h-[44px] px-4 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2] flex items-center gap-2 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewAlbum((v) => !v);
              setShowPinUpdate(false);
            }}
            className="min-h-[44px] px-4 rounded-2xl bg-white dark:bg-[#171A21] hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] flex items-center gap-2 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2]" />
            New Folder
          </button>
          <label className="min-h-[44px] px-5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Import Media
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {importingCount > 0 && (
        <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2]" role="status">
          Copying {importingCount} {importingCount === 1 ? 'file' : 'files'} into hidden app-only storage...
        </p>
      )}

      {importNotice && (
        <div
          role="status"
          className="rounded-2xl bg-[#E4F2E9] dark:bg-[#1B2C22] border border-[#9EC5AB]/45 px-4 py-3 text-xs text-[#245C3D] dark:text-[#A9DFBE]"
        >
          {importNotice}
        </div>
      )}

      {pinUpdateSuccess && (
        <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]" role="status">
          {pinUpdateSuccess}
        </p>
      )}

      {showPinUpdate && (
        <form
          onSubmit={handlePinChangeSubmit}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/30 p-5 sm:p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">Update Master Lock PIN</h2>
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
              Applies to both Private Gallery and Secrets & Passwords.
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
              className="min-h-[44px] px-5 rounded-2xl bg-[#9BC4E2] text-[#0F1115] text-sm font-semibold disabled:opacity-50"
            >
              {pinBusy ? 'Updating...' : 'Save New PIN'}
            </button>
          </div>
        </form>
      )}

      {showNewAlbum && (
        <form
          onSubmit={handleCreateAlbum}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9BC4E2]/30 p-5 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            required
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            placeholder="Private folder name (e.g. Travel, IDs, Journal)"
            className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
          />
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-2xl bg-[#9BC4E2] text-[#0F1115] text-sm font-semibold whitespace-nowrap"
          >
            Create Folder
          </button>
        </form>
      )}

      {/* Folder Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveAlbumId('all')}
          className={`min-h-[42px] px-4 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeAlbumId === 'all'
              ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2] border border-[#9BC4E2]/30'
              : 'bg-white dark:bg-[#171A21] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.06]'
          }`}
        >
          All Private ({mediaItems.length})
        </button>
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            onClick={() => setActiveAlbumId(album.id)}
            className={`min-h-[42px] px-4 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeAlbumId === album.id
                ? 'bg-[#9BC4E2]/20 text-[#255F8A] dark:text-[#9BC4E2] border border-[#9BC4E2]/30'
                : 'bg-white dark:bg-[#171A21] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.06]'
            }`}
          >
            {album.name}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-[#255F8A] dark:text-[#9BC4E2] mx-auto opacity-70" />
          <p className="text-sm text-[#334155] dark:text-[#D0D5DD]">No private photos or videos in this folder yet.</p>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
            Tap “Import Media” to copy files into your private app folder.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const url = objectUrls[item.id];
            return (
              <div
                key={item.id}
                className="group relative rounded-3xl overflow-hidden bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] aspect-square"
              >
                <button
                  type="button"
                  onClick={() => setViewerItem(item)}
                  className="w-full h-full block focus-visible:outline-2 focus-visible:outline-[#9BC4E2]"
                >
                  {item.kind === 'video' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#ECEFF3] dark:bg-[#1D212A] p-3">
                      <Video className="w-8 h-8 text-[#255F8A] dark:text-[#9BC4E2] mb-2" />
                      <span className="text-xs text-[#334155] dark:text-[#D0D5DD] truncate max-w-full">
                        {item.name}
                      </span>
                    </div>
                  ) : url ? (
                    <img
                      src={url}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#EDF5FC] dark:bg-[#1D212A]">
                      <ImageIcon className="w-6 h-6 text-[#9BC4E2] opacity-75 animate-pulse" />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteItem(item)}
                  aria-label={`Delete ${item.name}`}
                  className="absolute top-2.5 right-2.5 w-10 h-10 rounded-full bg-[#0F1115]/80 text-[#F1F3F6] hover:text-[#F2B8A2] flex items-center justify-center opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Viewer */}
      {viewerItem && objectUrls[viewerItem.id] && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1115]/95 backdrop-blur-xl flex flex-col items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl flex items-center justify-between mb-4 gap-3">
            <p className="text-sm text-[#F1F3F6] truncate">{viewerItem.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPendingDeleteItem(viewerItem)}
                aria-label={`Delete ${viewerItem.name}`}
                className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-[#F2B8A2]/20 flex items-center justify-center text-[#F2B8A2]"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewerItem(null)}
                aria-label="Close viewer"
                className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-[#F1F3F6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="max-h-[78vh] w-full max-w-4xl flex items-center justify-center">
            {viewerItem.kind === 'video' ? (
              <video
                src={objectUrls[viewerItem.id]}
                controls
                autoPlay
                className="max-h-[75vh] max-w-full rounded-2xl"
              />
            ) : (
              <img
                src={objectUrls[viewerItem.id]}
                alt={viewerItem.name}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl"
              />
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteItem && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/60 dark:bg-[#0F1115]/85 backdrop-blur-sm flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm media deletion"
        >
          <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.12] dark:border-white/[0.1] p-6 space-y-4">
            <div className="flex items-center gap-3">
              {pendingDeleteItem.kind === 'image' && objectUrls[pendingDeleteItem.id] ? (
                <img
                  src={objectUrls[pendingDeleteItem.id]}
                  alt={pendingDeleteItem.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-slate-900/[0.10] dark:border-white/[0.08]"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-[#A6482D] dark:text-[#F2B8A2]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Delete from Private Gallery?
                </h2>
                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] truncate mt-0.5">{pendingDeleteItem.name}</p>
              </div>
            </div>

            <p className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
              This private {pendingDeleteItem.kind} will be permanently removed from your app
              storage.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingDeleteItem(null)}
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.06] dark:bg-white/[0.06] hover:bg-slate-900/[0.10] dark:hover:bg-white/[0.1] text-sm font-medium text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteMedia()}
                className="min-h-[44px] px-5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
