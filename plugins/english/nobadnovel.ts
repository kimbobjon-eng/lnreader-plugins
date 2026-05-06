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
  version = '1.0.4';

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

      const name =
        $(el).attr('title') ||
        $(el).text().trim() ||
        `Chapter ${chapters.length + 1}`;

      chapters.push({
        name: name.replace(/^C\d+\.\s*/, '').trim(),
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

    // The page structure is:
    //   h1 (chapter title)
    //   <p>...</p>  × N  ← actual chapter content
    //   "Previous Chapter / Next Chapter" links
    //   ## Recommend Series  ← everything after this is junk
    //
    // Strategy: find the h1, then collect only sibling <p> elements
    // that come BEFORE the nav links / recommend section.

    // Remove script/style/ads globally first
    $('script, style, noscript, iframe, [class*="ads"], [id*="ads"], [class*="ad-"]').remove();

    const chapterH1 = $('h1').first();

    // Collect all <p> elements that are siblings/descendants after the h1
    // and stop when we hit the chapter nav (prev/next) or h2 (Recommend Series)
    const paragraphs: string[] = [];
    let collecting = false;

    // Walk every element in document order
    $('*').each((_, el) => {
      const tag = (el as any).tagName?.toLowerCase();

      // Start collecting after the h1
      if (!collecting) {
        if (tag === 'h1') collecting = true;
        return;
      }

      // Stop at the "Recommend Series" h2 or any heading after content starts
      if (tag === 'h2' || tag === 'h3') {
        collecting = false;
        return;
      }

      // Stop at prev/next chapter nav links
      if (tag === 'a') {
        const href = $(el).attr('href') || '';
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

      // Collect <p> tags
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
