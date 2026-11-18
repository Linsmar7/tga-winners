import React from 'react';
import { X } from 'lucide-react';
import { useModalBehavior } from '../../lib/useModalBehavior';

/**
 * Shell padronizado para modais (fecha com Esc, clique no backdrop, trava scroll do body).
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  headerActions,
  footer,
  maxWidth = 'max-w-2xl',
  bodyClassName = 'p-4 sm:p-5',
  children,
}) {
  useModalBehavior(Boolean(open), onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-zinc-100 sm:text-base">{title}</h3>
              {subtitle && <div className="mt-0.5 text-xs text-zinc-400">{subtitle}</div>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
