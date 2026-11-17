import React, { useState } from 'react';
import {
  CloudRain,
  Flame,
  Pause,
  Play,
  Radio,
  Square,
  Timer,
  Trees,
  Volume2,
  Waves,
} from 'lucide-react';
import {
  SOUNDSCAPE_TRACKS,
  type SoundscapeId,
  type SoundscapeTrack,
} from '../lib/soundscapes';

interface SoundscapesViewProps {
  activeTracks: Record<SoundscapeId, boolean>;
  trackVolumes: Record<SoundscapeId, number>;
  masterVolume: number;
  timerRemainingSec: number | null;
  onToggleTrack: (id: SoundscapeId) => void;
  onChangeTrackVolume: (id: SoundscapeId, volume: number) => void;
  onChangeMasterVolume: (volume: number) => void;
  onApplyPreset: (preset: Partial<Record<SoundscapeId, number>>) => void;
  onStopAll: () => void;
  onSetTimerMinutes: (minutes: number | null) => void;
}

const PRESETS: {
  name: string;
  description: string;
  mix: Partial<Record<SoundscapeId, number>>;
}[] = [
  {
    name: 'Rain on Pine',
    description: 'Gentle rain blended with misty forest breeze',
    mix: { rain: 0.65, forest: 0.4 },
  },
  {
    name: 'Deep Focus',
    description: 'Brown noise floor with subtle studio pink noise',
    mix: { 'brown-noise': 0.7, 'white-noise': 0.25 },
  },
  {
    name: 'Ocean Twilight',
    description: 'Rolling night waves with light coastal rain',
    mix: { ocean: 0.72, rain: 0.28 },
  },
  {
    name: 'Quiet Fireside',
    description: 'Cozy hearth embers with distant evening rain',
    mix: { hearth: 0.68, rain: 0.32 },
  },
];

function getTrackIcon(id: SoundscapeId) {
  switch (id) {
    case 'rain':
      return CloudRain;
    case 'forest':
      return Trees;
    case 'ocean':
      return Waves;
    case 'hearth':
      return Flame;
    default:
      return Radio;
  }
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SoundscapesView: React.FC<SoundscapesViewProps> = ({
  activeTracks,
  trackVolumes,
  masterVolume,
  timerRemainingSec,
  onToggleTrack,
  onChangeTrackVolume,
  onChangeMasterVolume,
  onApplyPreset,
  onStopAll,
  onSetTimerMinutes,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | SoundscapeTrack['category']>('All');

  const activeIds = (Object.keys(activeTracks) as SoundscapeId[]).filter(
    (id) => activeTracks[id]
  );
  const isAnythingPlaying = activeIds.length > 0;

  const filteredTracks = SOUNDSCAPE_TRACKS.filter(
    (t) => categoryFilter === 'All' || t.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#9EC5AB]">Soundscapes · Web Audio Engine</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Ambient Soundscapes
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1">
            Synthesized locally in real time for calm focus, reading, or unwinding—even completely
            offline.
          </p>
        </div>

        {isAnythingPlaying && (
          <button
            type="button"
            onClick={onStopAll}
            className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#171A21] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-[#F2B8A2] flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Square className="w-3.5 h-3.5" />
            Stop All ({activeIds.length})
          </button>
        )}
      </header>

      {/* Master Mixer & Focus/Sleep Timer Bar */}
      <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#D0D5DD] font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#9EC5AB]" />
              Master Sanctuary Volume
            </span>
            <span className="font-mono-tabular text-[#98A2B3]">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
            aria-label="Master Volume"
            className="w-full accent-[#9EC5AB] cursor-pointer h-2"
          />
        </div>

        <div className="lg:col-span-6 flex flex-wrap items-center justify-between lg:justify-end gap-2">
          <span className="text-xs text-[#98A2B3] flex items-center gap-1.5 mr-1">
            <Timer className="w-3.5 h-3.5 text-[#BEB4DC]" />
            {timerRemainingSec !== null ? (
              <span className="font-mono-tabular text-[#BEB4DC]">
                Stops in {formatCountdown(timerRemainingSec)}
              </span>
            ) : (
              'Session Timer'
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {[null, 15, 30, 45, 60].map((mins) => {
              const isSelected =
                mins === null ? timerRemainingSec === null : false;
              return (
                <button
                  key={mins === null ? 'off' : mins}
                  type="button"
                  onClick={() => onSetTimerMinutes(mins)}
                  className={`min-h-[38px] px-3 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#BEB4DC]/20 text-[#BEB4DC]'
                      : 'bg-[#1D212A] hover:bg-white/[0.08] text-[#98A2B3] hover:text-[#F1F3F6]'
                  }`}
                >
                  {mins === null ? 'Off' : `${mins}m`}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Curated Blends */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#F1F3F6]">Curated Blends</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onApplyPreset(preset.mix)}
              className="text-left rounded-3xl bg-[#171A21] hover:bg-[#1D212A] border border-white/[0.07] p-4 sm:p-5 transition-colors active:scale-[0.99]"
            >
              <p className="text-sm font-semibold text-[#F1F3F6]">{preset.name}</p>
              <p className="text-xs text-[#98A2B3] mt-1 leading-relaxed">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['All', 'Nature', 'Noise', 'Cozy'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[42px] px-4 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat
                ? 'bg-[#9EC5AB]/20 text-[#9EC5AB] border border-[#9EC5AB]/30'
                : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Individual Soundscape Layers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTracks.map((track) => {
          const Icon = getTrackIcon(track.id);
          const playing = Boolean(activeTracks[track.id]);
          const volume = trackVolumes[track.id] ?? 0.6;

          return (
            <article
              key={track.id}
              className={`rounded-3xl bg-[#171A21] border p-5 sm:p-6 flex flex-col justify-between gap-5 transition-colors ${
                playing ? 'border-white/[0.18]' : 'border-white/[0.07]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" style={{ color: track.accentColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#98A2B3]">
                      {track.category}
                      {playing ? ' · Playing' : ''}
                    </p>
                    <h3 className="text-base font-semibold text-[#F1F3F6] mt-0.5 truncate">
                      {track.title}
                    </h3>
                    <p className="text-xs text-[#98A2B3] mt-1 leading-relaxed">
                      {track.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleTrack(track.id)}
                  aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center transition-colors shrink-0"
                  style={{
                    backgroundColor: playing ? track.accentColor : 'rgba(255,255,255,0.06)',
                    color: playing ? '#0F1115' : '#F1F3F6',
                  }}
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-[#98A2B3]">
                  <span>Layer Mix</span>
                  <span className="font-mono-tabular">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => onChangeTrackVolume(track.id, Number(e.target.value))}
                  aria-label={`${track.title} volume`}
                  className="w-full cursor-pointer h-2"
                  style={{ accentColor: track.accentColor }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
