export function serializeVoteState(votesMap, sideBetVotesMap) {
  const catEntries = Object.entries(votesMap)
    .filter(([, v]) => v && (v.will_win_nominee_id != null || v.want_win_nominee_id != null))
    .map(([k, v]) => [Number(k), v.will_win_nominee_id ?? null, v.want_win_nominee_id ?? null])
    .sort((a, b) => a[0] - b[0]);

  const sbEntries = Object.entries(sideBetVotesMap)
    .filter(([, opt]) => Boolean(opt))
    .map(([k, opt]) => [Number(k), String(opt)])
    .sort((a, b) => a[0] - b[0]);

  return JSON.stringify({ c: catEntries, s: sbEntries });
}

export function isUserEntry(entry, user) {
  if (!entry || !user) return false;
  if (entry.user_id && entry.user_id === user.id) return true;
  return (
    typeof entry.nickname === 'string' &&
    typeof user.username === 'string' &&
    entry.nickname.toLowerCase() === user.username.toLowerCase()
  );
}

export function formatPicksForClipboard({
  year,
  username,
  categories = [],
  votesMap = {},
  sideBets = [],
  sideBetVotesMap = {},
}) {
  const lines = [
    `🏆 *Meus Palpites — TGA ${year}*${username ? ` (${username})` : ''}`,
    '',
  ];

  for (const cat of categories) {
    const v = votesMap[cat.id];
    if (!v || (v.will_win_nominee_id == null && v.want_win_nominee_id == null)) continue;
    const willNom = cat.nominees.find((n) => n.id === v.will_win_nominee_id);
    const wantNom = cat.nominees.find((n) => n.id === v.want_win_nominee_id);
    lines.push(`*${cat.name}*`);
    if (willNom) lines.push(`  🏆 Vai Ganhar: ${willNom.name}`);
    if (wantNom) lines.push(`  ❤️ Quero: ${wantNom.name}`);
  }

  if (sideBets.length > 0 && Object.keys(sideBetVotesMap).length > 0) {
    lines.push('', '🎲 *Bingo / Palpites Extras*');
    for (const sb of sideBets) {
      if (sideBetVotesMap[sb.id]) {
        lines.push(`  • ${sb.question}: ${sideBetVotesMap[sb.id]}`);
      }
    }
  }

  return lines.join('\n');
}

export function formatVoterDetailsForClipboard({
  year,
  voter,
  categories = [],
  sideBets = [],
}) {
  const lines = [
    `🎮 *TGA ${year} — Palpites de ${voter.nickname}* (${voter.total_points} pts)`,
    '',
  ];

  for (const c of categories) {
    if (!c.will_win && !c.want_win) continue;
    lines.push(`*${c.category_name}*`);
    if (c.will_win) lines.push(`  🏆 Vai Ganhar: ${c.will_win.name}`);
    if (c.want_win) lines.push(`  ❤️ Quero: ${c.want_win.name}`);
  }

  if (sideBets.some((sb) => sb.selected_option)) {
    lines.push('', '🎲 *Palpites Extras (Bingo)*');
    for (const sb of sideBets) {
      if (sb.selected_option) {
        lines.push(`  • ${sb.question}: ${sb.selected_option}`);
      }
    }
  }

  return lines.join('\n');
}
