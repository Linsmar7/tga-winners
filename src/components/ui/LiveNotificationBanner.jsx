import React from 'react';
import { Award } from 'lucide-react';

export default function LiveNotificationBanner({ banner }) {
  if (!banner) return null;

  const isString = typeof banner === 'string';
  const title = isString ? banner : banner.title;
  const subtitle = isString ? null : banner.subtitle;
  const celebrate = isString ? true : Boolean(banner.celebrate);

  return (
    <div
      className={`fixed right-4 top-16 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
        celebrate
          ? 'border-amber-500/60 bg-zinc-900/95 text-amber-200'
          : 'border-zinc-700 bg-zinc-900/95 text-zinc-100'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-xs font-bold">{title}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-300">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
