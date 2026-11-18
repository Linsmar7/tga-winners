import { useEffect, useState } from 'react';

function evaluateWindow(edition) {
  if (!edition) {
    return { isBeforeStart: false, isAfterEnd: false, isVotingOpen: false };
  }
  const now = Date.now();
  const startMs = new Date(edition.voting_start).getTime();
  const endMs = new Date(edition.voting_end).getTime();
  const isBeforeStart = now < startMs;
  const isAfterEnd = now >= endMs;
  return {
    isBeforeStart,
    isAfterEnd,
    isVotingOpen: !isBeforeStart && !isAfterEnd,
  };
}

/**
 * Monitora a janela de votação em tempo real sem re-renderizar a página a cada segundo:
 * atualiza o estado apenas quando o status booleano muda (início ou encerramento).
 */
export function useVotingWindow(edition) {
  const [windowState, setWindowState] = useState(() => evaluateWindow(edition));

  useEffect(() => {
    const updateIfChanged = () => {
      const next = evaluateWindow(edition);
      setWindowState((prev) =>
        prev.isBeforeStart === next.isBeforeStart &&
        prev.isAfterEnd === next.isAfterEnd &&
        prev.isVotingOpen === next.isVotingOpen
          ? prev
          : next
      );
    };

    updateIfChanged();
    if (!edition) return;

    const id = setInterval(updateIfChanged, 1000);
    return () => clearInterval(id);
  }, [edition?.voting_start, edition?.voting_end, edition]);

  return windowState;
}
