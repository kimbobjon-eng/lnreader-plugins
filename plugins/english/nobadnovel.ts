import { CheerioAPI, load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';

const BASE_URL = 'https://www.nobadnovel.com';

class NoBadNovel implements Plugin.PluginBase {
  id = 'nobadnovel';
  name = 'NoBadNovel';
  icon = 'https://www.nobadnovel.com/nobad.svg';
  site = BASE_URL;
  version = '1.0.1';

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const url =
      pageNo === 1
        ? `${BASE_URL}/series`
        : `${BASE_URL}/series/page/${pageNo}`;

    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      // Series root = /series/slug (exactly 2 segments), not a chapter link
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;
      if (seen.has(path)) return;
      seen.add(path);

      const name =
        $(el).attr('title') ||
        $(el).find('h2, h3, .entry-title').first().text().trim() ||
        $(el).text().trim();
      const imgEl = $(el).find('img').first();
      const cover = imgEl.attr('src') || imgEl.attr('data-src') || '';

      if (name) novels.push({ name, cover, path });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = `${BASE_URL}${novelPath}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name:
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') ||
        '',
      cover:
        $('meta[property="og:image"]').attr('content') ||
        $('img').first().attr('src') ||
        '',
      summary:
        $('meta[name="description"]').attr('content') ||
        $('[class*="summary"], [class*="synopsis"], [class*="description"]')
          .first()
          .text()
          .trim() ||
        '',
      author: $('a[href*="/author/"]').first().text().trim(),
      genres: $('a[href*="/genre/"], a[href*="/genres/"], a[href*="/tag/"]')
        .map((_, el) => $(el).text().trim())
        .get()
        .join(', '),
      status: NovelStatus.Ongoing,
      chapters: [],
    };

    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();

    // Chapters are in an ordered list: ol > li > a
    // href pattern: /series/<novel-slug>/chapter-<n>-<title>
    $('ol li a, ul li a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('/series/')) return;
      const path = href.replace(BASE_URL, '');
      // Must have 3 segments: /series/novel-slug/chapter-slug
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 3) return;
      if (seen.has(path)) return;
      seen.add(path);

      const name =
        $(el).attr('title') ||
        $(el).text().trim() ||
        `Chapter ${chapters.length + 1}`;

      chapters.push({
        name: name.replace(/^C\d+\.\s*/, '').trim(), // strip "C1. " prefix if present
        path,
        chapterNumber: chapters.length + 1,
      });
    });

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = `${BASE_URL}${chapterPath}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);

    $(
      'script, style, noscript, iframe, nav, header, footer, ' +
      '.chapter-nav, [class*="navigation"], [class*="pager"], ' +
      '[class*="ads"], [id*="ads"], [class*="ad-"], [id*="ad-"]',
    ).remove();

    const selectors = [
      '.chapter-content',
      '.entry-content',
      '[class*="chapter-body"]',
      '[class*="reading-content"]',
      'article .content',
      'article',
    ];

    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 100) {
        return el.html() || '';
      }
    }

    return '';
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${BASE_URL}/?s=${encodeURIComponent(searchTerm)}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;
      if (seen.has(path)) return;
      seen.add(path);

      const name = $(el).attr('title') || $(el).text().trim();
      const imgEl = $(el).find('img').first();
      const cover = imgEl.attr('src') || imgEl.attr('data-src') || '';

      if (name) novels.push({ name, cover, path });
    });

    return novels;
  }
}

export default new NoBadNovel();
