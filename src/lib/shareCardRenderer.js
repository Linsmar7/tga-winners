function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let cut = str;
  while (cut.length > 0 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

/**
 * Renderiza o card PNG compartilhável (modo 'picks' ou 'ranking') em um elemento <canvas>.
 */
export function renderShareCardToCanvas(
  canvas,
  { mode = 'picks', year, nickname, picks = [], rankingEntry = null, totalParticipants = 0 }
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#09090b');
  bgGrad.addColorStop(0.5, '#141418');
  bgGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 180, 30, W / 2, 180, 560);
  glow.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
  glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, 42, 42, W - 84, H - 84, 36);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('THE GAME AWARDS · BOLÃO ENTRE AMIGOS', W / 2, 128);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '900 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(`TGA WINNERS ${year || ''}`, W / 2, 210);

  const nickLabel = nickname ? `👤 ${nickname}` : 'Meus Palpites';
  ctx.font = '700 32px system-ui, -apple-system, sans-serif';
  const nickW = Math.min(700, ctx.measureText(nickLabel).width + 72);
  roundRect(ctx, (W - nickW) / 2, 244, nickW, 64, 32);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.fillText(truncateText(ctx, nickLabel, nickW - 40), W / 2, 287);

  if (mode === 'ranking' && rankingEntry) {
    renderRankingBody(ctx, W, rankingEntry, totalParticipants);
  } else {
    renderPicksBody(ctx, W, picks);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#71717a';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('Gerado por TGA Winners · tga-winners', W / 2, H - 76);
}

function renderRankingBody(ctx, W, rankingEntry, totalParticipants) {
  roundRect(ctx, 96, 360, W - 192, 340, 32);
  ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`CLASSIFICAÇÃO FINAL (${totalParticipants || 1} PARTICIPANTES)`, W / 2, 425);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 132px system-ui, -apple-system, sans-serif';
  ctx.fillText(`#${rankingEntry.position}`, W / 2, 565);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '800 52px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${rankingEntry.total_points} PONTOS`, W / 2, 650);

  const statCards = [
    { label: 'VAI GANHAR', val: String(rankingEntry.will_win_hits ?? 0), color: '#fbbf24' },
    { label: 'BÔNUS ZEBRA', val: `+${rankingEntry.want_win_bonus_hits ?? 0}`, color: '#fb7185' },
    { label: 'PRECISÃO', val: `${rankingEntry.accuracy_pct ?? 0}%`, color: '#34d399' },
  ];
  const cardW = (W - 192 - 48) / 3;
  statCards.forEach((sc, idx) => {
    const cx = 96 + idx * (cardW + 24);
    roundRect(ctx, cx, 740, cardW, 180, 24);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = sc.color;
    ctx.font = '900 62px system-ui, -apple-system, sans-serif';
    ctx.fillText(sc.val, cx + cardW / 2, 835);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(sc.label, cx + cardW / 2, 888);
  });

  const badges = rankingEntry.badges || [];
  if (badges.length > 0) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('CONQUISTAS DA EDIÇÃO', W / 2, 995);

    let bx = 96;
    let by = 1030;
    ctx.font = '700 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    for (const b of badges.slice(0, 6)) {
      const text = `${b.icon} ${b.label}`;
      const tw = ctx.measureText(text).width + 44;
      if (bx + tw > W - 96) {
        bx = 96;
        by += 68;
      }
      roundRect(ctx, bx, by, tw, 52, 26);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.fillText(text, bx + 22, by + 35);
      bx += tw + 16;
    }
    ctx.textAlign = 'center';
  }
}

function renderPicksBody(ctx, W, picks) {
  const shown = picks.slice(0, 7);
  let y = 352;

  if (shown.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = '600 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('Nenhum palpite preenchido ainda.', W / 2, 660);
    return;
  }

  ctx.textAlign = 'left';
  shown.forEach((item) => {
    roundRect(ctx, 84, y, W - 168, 116, 20);
    ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(truncateText(ctx, item.categoryName.toUpperCase(), W - 220), 114, y + 38);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(`🏆 ${truncateText(ctx, item.willWinName || '—', 410)}`, 114, y + 84);

    ctx.fillStyle = '#fb7185';
    ctx.font = '700 26px system-ui, -apple-system, sans-serif';
    ctx.fillText(`❤️ ${truncateText(ctx, item.wantWinName || '—', 370)}`, 575, y + 84);

    y += 130;
  });

  if (picks.length > shown.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(`+ ${picks.length - shown.length} outras categorias preenchidas`, W / 2, y + 24);
  }
}
