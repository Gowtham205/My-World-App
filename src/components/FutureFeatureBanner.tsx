import React from 'react';
import { Clock } from 'lucide-react';

interface FutureFeatureBannerProps {
  title: string;
  description: string;
  note?: string;
}

export const FutureFeatureBanner: React.FC<FutureFeatureBannerProps> = ({
  title,
  description,
  note,
}) => {
  return (
    <div
      role="status"
      className="rounded-3xl bg-gradient-to-br from-[#FCF5E6] via-[#FFFBF2] to-[#FFFFFF] dark:from-[#262015] dark:via-[#1E1B16] dark:to-[#171A21] border border-[#EDD59E]/60 dark:border-[#EDD59E]/30 p-5 sm:p-6 flex items-start gap-3.5 shadow-xs"
    >
      <div className="w-10 h-10 rounded-2xl bg-[#EDD59E]/45 dark:bg-[#EDD59E]/20 border border-[#EDD59E]/65 dark:border-[#EDD59E]/35 flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-[#8A5A12] dark:text-[#EDD59E]" />
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8A5A12] dark:text-[#EDD59E]">
            Coming in Future Updates
          </span>
        </div>
        <h2 className="text-sm sm:text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
          {description}
        </p>
        {note && (
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] leading-relaxed pt-0.5">
            {note}
          </p>
        )}
      </div>
    </div>
  );
};
