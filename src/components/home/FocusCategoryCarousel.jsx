import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CategoryCard from '../CategoryCard';

export default function FocusCategoryCarousel({
  categories,
  votesMap,
  disabled,
  onSelectWillWin,
  onSelectWantWin,
  onSelectBoth,
}) {
  const [focusIndex, setFocusIndex] = useState(0);
  const touchStartXRef = useRef(null);

  useEffect(() => {
    if (focusIndex >= categories.length) {
      setFocusIndex(Math.max(0, categories.length - 1));
    }
  }, [categories.length, focusIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') {
        setFocusIndex((i) => Math.min(categories.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setFocusIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [categories.length]);

  const currentCategory = categories[focusIndex];
  if (!currentCategory) return null;

  return (
    <div
      className="space-y-4"
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartXRef.current;
        const endX = e.changedTouches[0]?.clientX ?? null;
        touchStartXRef.current = null;
        if (startX === null || endX === null) return;
        const diff = endX - startX;
        if (diff < -50) {
          setFocusIndex((i) => Math.min(categories.length - 1, i + 1));
        } else if (diff > 50) {
          setFocusIndex((i) => Math.max(0, i - 1));
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <button
          type="button"
          disabled={focusIndex === 0}
          onClick={() => setFocusIndex((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Anterior</span>
        </button>

        <span className="text-xs font-semibold text-zinc-300">
          Categoria <strong className="text-amber-400">{focusIndex + 1}</strong> de{' '}
          {categories.length}
        </span>

        <button
          type="button"
          disabled={focusIndex >= categories.length - 1}
          onClick={() => setFocusIndex((i) => Math.min(categories.length - 1, i + 1))}
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40 disabled:opacity-40"
        >
          <span>Próxima</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <CategoryCard
        category={currentCategory}
        vote={votesMap[currentCategory.id]}
        disabled={disabled}
        onSelectWillWin={onSelectWillWin}
        onSelectWantWin={onSelectWantWin}
        onSelectBoth={onSelectBoth}
      />

      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
        {categories.map((cat, idx) => {
          const v = votesMap[cat.id];
          const isDone = v?.will_win_nominee_id != null && v?.want_win_nominee_id != null;
          const isPart =
            (v?.will_win_nominee_id != null || v?.want_win_nominee_id != null) && !isDone;
          return (
            <button
              key={cat.id}
              type="button"
              title={cat.name}
              onClick={() => setFocusIndex(idx)}
              className={`h-7 min-w-[28px] rounded-lg px-2 text-[11px] font-bold transition ${
                idx === focusIndex
                  ? 'bg-amber-500 text-zinc-950 ring-2 ring-amber-400/50'
                  : isDone
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isPart
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
