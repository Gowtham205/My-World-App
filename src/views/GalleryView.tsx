import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Image as ImageIcon, Lock, Plus, Trash2, Video, X } from 'lucide-react';
import type { MediaAlbum, PrivateMediaItem } from '../types/sanctuary';
import { createId } from '../lib/storage';
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
}) => {
  const [activeAlbumId, setActiveAlbumId] = useState<string>('all');
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [viewerItem, setViewerItem] = useState<PrivateMediaItem | null>(null);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const item of mediaItems) {
      try {
        urls[item.id] = URL.createObjectURL(item.blob);
      } catch {
        // ignore invalid blob
      }
    }
    setObjectUrls(urls);

    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [mediaItems]);

  const filteredItems = useMemo(() => {
    if (activeAlbumId === 'all') return mediaItems;
    return mediaItems.filter((m) => m.albumId === activeAlbumId);
  }, [mediaItems, activeAlbumId]);

  if (!unlocked) {
    return (
      <SecurityGate
        areaTitle="Private Media Gallery"
        areaSubtitle="Hidden from public gallery views. Authenticate with Fingerprint or Master PIN to view private folders."
        accentColor="sky"
        onUnlock={onUnlock}
      />
    );
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetAlbumId =
      activeAlbumId !== 'all'
        ? activeAlbumId
        : albums[0]?.id || 'album_sanctuary';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const item: PrivateMediaItem = {
        id: createId('media'),
        albumId: targetAlbumId,
        name: file.name,
        mimeType: file.type || 'image/jpeg',
        kind,
        sizeBytes: file.size,
        blob: file,
        createdAt: new Date().toISOString(),
      };
      await onSaveMedia(item);
    }
    e.target.value = '';
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#9BC4E2]">Private Internal Media Storage</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Private Gallery
          </h1>
          <p className="text-xs text-[#98A2B3] mt-1">
            Stored inside private IndexedDB blobs · Auto-locks when minimized.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLock}
            className="min-h-[44px] px-4 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F2B8A2] flex items-center gap-2 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock
          </button>
          <button
            type="button"
            onClick={() => setShowNewAlbum((v) => !v)}
            className="min-h-[44px] px-4 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-[#F1F3F6] flex items-center gap-2 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-[#9BC4E2]" />
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

      {showNewAlbum && (
        <form
          onSubmit={handleCreateAlbum}
          className="rounded-3xl bg-[#171A21] border border-[#9BC4E2]/30 p-5 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            required
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            placeholder="Private folder name (e.g. Travel, IDs, Journal)"
            className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
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
              ? 'bg-[#9BC4E2]/20 text-[#9BC4E2] border border-[#9BC4E2]/30'
              : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06]'
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
                ? 'bg-[#9BC4E2]/20 text-[#9BC4E2] border border-[#9BC4E2]/30'
                : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06]'
            }`}
          >
            {album.name}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-10 text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-[#9BC4E2] mx-auto opacity-70" />
          <p className="text-sm text-[#D0D5DD]">No private photos or videos in this folder yet.</p>
          <p className="text-xs text-[#98A2B3]">
            Tap “Import Media” to copy files into your encrypted app sandbox.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const url = objectUrls[item.id];
            return (
              <div
                key={item.id}
                className="group relative rounded-3xl overflow-hidden bg-[#171A21] border border-white/[0.07] aspect-square"
              >
                <button
                  type="button"
                  onClick={() => setViewerItem(item)}
                  className="w-full h-full block focus-visible:outline-2 focus-visible:outline-[#9BC4E2]"
                >
                  {item.kind === 'video' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#1D212A] p-3">
                      <Video className="w-8 h-8 text-[#9BC4E2] mb-2" />
                      <span className="text-xs text-[#D0D5DD] truncate max-w-full">
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
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMedia(item.id)}
                  aria-label={`Delete ${item.name}`}
                  className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-[#0F1115]/80 text-[#F1F3F6] hover:text-[#F2B8A2] flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
          <div className="w-full max-w-4xl flex items-center justify-between mb-4">
            <p className="text-sm text-[#F1F3F6] truncate">{viewerItem.name}</p>
            <button
              type="button"
              onClick={() => setViewerItem(null)}
              aria-label="Close viewer"
              className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#F1F3F6]"
            >
              <X className="w-5 h-5" />
            </button>
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
    </div>
  );
};
