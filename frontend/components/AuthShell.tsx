import type { ReactNode } from 'react';

/**
 * Shared frame for login/register. Two panes on desktop so the product has
 * a face before you sign in; the pitch pane is dropped below the fold on
 * phones rather than squeezed, so the form is the only thing on screen.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
              K
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Kanban</span>
          </div>

          <h1 className="font-display text-[1.75rem] font-bold sm:text-[2rem]">{title}</h1>
          <p className="mt-2 text-ink-soft">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <p className="mt-6 text-sm text-ink-soft">{footer}</p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-line bg-sunken lg:block">
        <div className="flex h-full flex-col justify-center gap-6 px-12 xl:px-16">
          <p className="font-display text-[1.75rem] leading-snug font-bold tracking-tight text-balance">
            Move work across the board, not across a spreadsheet.
          </p>
          <ul className="space-y-3.5 text-ink-soft">
            <li className="flex gap-3">
              <Tick />
              Columns and cards that stay in the order you left them.
            </li>
            <li className="flex gap-3">
              <Tick />
              Share a board by email, revoke access just as fast.
            </li>
            <li className="flex gap-3">
              <Tick />
              Drag on a laptop, drag on a phone, same board.
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 flex-none text-accent"
      fill="currentColor"
    >
      <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-5.6 5-5-1.2-1.2L9 10 7.2 8.2 6 9.4l3 3Z" />
    </svg>
  );
}
