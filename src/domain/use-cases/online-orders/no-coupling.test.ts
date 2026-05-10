import * as fs from 'fs';
import * as path from 'path';

/**
 * Structural guard: ensures OnlineOrder use cases never import
 * ProductRepository, CustomerRepository, or ClientRepository directly.
 * They must use ProductCatalogPort (ACL) and receive customerId as a plain string.
 */

const FORBIDDEN_IMPORTS = [
  'product.repository',
  'customer.repository',
  'client.repository',
];

const GUARDED_DIRS = [
  path.resolve(__dirname, '../online-orders'),
  path.resolve(__dirname, '../../dtos/online-orders'),
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

function tryReadTsSource(file: string): string | null {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > 5 * 1024 * 1024) return null;
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

describe('Bounded Context Isolation — OnlineOrders never imports repository artifacts', () => {
  for (const dir of GUARDED_DIRS) {
    const files = collectTsFiles(dir);

    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file);
      const content = tryReadTsSource(file);
      if (content === null) continue;

      for (const forbidden of FORBIDDEN_IMPORTS) {
        it(`${relativePath} does not import "${forbidden}"`, () => {
          expect(content).not.toContain(forbidden);
        });
      }
    }
  }
});
