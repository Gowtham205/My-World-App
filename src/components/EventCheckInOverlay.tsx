import React, { useEffect, useState } from 'react';
import { Navigation, Wind, X } from 'lucide-react';
import type { CustomAudioTone, EventCalmSession } from '../types/sanctuary';
import { buildGoogleMapsDirectionsUrl } from '../lib/dateUtils';
import { playNotificationSound } from '../lib/sound';

interface EventCheckInOverlayProps {
  session: EventCalmSession;
  promptMessage: string;
  customAudioTones: CustomAudioTone[];
  notificationSoundId: string;
  onClose: () => void;
}

export const EventCheckInOverlay: React.FC<EventCheckInOverlayProps> = ({
  session,
  promptMessage,
  customAudioTones,
  notificationSoundId,
  onClose,
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phases = [
    { label: 'Inhale slowly', seconds: 4 },
    { label: 'Hold gently', seconds: 3 },
    { label: 'Exhale completely', seconds: 5 },
  ];

  useEffect(() => {
    playNotificationSound(customAudioTones, notificationSoundId);
    const timer = window.setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPhase = phases[phaseIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1115]/95 backdrop-blur-xl flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Event Calm Grounding"
    >
      <div className="max-w-lg w-full bg-[#171A21] border border-white/[0.08] rounded-3xl p-7 sm:p-9 relative text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close grounding screen"
          className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/[0.04] hover:bg-white/[0.09] flex items-center justify-center text-[#98A2B3] hover:text-[#F1F3F6] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 text-xs text-[#9EC5AB] mb-2">
          <Wind className="w-4 h-4" />
          <span>Event Calm Mode · {session.eventName}</span>
        </div>

        {/* Breathing Circle */}
        <div className="relative flex items-center justify-center my-8 h-48">
          <div className="w-40 h-40 rounded-full bg-[#9EC5AB]/10 border border-[#9EC5AB]/30 flex items-center justify-center animate-breathe">
            <div className="w-28 h-28 rounded-full bg-[#9EC5AB]/15 border border-[#9EC5AB]/40 flex flex-col items-center justify-center px-3">
              <span className="text-sm font-medium text-[#F1F3F6]">{currentPhase.label}</span>
              <span className="text-xs text-[#9EC5AB] mt-0.5 tabular-nums">
                {currentPhase.seconds}s cadence
              </span>
            </div>
          </div>
        </div>

        <blockquote className="font-display text-xl sm:text-2xl text-[#F1F3F6] leading-relaxed text-balance px-2">
          “{promptMessage}”
        </blockquote>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          {session.venue.trim() && (
            <a
              href={buildGoogleMapsDirectionsUrl(session.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-[#9BC4E2] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              Navigate to Venue
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold transition-colors whitespace-nowrap"
          >
            I feel grounded
          </button>
        </div>
      </div>
    </div>
  );
};
