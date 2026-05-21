import { CheerioAPI, load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';

const BASE_URL = 'https://novelshaven.com';

class NovelsHaven implements Plugin.PluginBase {
  id = 'novelshaven';
  name = 'Novels Haven';
  icon = 'https://novelshaven.com/icon.png';
  site = BASE_URL;
  version = '1.0.0';

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const sort = showLatestNovels ? 'latest' : 'daily-rank';
    const url = `${BASE_URL}/series?sort=${sort}&order=descending&page=${pageNo}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;
      const name = $(el).find('p').first().text().trim() || $(el).attr('aria-label') || '';
      if (!name) return;
      const cover = $(el).find('img').first().attr('src') || '';
      if (!novels.find(n => n.path === path)) {
        novels.push({ name, cover, path });
      }
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
      name: $('h1').first().text().trim(),
      cover: $('img[alt*="cover"]').first().attr('src') || '',
      summary: $('meta[name="description"]').attr('content') || '',
      author: $('a[href*="/authors/"]').first().text().trim(),
      genres: $('a[href*="/genres/"]').map((_, el) => $(el).text().trim()).get().join(', '),
      status: NovelStatus.Ongoing,
      chapters: [],
    };

    const chapters: Plugin.ChapterItem[] = [];

    $('a[href*="/series/"][href*="/chapter-"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const name = $(el).text().trim() || $(el).attr('title') || '';
      const numMatch = path.match(/chapter-(\d+)/);
      const chapterNumber = numMatch ? parseInt(numMatch[1]) : chapters.length + 1;
      if (path && !chapters.find(c => c.path === path)) {
        chapters.push({ name, path, chapterNumber });
      }
    });

    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = `${BASE_URL}${chapterPath}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);

    $('script, style, noscript, nav, footer, header').remove();

    const paragraphs: string[] = [];
    $('div.no-select p, article p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length >= 2) {
        paragraphs.push(`<p>${$(el).html()}</p>`);
      }
    });

    return paragraphs.join('\n');
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${BASE_URL}/series?search=${encodeURIComponent(searchTerm)}&page=${pageNo}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const segments = path.split('/').filter(Boolean);
      if (segments.length !== 2) return;
      const name = $(el).find('p').first().text().trim() || $(el).attr('aria-label') || '';
      if (!name) return;
      const cover = $(el).find('img').first().attr('src') || '';
      if (!novels.find(n => n.path === path)) {
        novels.push({ name, cover, path });
      }
    });

    return novels;
  }
}

export default new NovelsHaven();
