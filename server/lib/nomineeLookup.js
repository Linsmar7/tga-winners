const UA = 'TGAWinnersFetcher/1.0 (https://github.com/Linsmar7/tga-winners)';
const lookupCache = new Map();

export function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGoodMatch(query, candidateTitle) {
  const qWords = normalizeText(query)
    .split(' ')
    .filter((w) => w.length > 1);
  const cNorm = normalizeText(candidateTitle);
  if (!qWords.length) return false;
  const matched = qWords.filter((w) => cNorm.includes(w));
  return matched.length >= Math.max(1, Math.ceil(qWords.length * 0.6));
}

export async function verifyImageUrl(url) {
  if (!url || !url.startsWith('https://')) return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.startsWith('image/')) return true;
    }
    const getRes = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Range: 'bytes=0-64' },
      signal: AbortSignal.timeout(5000),
    });
    if (!getRes.ok) return false;
    const ct = getRes.headers.get('content-type') || '';
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

export async function searchSteamData(query, expectedName) {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return { image_url: null, external_url: null };
    const data = await res.json();
    const items = data?.items || [];
    const match = items.find((it) => isGoodMatch(expectedName, it.name));
    if (!match) return { image_url: null, external_url: null };

    const external_url = match.id ? `https://store.steampowered.com/app/${match.id}` : null;
    const candidates = [
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${match.id}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${match.id}/header.jpg`,
      match.tiny_image?.replace(/^http:/, 'https:'),
    ].filter(Boolean);

    for (const img of candidates) {
      if (await verifyImageUrl(img)) {
        return { image_url: img, external_url };
      }
    }
    return { image_url: null, external_url };
  } catch {
    return { image_url: null, external_url: null };
  }
}

export async function fetchWikipediaFileUrl(fileTitle) {
  if (!fileTitle) return null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const img = pages[0]?.imageinfo?.[0]?.url;
    if (img && (await verifyImageUrl(img))) return img;
    return null;
  } catch {
    return null;
  }
}

export async function searchWikipediaImage(titleOrQuery, strict = false) {
  if (!titleOrQuery) return null;
  try {
    const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleOrQuery.replace(/\s+/g, '_'))}`;
    const directRes = await fetch(directUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (directRes.ok) {
      const data = await directRes.json();
      const img = data?.thumbnail?.source || data?.originalimage?.source;
      if (img && (await verifyImageUrl(img))) return img;
    }

    if (strict) return null;

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(titleOrQuery)}&srlimit=3&format=json`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData?.query?.search || [];

    for (const item of results) {
      if (!isGoodMatch(titleOrQuery, item.title)) continue;
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;
      const sumRes = await fetch(sumUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(7000),
      });
      if (!sumRes.ok) continue;
      const sumData = await sumRes.json();
      const img = sumData?.thumbnail?.source || sumData?.originalimage?.source;
      if (img && (await verifyImageUrl(img))) return img;
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchItunesData(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=3`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return { image_url: null, external_url: null };
    const data = await res.json();
    const match = (data?.results || []).find((r) => isGoodMatch(query, r.trackName));
    if (!match) return { image_url: null, external_url: null };
    const img = match.artworkUrl512 || match.artworkUrl100;
    const verified = img && (await verifyImageUrl(img)) ? img : null;
    return {
      image_url: verified,
      external_url: match.trackViewUrl || null,
    };
  } catch {
    return { image_url: null, external_url: null };
  }
}

export async function resolveNomineeMedia(nominee) {
  if (nominee.image_url && nominee.external_url) {
    return { image_url: nominee.image_url, external_url: nominee.external_url };
  }

  const cacheKey = `${nominee.kind || 'game'}::${nominee.name}::${nominee.wiki || ''}::${nominee.wikiFile || ''}`;
  if (lookupCache.has(cacheKey)) {
    const cached = lookupCache.get(cacheKey);
    return {
      image_url: nominee.image_url || cached.image_url,
      external_url: nominee.external_url || cached.external_url,
    };
  }

  let image_url = nominee.image_url || null;
  let external_url = nominee.external_url || null;

  if (nominee.wikiFile) {
    image_url = image_url || (await fetchWikipediaFileUrl(nominee.wikiFile));
  } else if (nominee.kind === 'person' || nominee.kind === 'media') {
    image_url =
      image_url ||
      (await searchWikipediaImage(nominee.wiki || nominee.name, Boolean(nominee.strictWiki)));
    if (!image_url && nominee.fallbackGame) {
      const steam = await searchSteamData(nominee.fallbackGame, nominee.fallbackGame);
      image_url = steam.image_url || (await searchWikipediaImage(`${nominee.fallbackGame} video game`));
      external_url = external_url || steam.external_url;
    }
  } else if (nominee.kind === 'mobile') {
    const targetApp = nominee.fallbackGame || nominee.name;
    const itunes = await searchItunesData(targetApp);
    image_url = image_url || itunes.image_url;
    external_url = external_url || itunes.external_url;
    if (!image_url) {
      const steam = await searchSteamData(targetApp, targetApp);
      image_url = steam.image_url || (await searchWikipediaImage(nominee.wiki || targetApp));
      external_url = external_url || steam.external_url;
    }
  } else {
    const targetGame = nominee.fallbackGame || nominee.name;
    const steam = await searchSteamData(nominee.steamQuery || targetGame, targetGame);
    image_url = image_url || steam.image_url;
    external_url = external_url || steam.external_url;
    if (!image_url) {
      image_url = await searchWikipediaImage(nominee.wiki || targetGame, Boolean(nominee.strictWiki));
    }
    if (!image_url && !nominee.wiki) {
      image_url = await searchWikipediaImage(`${targetGame} video game`);
    }
  }

  const result = { image_url: image_url || null, external_url: external_url || null };
  lookupCache.set(cacheKey, result);
  return result;
}
