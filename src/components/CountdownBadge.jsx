import React, { useEffect, useState } from 'react';
import { Clock, Lock, CheckCircle2, Calendar } from 'lucide-react';

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export default function CountdownBadge({ edition }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!edition) return null;

  const startMs = new Date(edition.voting_start).getTime();
  const endMs = new Date(edition.voting_end).getTime();

  if (edition.is_finished) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Edição Finalizada
      </span>
    );
  }

  if (now < startMs) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
        <Calendar className="h-3.5 w-3.5 text-amber-400" />
        Abre em {formatDuration(startMs - now)}
      </span>
    );
  }

  if (now < endMs) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
        <Clock className="h-3.5 w-3.5 text-amber-400" />
        Encerra em {formatDuration(endMs - now)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
      <Lock className="h-3.5 w-3.5" />
      Votação encerrada
    </span>
  );
}
