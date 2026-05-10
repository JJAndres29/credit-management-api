import type { SitemapUrlEntry } from '../../services/storefront-catalog-read.port';

export interface SitemapSection {
  /** Absolute URLs */
  urls: { loc: string; lastmod: Date }[];
}

export class BuildSitemapXmlUseCase {
  execute(sections: SitemapSection[]): string {
    const urls = sections.flatMap((s) => s.urls);
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    for (const u of urls) {
      const lastmod = u.lastmod.toISOString().slice(0, 10);
      lines.push('  <url>');
      lines.push(`    <loc>${escapeXml(u.loc)}</loc>`);
      lines.push(`    <lastmod>${lastmod}</lastmod>`);
      lines.push('  </url>');
    }

    lines.push('</urlset>');
    return lines.join('\n');
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Maps DB entries + path prefixes to absolute locs. */
export function toAbsoluteSitemapUrls(
  origin: string,
  pathPrefix: string,
  entries: SitemapUrlEntry[],
): { loc: string; lastmod: Date }[] {
  const base = origin.replace(/\/$/, '');
  const prefix = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
  return entries.map((e) => ({
    loc: `${base}${prefix}/${encodeURIComponent(e.locPath)}`,
    lastmod: e.lastmod,
  }));
}
