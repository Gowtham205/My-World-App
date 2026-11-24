import React, { useMemo, useState } from 'react';
import { AlarmClock, Bell, Cake, CheckCheck, Clock, HeartPulse, Trash2, Wind, X } from 'lucide-react';
import type { AppNotificationItem, AppNotificationKind, AppRoute } from '../types/sanctuary';
import { ConfirmDialog } from './ConfirmDialog';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: AppNotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismissItem: (id: string) => void;
  onClearAll: () => void;
  onNavigate: (route: AppRoute) => void;
}

const KIND_LABELS: Record<AppNotificationKind, string> = {
  alarm: 'Alarm',
  reminder: 'Task Reminder',
  calm: 'Event Calm',
  birthday: 'Birthday',
  health: 'Health Monitor',
};

function formatNotificationTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  const sameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();

  const timePart = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${timePart}`;

  const datePart = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${datePart} · ${timePart}`;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismissItem,
  onClearAll,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | 'missed' | 'unread'>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filtered = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const aTime = new Date(a.scheduledAt || a.createdAt).getTime();
      const bTime = new Date(b.scheduledAt || b.createdAt).getTime();
      return bTime - aTime;
    });
    if (filter === 'missed') return sorted.filter((n) => n.status === 'missed');
    if (filter === 'unread') return sorted.filter((n) => !n.read);
    return sorted;
  }, [notifications, filter]);

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const missedCount = notifications.filter((n) => n.status === 'missed').length;

  const renderIcon = (kind: AppNotificationKind) => {
    switch (kind) {
      case 'alarm':
        return <AlarmClock className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2]" />;
      case 'calm':
        return <Wind className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2]" />;
      case 'birthday':
        return <Cake className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />;
      case 'health':
        return <HeartPulse className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />;
      default:
        return <Clock className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 dark:bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-md h-full bg-gradient-to-b from-[#F4F8F5] via-[#FAF8FC] to-[#F7F9FC] dark:from-[#151A25] dark:via-[#141722] dark:to-[#12151E] border-l border-[#9EC5AB]/30 dark:border-[#9EC5AB]/20 flex flex-col shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-slate-900/[0.08] dark:border-white/[0.07] bg-white/55 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E4F2E9] dark:bg-[#1D2D24] border border-[#9EC5AB]/35 flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-[#111827] dark:text-[#F1F3F6]">
                Notifications
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                {missedCount > 0 ? ` · ${missedCount} missed while away` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Notifications"
            className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/75 dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.08] dark:border-white/[0.08] text-[#334155] dark:text-[#D0D5DD] flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar + Actions */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-900/[0.06] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/65 dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06]">
            {(['all', 'missed', 'unread'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-[#E4F2E9] dark:bg-[#23322A] text-[#245C3D] dark:text-[#A9DFBE] shadow-xs'
                    : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                title="Mark all as read"
                className="min-h-[36px] px-2.5 rounded-xl hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB] inline-flex items-center gap-1 whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Read all
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                title="Clear all notifications"
                aria-label="Clear all notifications"
                className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-3xl bg-white/75 dark:bg-[#191E2A]/85 border border-slate-900/[0.07] dark:border-white/[0.07] p-8 text-center">
              <Bell className="w-7 h-7 text-[#5B6472] dark:text-[#98A2B3] mx-auto mb-3 opacity-60" />
              <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6]">
                {filter === 'all' ? 'No missed or recent alerts' : `No ${filter} notifications`}
              </p>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1 leading-relaxed">
                Missed alarms, overdue reminders, Event Calm prompts, and today’s birthdays will
                appear here whenever you open the app.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  item.read
                    ? 'bg-white/60 dark:bg-[#191E2A]/65 border-slate-900/[0.07] dark:border-white/[0.06]'
                    : 'bg-gradient-to-br from-[#F4FAF6] to-[#FFFFFF] dark:from-[#1B242B] dark:to-[#181C26] border-[#9EC5AB]/45 dark:border-[#9EC5AB]/30 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onMarkRead(item.id);
                      onClose();
                      onNavigate(item.route);
                    }}
                    className="flex items-start gap-3 text-left min-w-0 flex-1"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/85 dark:bg-[#232938] border border-slate-900/[0.06] dark:border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      {renderIcon(item.kind)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                        <span
                          className={
                            item.status === 'missed'
                              ? 'font-medium text-[#A6482D] dark:text-[#F2B8A2]'
                              : 'font-medium text-[#2E6B48] dark:text-[#9EC5AB]'
                          }
                        >
                          {item.status === 'missed' ? 'Missed' : 'Delivered'}
                        </span>{' '}
                        · {KIND_LABELS[item.kind]} ·{' '}
                        <span className="font-mono-tabular">
                          {formatNotificationTime(item.scheduledAt || item.createdAt)}
                        </span>
                      </p>
                      <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
                        {item.title}
                      </p>
                      {item.body && (
                        <p
                          className={`text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1 leading-relaxed ${
                            item.kind === 'calm' ? 'whitespace-pre-line' : 'line-clamp-2'
                          }`}
                        >
                          {item.body}
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDismissItem(item.id)}
                    aria-label="Dismiss notification"
                    className="min-w-[36px] min-h-[36px] -mt-1 -mr-1 rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.07] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6] flex items-center justify-center shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] bg-white/45 dark:bg-white/[0.02] shrink-0">
          <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] leading-relaxed">
            Missed alarms &amp; reminders stay in this Bell inbox without cluttering your phone
            drawer. Birthdays send gentle reminders directly to your phone drawer.
          </p>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear All Notifications?"
        message="Are you sure you want to clear all notifications from your Bell inbox?"
        confirmLabel="Clear All"
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClearAll();
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
};
