import * as fs from 'fs';
import * as path from 'path';

/**
 * Structural guard: ensures no file in src/domain/ imports HTTP-layer
 * concerns (Mercado Pago SDK strings, raw fetch/axios, infrastructure tokens).
 * If these strings appear in domain code the bounded-context is broken.
 */

const DOMAIN_DIR = path.resolve(__dirname);

const FORBIDDEN_PATTERNS = [
  'mercadopago',
  'MP_ACCESS',
  "fetch(",
  "'axios'",
  '"axios"',
];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('Domain isolation — no HTTP or gateway leakage in src/domain/', () => {
  const files = collectTsFiles(DOMAIN_DIR);

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf-8');

    for (const forbidden of FORBIDDEN_PATTERNS) {
      it(`${relativePath} does not contain "${forbidden}"`, () => {
        expect(content).not.toContain(forbidden);
      });
    }
  }
});
