import React from 'react';
import { Search } from 'lucide-react';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
}) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-500"
      />
    </div>
  );
}
