import fs from 'node:fs';
import path from 'node:path';
import { resolveNomineeMedia } from '../server/lib/nomineeLookup.js';

/**
 * Script genérico anual para gerar o JSON de importação do TGA Winners
 * e buscar/validar URLs de imagem + links Steam em paralelo (lotes de 5).
 *
 * Exemplos de uso:
 *   node scripts/fetch-nominees.mjs --input scripts/inputs/modelo-anual.txt --year 2027
 *   node scripts/fetch-nominees.mjs --input tga-2026-nominees.json --year 2026
 *   node scripts/fetch-nominees.mjs --input lista.txt --year 2027 --out tga-2027-import.json
 */

const BATCH_SIZE = 5;

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

      const parts = body.includes('|')
        ? body.split('|').map((s) => s.trim())
        : body.includes('—')
          ? body.split('—').map((s) => s.trim())
          : [body];

      const name = parts[0] || '';
      const description = parts[1] || null;
      const imageUrl = parts[2] && parts[2].startsWith('http') ? parts[2] : null;
      const externalUrl = parts[3] && parts[3].startsWith('http') ? parts[3] : null;

      if (name) {
        currentCategory.nominees.push({
          name,
          description,
          image_url: imageUrl,
          external_url: externalUrl,
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

async function processInBatches(items, batchSize, worker) {
  const results = new Array(items.length);
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(slice.map((item, idx) => worker(item, i + idx)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
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

  console.log(`Processando TGA ${year} (${categories.length} categorias, lotes de ${BATCH_SIZE})...`);

  const outputCategories = [];
  let totalNominees = 0;
  let foundImages = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const nomineesList = cat.nominees || [];
    totalNominees += nomineesList.length;

    const cleanNominees = await processInBatches(nomineesList, BATCH_SIZE, async (nom) => {
      const media = args.noFetch
        ? { image_url: nom.image_url || null, external_url: nom.external_url || null }
        : await resolveNomineeMedia(nom);
      if (media.image_url) foundImages += 1;

      return {
        name: nom.name,
        description: nom.description || null,
        image_url: media.image_url || null,
        external_url: media.external_url || null,
      };
    });

    outputCategories.push({
      name: cat.name,
      display_order: cat.display_order || i + 1,
      points_weight: cat.points_weight || 5,
      nominees: cleanNominees,
    });
    console.log(`[${i + 1}/${categories.length}] ${cat.name}`);
  }

  const outJsonPath = path.resolve(process.cwd(), args.out || `tga-${year}-import.json`);
  const outMdPath = path.resolve(process.cwd(), `tga-${year}-nominees.md`);

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
      if (nom.external_url) {
        mdLines.push(`  - Link: ${nom.external_url}`);
      }
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
