import fs from 'node:fs';
import path from 'node:path';

/**
 * Script genérico anual para gerar o JSON de importação do TGA Winners
 * e buscar/validar URLs de imagem para cada indicado.
 *
 * Exemplos de uso:
 *   node scripts/fetch-nominees.mjs --input scripts/inputs/modelo-anual.txt --year 2027
 *   node scripts/fetch-nominees.mjs --input tga-2026-nominees.json --year 2026
 *   node scripts/fetch-nominees.mjs --input lista.txt --year 2027 --out tga-2027-import.json
 */

const UA = 'TGAWinnersFetcher/1.0 (https://github.com/Linsmar7/tga-winners)';
const imageCache = new Map();

function parseArgs(argv) {
  const args = { input: null, year: null, out: null, noFetch: false };
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i];
    if (cur === '--input' || cur === '-i') args.input = argv[++i];
    else if (cur === '--year' || cur === '-y') args.year = Number(argv[++i]);
    else if (cur === '--out' || cur === '-o') args.out = argv[++i];
    else if (cur === '--no-fetch') args.noFetch = true;
    else if (!cur.startsWith('-') && !args.input) args.input = cur;
  }
  return args;
}

export function parseTextInput(content, defaultYear) {
  const categories = [];
  let currentCategory = null;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Comentário simples (# seguido de espaço só vira categoria se não for comentário de instrução?
    // Na convenção do modelo-anual.txt, linhas de comentário no topo começam com "# " antes de qualquer item;
    // mas para evitar ambiguidade, linhas começando com "//" ou ";" são comentários, e "## " ou "# " são categorias.)
    if (line.startsWith('//') || line.startsWith(';')) continue;
    if (line.startsWith('# ')) {
      const lower = line.toLowerCase();
      if (
        lower.startsWith('# modelo') ||
        lower.startsWith('# uso:') ||
        lower.startsWith('# regras:') ||
        lower.startsWith('# - ') ||
        lower.startsWith('#   ')
      ) {
        continue;
      }
    }

    const catMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (catMatch) {
      const name = catMatch[1].replace(/^\d+\.\s*/, '').trim();
      if (name) {
        currentCategory = { name, nominees: [] };
        categories.push(currentCategory);
      }
      continue;
    }

    const nomMatch = line.match(/^[-*•]\s+(.+)$/);
    if (nomMatch && currentCategory) {
      let body = nomMatch[1].trim();
      let kind = null;

      const tagMatch = body.match(/\s*\[(person|mobile|media|game)\]\s*$/i);
      if (tagMatch) {
        kind = tagMatch[1].toLowerCase();
        body = body.slice(0, tagMatch.index).trim();
      }

      // Divide por "|" ou "—"
      const parts = body.includes('|')
        ? body.split('|').map((s) => s.trim())
        : body.includes('—')
          ? body.split('—').map((s) => s.trim())
          : [body];

      const name = parts[0] || '';
      const description = parts[1] || null;
      const imageUrl = parts[2] && parts[2].startsWith('http') ? parts[2] : null;

      if (name) {
        currentCategory.nominees.push({
          name,
          description,
          image_url: imageUrl,
          kind,
        });
      }
    }
  }

  return {
    year: defaultYear || new Date().getFullYear(),
    categories,
  };
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGoodMatch(query, candidateTitle) {
  const qWords = normalize(query).split(' ').filter((w) => w.length > 1);
  const cNorm = normalize(candidateTitle);
  if (!qWords.length) return false;
  const matched = qWords.filter((w) => cNorm.includes(w));
  return matched.length >= Math.max(1, Math.ceil(qWords.length * 0.6));
}

async function verifyImageUrl(url) {
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

async function searchSteamImage(query, expectedName) {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.items || [];
    const match = items.find((it) => isGoodMatch(expectedName, it.name));
    if (!match) return null;

    const candidates = [
      `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${match.id}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${match.id}/header.jpg`,
      match.tiny_image?.replace(/^http:/, 'https:'),
    ].filter(Boolean);

    for (const img of candidates) {
      if (await verifyImageUrl(img)) return img;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWikipediaFileUrl(fileTitle) {
  if (!fileTitle) return null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
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

async function searchWikipediaImage(titleOrQuery, strict = false) {
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

async function searchItunesImage(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=3`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data?.results || []).find((r) => isGoodMatch(query, r.trackName));
    if (!match) return null;
    const img = match.artworkUrl512 || match.artworkUrl100;
    if (img && (await verifyImageUrl(img))) return img;
    return null;
  } catch {
    return null;
  }
}

async function resolveNomineeImage(nominee) {
  if (nominee.image_url) return nominee.image_url;

  const cacheKey = `${nominee.kind || 'game'}::${nominee.name}::${nominee.wiki || ''}::${nominee.wikiFile || ''}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  let img = null;

  if (nominee.wikiFile) {
    img = await fetchWikipediaFileUrl(nominee.wikiFile);
  } else if (nominee.kind === 'person' || nominee.kind === 'media') {
    img = await searchWikipediaImage(nominee.wiki || nominee.name, Boolean(nominee.strictWiki));
    if (!img && nominee.fallbackGame) {
      img =
        (await searchSteamImage(nominee.fallbackGame, nominee.fallbackGame)) ||
        (await searchWikipediaImage(`${nominee.fallbackGame} video game`));
    }
  } else if (nominee.kind === 'mobile') {
    const targetApp = nominee.fallbackGame || nominee.name;
    img =
      (await searchItunesImage(targetApp)) ||
      (await searchSteamImage(targetApp, targetApp)) ||
      (await searchWikipediaImage(nominee.wiki || targetApp));
  } else {
    const targetGame = nominee.fallbackGame || nominee.name;
    img = await searchSteamImage(nominee.steamQuery || targetGame, targetGame);
    if (!img) {
      img = await searchWikipediaImage(nominee.wiki || targetGame, Boolean(nominee.strictWiki));
    }
    if (!img && !nominee.wiki) {
      img = await searchWikipediaImage(`${targetGame} video game`);
    }
  }

  imageCache.set(cacheKey, img);
  return img;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      'Uso: node scripts/fetch-nominees.mjs --input <arquivo.txt|md|json> [--year 2027] [--out saida.json] [--no-fetch]'
    );
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const rawContent = fs.readFileSync(inputPath, 'utf8');
  const ext = path.extname(inputPath).toLowerCase();

  let parsed;
  if (ext === '.json') {
    parsed = JSON.parse(rawContent);
  } else {
    parsed = parseTextInput(rawContent, args.year);
  }

  const year = args.year || parsed.year || new Date().getFullYear();
  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];

  if (categories.length === 0) {
    console.error('Nenhuma categoria encontrada no arquivo de entrada.');
    process.exit(1);
  }

  console.log(`Processando TGA ${year} (${categories.length} categorias)...`);

  const outputCategories = [];
  let totalNominees = 0;
  let foundImages = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const cleanNominees = [];

    for (const nom of cat.nominees || []) {
      totalNominees += 1;
      const imageUrl = args.noFetch
        ? nom.image_url || null
        : await resolveNomineeImage(nom);
      if (imageUrl) foundImages += 1;

      cleanNominees.push({
        name: nom.name,
        description: nom.description || null,
        image_url: imageUrl || null,
      });
    }

    outputCategories.push({
      name: cat.name,
      display_order: cat.display_order || i + 1,
      nominees: cleanNominees,
    });
    console.log(`[${i + 1}/${categories.length}] ${cat.name}`);
  }

  const outJsonPath = path.resolve(
    process.cwd(),
    args.out || `tga-${year}-import.json`
  );
  const outMdPath = path.resolve(
    process.cwd(),
    `tga-${year}-nominees.md`
  );

  const importPayload = {
    schema: 'tga-winners-import/v1',
    year,
    generated_at: new Date().toISOString(),
    categories: outputCategories,
  };

  fs.writeFileSync(outJsonPath, JSON.stringify(importPayload, null, 2), 'utf8');

  const mdLines = [
    `# The Game Awards ${year} — Categorias, Indicados e Imagens`,
    '',
    `Gerado em: ${new Date().toLocaleString('pt-BR')} · ${outputCategories.length} categorias · ${foundImages}/${totalNominees} imagens encontradas`,
    '',
  ];

  for (const cat of outputCategories) {
    mdLines.push(`## ${cat.display_order}. ${cat.name}`);
    mdLines.push('');
    for (const nom of cat.nominees) {
      mdLines.push(`- **${nom.name}**${nom.description ? ` — *${nom.description}*` : ''}`);
      mdLines.push(`  - Imagem: ${nom.image_url || '*(sem imagem automática)*'}`);
    }
    mdLines.push('');
  }

  fs.writeFileSync(outMdPath, mdLines.join('\n'), 'utf8');

  console.log(`\nConcluído! ${foundImages}/${totalNominees} imagens.`);
  console.log(`JSON para importar no /admin: ${outJsonPath}`);
  console.log(`Resumo em Markdown: ${outMdPath}`);
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
