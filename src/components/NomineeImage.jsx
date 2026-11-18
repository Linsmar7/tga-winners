import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

export default function NomineeImage({
  src,
  alt = '',
  className = 'h-14 w-14',
  iconClassName = 'h-6 w-6',
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600 ${className}`}
        aria-hidden="true"
      >
        <Gamepad2 className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 object-cover ${className}`}
    />
  );
}
