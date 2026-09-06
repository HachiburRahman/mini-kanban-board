'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Small "..." dropdown used by the board header and each column header.
 *
 * Deliberately plain: a real <button> per item, Escape and outside-click both
 * close it, and focus returns to the trigger afterwards so a keyboard user is
 * never dropped at the top of the document.
 */
export function Menu({
  label,
  items,
  align = 'right',
  trigger,
}: {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 flex-none place-items-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
      >
        {trigger ?? (
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="currentColor">
            <circle cx="4" cy="10" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="16" cy="10" r="1.6" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={[
            'animate-in absolute z-40 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={[
                'flex min-h-10 w-full items-center px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40',
                item.danger
                  ? 'text-danger hover:bg-danger-tint'
                  : 'text-ink hover:bg-sunken disabled:hover:bg-transparent',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
