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
  version = '1.0.0';

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

    // Each novel card — site uses article tags or generic div wrappers
    $('article, .grid > div, .novel-item').each((_, el) => {
      const anchor = $(el).find('a[href*="/series/"]').first();
      const href = anchor.attr('href') || '';
      const path = href.replace(BASE_URL, '');
      // Skip if this is a chapter link (too many path segments)
      if (!path || path.split('/').filter(Boolean).length !== 2) return;

      const name =
        $(el).find('h2, h3, .entry-title').first().text().trim() ||
        anchor.attr('title') ||
        anchor.text().trim();
      const cover =
        $(el).find('img').first().attr('src') ||
        $(el).find('img').first().attr('data-src') ||
        '';

      if (name && path) novels.push({ name, cover, path });
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
        $('img.attachment-post-thumbnail, .series-cover img').first().attr('src') ||
        '',
      summary:
        $('meta[name="description"]').attr('content') ||
        $('[class*="summary"], [class*="synopsis"], [class*="description"]')
          .first()
          .text()
          .trim() ||
        '',
      author:
        $('a[href*="/author/"]').first().text().trim() ||
        $('[class*="author"]').first().text().replace(/author[:\s]*/i, '').trim(),
      genres: $('a[href*="/genre/"], a[href*="/genres/"], a[href*="/tag/"]')
        .map((_, el) => $(el).text().trim())
        .get()
        .join(', '),
      status: NovelStatus.Ongoing,
      chapters: [],
    };

    // Status detection
    const statusText = $('[class*="status"]').first().text().toLowerCase();
    if (statusText.includes('complet')) novel.status = NovelStatus.Completed;

    // Collect chapters from all links on the series page
    const chapters: Plugin.ChapterItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/chapter-"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const chapPath = href.replace(BASE_URL, '');
      if (!chapPath || seen.has(chapPath)) return;
      seen.add(chapPath);

      const chapName =
        $(el).attr('title') ||
        $(el).text().trim() ||
        `Chapter ${chapters.length + 1}`;

      chapters.push({
        name: chapName,
        path: chapPath,
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

    // Remove ads, nav, scripts
    $(
      'script, style, noscript, iframe, nav, header, footer, ' +
      '.chapter-nav, [class*="navigation"], [class*="pager"], ' +
      '[class*="ads"], [id*="ads"], [class*="ad-"], [id*="ad-"]',
    ).remove();

    // Try content selectors in order of specificity
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
      if (!path || path.split('/').filter(Boolean).length !== 2) return;
      if (seen.has(path)) return;
      seen.add(path);

      const name =
        $(el).attr('title') ||
        $(el).text().trim() ||
        path;
      const imgEl = $(el).find('img').first();
      const cover = imgEl.attr('src') || imgEl.attr('data-src') || '';

      if (name) novels.push({ name, cover, path });
    });

    return novels;
  }
}

export default new NoBadNovel();
