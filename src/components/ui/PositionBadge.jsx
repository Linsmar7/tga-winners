import React from 'react';

export default function PositionBadge({ position, size = 'md' }) {
  const sizeClass =
    size === 'sm' ? 'h-6 w-6 rounded-md text-xs' : 'h-7 w-7 rounded-lg text-xs';

  const colorClass =
    position === 1
      ? 'bg-amber-500 text-zinc-950'
      : position === 2
        ? 'bg-zinc-300 text-zinc-950'
        : position === 3
          ? 'bg-amber-700 text-zinc-100'
          : 'bg-zinc-800 text-zinc-400';

  return (
    <span
      className={`flex shrink-0 items-center justify-center font-bold ${sizeClass} ${colorClass}`}
    >
      {position}
    </span>
  );
}
