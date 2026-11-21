import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/55 dark:bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#181C26] border border-slate-900/[0.12] dark:border-white/[0.12] p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                danger
                  ? 'bg-[#F2B8A2]/25 text-[#A6482D] dark:text-[#F2B8A2]'
                  : 'bg-[#9BC4E2]/25 text-[#255F8A] dark:text-[#9BC4E2]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]"
              >
                {title}
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Close confirmation"
            className="min-w-[36px] min-h-[36px] -mt-1 -mr-1 rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#232836] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-sm font-medium text-[#334155] dark:text-[#D0D5DD]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`min-h-[44px] px-5 rounded-2xl text-sm font-semibold disabled:opacity-50 ${
              danger
                ? 'bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115]'
                : 'bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115]'
            }`}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
