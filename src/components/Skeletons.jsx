import React from 'react';

export function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="h-7 w-44 rounded-lg bg-zinc-800" />
            <div className="h-4 w-72 rounded-md bg-zinc-800/70" />
          </div>
          <div className="h-9 w-52 rounded-xl bg-zinc-800" />
        </div>
      </div>

      {[1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80"
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-zinc-800" />
              <div className="h-5 w-48 rounded-md bg-zinc-800" />
            </div>
            <div className="h-5 w-16 rounded-full bg-zinc-800/80" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((c) => (
              <div
                key={c}
                className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg bg-zinc-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-zinc-800" />
                    <div className="h-3 w-1/2 rounded bg-zinc-800/60" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 rounded-lg bg-zinc-800/70" />
                  <div className="h-8 rounded-lg bg-zinc-800/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RankingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-zinc-800" />
          <div className="h-3.5 w-36 rounded bg-zinc-800/70" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-zinc-800" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
          >
            <div className="h-12 w-12 rounded-xl bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-zinc-800/70" />
              <div className="h-4 w-44 rounded bg-zinc-800" />
              <div className="h-3 w-36 rounded bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
        <div className="border-b border-zinc-800 px-5 py-3.5">
          <div className="h-4 w-40 rounded bg-zinc-800" />
        </div>
        <div className="divide-y divide-zinc-800/70">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-zinc-800" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-zinc-800" />
                  <div className="h-3 w-24 rounded bg-zinc-800/60" />
                </div>
              </div>
              <div className="h-7 w-16 rounded-lg bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
