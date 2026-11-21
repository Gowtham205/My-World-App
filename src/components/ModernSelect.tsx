import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface ModernSelectOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
  colorDot?: string;
  accentAction?: boolean;
}

export type SanctuaryAccent = 'sage' | 'lavender' | 'peach' | 'sky';

interface ModernSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ModernSelectOption[];
  placeholder?: string;
  title?: string;
  prefixLabel?: string;
  icon?: React.ReactNode;
  accent?: SanctuaryAccent;
  disabled?: boolean;
  searchable?: boolean;
  triggerClassName?: string;
  ariaLabel?: string;
}

const ACCENT_MAP: Record<
  SanctuaryAccent,
  { activeBg: string; activeText: string; activeBorder: string; ringFocus: string }
> = {
  sage: {
    activeBg: 'bg-[#9EC5AB]/20 dark:bg-[#9EC5AB]/16',
    activeText: 'text-[#1F5636] dark:text-[#A9DFBE]',
    activeBorder: 'border-[#9EC5AB]/55',
    ringFocus: 'focus-visible:border-[#9EC5AB]/60',
  },
  lavender: {
    activeBg: 'bg-[#BEB4DC]/22 dark:bg-[#BEB4DC]/18',
    activeText: 'text-[#4B3D78] dark:text-[#D5CCF2]',
    activeBorder: 'border-[#BEB4DC]/55',
    ringFocus: 'focus-visible:border-[#BEB4DC]/65',
  },
  peach: {
    activeBg: 'bg-[#F2B8A2]/22 dark:bg-[#F2B8A2]/16',
    activeText: 'text-[#9A3E24] dark:text-[#F5C1AD]',
    activeBorder: 'border-[#F2B8A2]/55',
    ringFocus: 'focus-visible:border-[#F2B8A2]/65',
  },
  sky: {
    activeBg: 'bg-[#9BC4E2]/22 dark:bg-[#9BC4E2]/16',
    activeText: 'text-[#1E567F] dark:text-[#B4D6F0]',
    activeBorder: 'border-[#9BC4E2]/55',
    ringFocus: 'focus-visible:border-[#9BC4E2]/65',
  },
};

export const ModernSelect: React.FC<ModernSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  title = 'Choose an option',
  prefixLabel,
  icon,
  accent = 'sky',
  disabled = false,
  searchable,
  triggerClassName = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [anchorRect, setAnchorRect] = useState<{
    top: number;
    left: number;
    width: number;
    openUpward: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const styles = ACCENT_MAP[accent];
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const shouldShowSearch = searchable ?? options.length >= 8;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.group && o.group.toLowerCase().includes(q))
    );
  }, [options, query]);

  const groupedSections = useMemo(() => {
    const sections: { group: string | null; items: ModernSelectOption[] }[] = [];
    const seen = new Map<string, number>();

    for (const item of filteredOptions) {
      const gKey = item.group || '';
      if (!seen.has(gKey)) {
        seen.set(gKey, sections.length);
        sections.push({ group: item.group || null, items: [item] });
      } else {
        sections[seen.get(gKey)!].items.push(item);
      }
    }
    return sections;
  }, [filteredOptions]);

  const updatePosition = () => {
    if (typeof window === 'undefined' || !triggerRef.current) return;
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);
    if (mobile) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedPanelHeight = Math.min(360, options.length * 48 + 70);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedPanelHeight && rect.top > spaceBelow;
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

    setAnchorRect({
      top: openUpward ? rect.top - 8 : rect.bottom + 8,
      left,
      width,
      openUpward,
    });
  };

  useEffect(() => {
    if (!open) return;
    setQuery('');
    updatePosition();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onOutsidePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onResizeOrScroll = () => updatePosition();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onOutsidePointer);
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);

    if (shouldShowSearch && !isMobile) {
      window.setTimeout(() => searchInputRef.current?.focus(), 40);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onOutsidePointer);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, shouldShowSearch, isMobile]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
  };

  const renderOptionsList = () => (
    <div className="overflow-y-auto overscroll-contain max-h-[52dvh] sm:max-h-[300px] p-1.5 space-y-2">
      {groupedSections.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-[#5B6472] dark:text-[#98A2B3]">
          No matching options found.
        </p>
      ) : (
        groupedSections.map((sec, sIdx) => (
          <div key={sec.group ?? `sec-${sIdx}`} className="space-y-0.5">
            {sec.group && (
              <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-[#5B6472] dark:text-[#98A2B3]">
                {sec.group}
              </p>
            )}
            {sec.items.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-2xl text-left flex items-center justify-between gap-2.5 transition-colors ${
                    isSelected
                      ? `${styles.activeBg} ${styles.activeText} font-semibold`
                      : opt.accentAction
                        ? 'text-[#255F8A] dark:text-[#9BC4E2] hover:bg-[#9BC4E2]/12 font-medium'
                        : 'text-[#111827] dark:text-[#F1F3F6] hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {opt.colorDot && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-slate-900/15 dark:border-white/20"
                        style={{ backgroundColor: opt.colorDot }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm leading-snug truncate">{opt.label}</p>
                      {opt.description && (
                        <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] truncate mt-0.5">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || title}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={`w-full min-h-[44px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] hover:border-slate-900/[0.20] dark:hover:border-white/[0.16] text-left flex items-center justify-between gap-2 transition-all focus:outline-none ${styles.ringFocus} disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? `${styles.activeBorder} shadow-xs` : ''
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-[#5B6472] dark:text-[#98A2B3]">{icon}</span>}
          {selectedOption?.colorDot && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-900/15 dark:border-white/20"
              style={{ backgroundColor: selectedOption.colorDot }}
            />
          )}
          <span
            className={`text-sm truncate ${
              selectedOption
                ? 'text-[#111827] dark:text-[#F1F3F6]'
                : 'text-[#5B6472] dark:text-[#98A2B3]'
            }`}
          >
            {selectedOption
              ? prefixLabel
                ? `${prefixLabel}: ${selectedOption.label}`
                : selectedOption.label
              : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          isMobile ? (
            <div
              className="fixed inset-0 z-[75] flex items-end bg-black/45 dark:bg-black/65 backdrop-blur-sm animate-backdrop-in"
              onClick={() => setOpen(false)}
            >
              <div
                ref={panelRef}
                role="listbox"
                aria-label={ariaLabel || title}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-t-3xl bg-white dark:bg-[#181C26] border-t border-slate-900/[0.10] dark:border-white/[0.10] shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] animate-sheet-up"
              >
                <div className="pt-3 pb-1 flex justify-center">
                  <span className="w-10 h-1.5 rounded-full bg-slate-900/15 dark:bg-white/20" />
                </div>
                <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-900/[0.07] dark:border-white/[0.07]">
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    {title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close selector"
                    className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {shouldShowSearch && (
                  <div className="px-3 pt-2.5 pb-1">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={searchInputRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search options..."
                        className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="px-2 pt-1">{renderOptionsList()}</div>
              </div>
            </div>
          ) : (
            anchorRect && (
              <div
                ref={panelRef}
                role="listbox"
                aria-label={ariaLabel || title}
                style={{
                  position: 'fixed',
                  left: anchorRect.left,
                  width: anchorRect.width,
                  ...(anchorRect.openUpward
                    ? { bottom: window.innerHeight - anchorRect.top }
                    : { top: anchorRect.top }),
                }}
                className="z-[75] rounded-2xl bg-white/98 dark:bg-[#1A1F2B]/98 backdrop-blur-md border border-slate-900/[0.10] dark:border-white/[0.12] shadow-xl animate-popover-in overflow-hidden"
              >
                {shouldShowSearch && (
                  <div className="p-2 border-b border-slate-900/[0.07] dark:border-white/[0.07]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#5B6472] dark:text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={searchInputRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter..."
                        className="w-full min-h-[36px] pl-8 pr-2.5 rounded-xl bg-[#ECEFF3] dark:bg-[#131722] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                {renderOptionsList()}
              </div>
            )
          ),
          document.body
        )}
    </>
  );
};
