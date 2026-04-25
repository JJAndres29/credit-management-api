import * as fs from 'fs';
import * as path from 'path';

/**
 * Structural test: ensures Customer use cases and DTOs never import
 * Staff domain artifacts (ClientRepository, ClientEntity, UserRepository, UserEntity).
 * This guards the bounded-context isolation rule stated in CLAUDE.md.
 */

const FORBIDDEN_IMPORTS = ['client.repository', 'client.entity', 'user.repository', 'user.entity'];

const GUARDED_DIRS = [
  path.resolve(__dirname, '../customer-auth'),
  path.resolve(__dirname, '../../dtos/customer-auth'),
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

describe('Bounded Context Isolation — Customer never imports Staff artifacts', () => {
  for (const dir of GUARDED_DIRS) {
    const files = collectTsFiles(dir);

    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file);
      const content = fs.readFileSync(file, 'utf-8');

      for (const forbidden of FORBIDDEN_IMPORTS) {
        it(`${relativePath} does not import "${forbidden}"`, () => {
          expect(content).not.toContain(forbidden);
        });
      }
    }
  }
});
