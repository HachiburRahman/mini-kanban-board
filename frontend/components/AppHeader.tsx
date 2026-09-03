'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/auth';
import type { AuthUser } from '@/lib/types';
import { Avatar } from './Avatar';

/**
 * Persistent app chrome. Every signed-in page gets the same bar so the
 * "what site is this / where am I" questions are always answerable,
 * including on a phone where there is no room for a sidebar.
 */
export function AppHeader({ crumb }: { crumb?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getStoredUser<AuthUser>());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/boards"
          className="flex min-h-11 items-center gap-2.5 rounded-md text-ink"
          aria-label="Kanban home"
        >
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-accent text-sm font-bold text-white">
            K
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Kanban</span>
        </Link>

        {crumb && (
          <>
            <span aria-hidden="true" className="text-line-strong">
              /
            </span>
            <span className="min-w-0 truncate text-[0.9375rem] font-medium text-ink-soft">
              {crumb}
            </span>
          </>
        )}

        <div className="ml-auto" ref={menuRef}>
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-1 pl-2 hover:bg-sunken sm:pl-3"
              >
                <span className="hidden text-sm font-medium text-ink-soft sm:inline">
                  {user.name}
                </span>
                <Avatar name={user.name} seed={user.id} size={32} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="animate-in absolute right-0 mt-2 w-60 overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)]"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-sm text-ink-faint">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-danger hover:bg-danger-tint"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
