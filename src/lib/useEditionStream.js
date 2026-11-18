import { useEffect, useRef, useState } from 'react';

/**
 * Subscreve ao stream SSE (/api/editions/:year/stream) da edição ativa
 * e dispara callbacks estabilizados por ref quando o Admin apura vencedores ou extras.
 */
export function useEditionStream(
  year,
  { onWinnerUpdated, onSideBetUpdated, onEditionUpdated } = {}
) {
  const [connected, setConnected] = useState(false);

  const handlersRef = useRef({ onWinnerUpdated, onSideBetUpdated, onEditionUpdated });
  handlersRef.current = { onWinnerUpdated, onSideBetUpdated, onEditionUpdated };

  useEffect(() => {
    if (!year || typeof EventSource === 'undefined') {
      setConnected(false);
      return;
    }

    const es = new EventSource(`/api/editions/${year}/stream`);

    es.addEventListener('connected', () => setConnected(true));
    es.onerror = () => setConnected(false);

    es.addEventListener('winner_updated', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        handlersRef.current.onWinnerUpdated?.(payload);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('side_bet_updated', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        handlersRef.current.onSideBetUpdated?.(payload);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('edition_updated', (ev) => {
      try {
        const payload = ev.data ? JSON.parse(ev.data) : {};
        handlersRef.current.onEditionUpdated?.(payload);
      } catch {
        handlersRef.current.onEditionUpdated?.({});
      }
    });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [year]);

  return { connected };
}
