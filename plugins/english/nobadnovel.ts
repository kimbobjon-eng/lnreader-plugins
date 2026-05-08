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
  version = '1.0.5';

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

    $('h4 a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;

      const name = $(el).text().trim();
      if (!name) return;

      const card = $(el).closest('div, li, article');
      const cover =
        card.find('img').first().attr('src') ||
        card.find('img').first().attr('data-src') ||
        '';

      novels.push({ name, cover, path });
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

    $('ol li a, ul li a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('/series/')) return;
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 3) return;
      if (seen.has(path)) return;
      seen.add(path);

      const chapterNumber = chapters.length + 1;

      // Strip existing C1. prefix from site, then prepend clean "Chapter N: Title"
      const rawName =
        $(el).attr('title') ||
        $(el).text().trim() ||
        '';
      const cleanName = rawName.replace(/^C\d+\.\s*/, '').trim();
      const name = cleanName
        ? `Chapter ${chapterNumber}: ${cleanName}`
        : `Chapter ${chapterNumber}`;

      chapters.push({
        name,
        path,
        chapterNumber,
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

    $('script, style, noscript, iframe, [class*="ads"], [id*="ads"], [class*="ad-"]').remove();

    const paragraphs: string[] = [];
    let collecting = false;

    $('*').each((_, el) => {
      const tag = (el as any).tagName?.toLowerCase();

      if (!collecting) {
        if (tag === 'h1') collecting = true;
        return;
      }

      if (tag === 'h2' || tag === 'h3') {
        collecting = false;
        return;
      }

      if (tag === 'a') {
        const text = $(el).text().trim().toLowerCase();
        if (
          text.includes('previous chapter') ||
          text.includes('next chapter') ||
          text.includes('prev chapter')
        ) {
          collecting = false;
          return;
        }
      }

      if (tag === 'p') {
        const text = $(el).text().trim();
        if (text.length >= 2) {
          paragraphs.push(`<p>${$(el).html()}</p>`);
        }
      }
    });

    return paragraphs.join('\n');
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

    $('h4 a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;

      const name = $(el).text().trim();
      if (!name) return;

      const card = $(el).closest('div, li, article');
      const cover =
        card.find('img').first().attr('src') ||
        card.find('img').first().attr('data-src') ||
        '';

      novels.push({ name, cover, path });
    });

    return novels;
  }
}

export default new NoBadNovel();
