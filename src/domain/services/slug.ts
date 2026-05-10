/** P4 — URL-safe slugs for storefront SEO (no framework / DB imports). */

const SLUG_MAX_LEN = 120;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!base) return 'item';
  return base.length > SLUG_MAX_LEN ? base.slice(0, SLUG_MAX_LEN).replace(/-+$/g, '') : base;
}

export function normalizeSlugParam(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

export function isValidSlugFormat(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX_LEN && SLUG_PATTERN.test(slug);
}
