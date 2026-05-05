import { CheerioAPI, load as parseHTML } from 'cheerio';
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';

const BASE_URL = 'https://novellive.app';

class NovelLive implements Plugin.PluginBase {
  id = 'novellive';
  name = 'Novel Live';
  icon = 'https://novellive.app/images/favicon.ico';
  site = BASE_URL;
  version = '1.0.0';

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const listType = showLatestNovels ? 'latest-release-novels' : 'most-popular-novels';
    const url = `${BASE_URL}/list/${listType}/${pageNo > 1 ? pageNo + '/' : ''}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('ul.ul-list1 li, ul.ul-list4 li').each((_, el) => {
      const anchor = $(el).find('a.con, h3.tit a').first();
      const name = anchor.attr('title') || anchor.text().trim();
      const href = anchor.attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const cover = $(el).find('img').attr('src') || '';
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
      name: $('h1.tit').first().text().trim() || $('h3.tit span + *').first().text().trim(),
      cover: $('div.pic img').first().attr('src') || `https://media.novellive.app/novel/${novelPath.replace('/book/', '')}.jpg`,
      summary: $('div.txt div.inner').text().trim(),
      author: $('div.item a[href*="/author/"]').first().text().trim(),
      genres: $('div.item a[href*="/genres/"]').map((_, el) => $(el).text().trim()).get().join(', '),
      status: $('span.s2 a[href*="latest-release"]').length ? NovelStatus.Ongoing : NovelStatus.Completed,
      chapters: [],
    };

    // Get total pages from pagination
    const lastPageHref = $('a.index-container-btn').last().attr('href') || '';
    const lastPageMatch = lastPageHref.match(/\/(\d+)\/?$/);
    const totalPages = lastPageMatch ? parseInt(lastPageMatch[1]) : 1;

    const chapters: Plugin.ChapterItem[] = [];

    // Fetch all pages
    for (let page = 1; page <= totalPages; page++) {
      const pageUrl = page === 1 ? url : `${BASE_URL}${novelPath}/${page}`;
      const pageResult = await fetchApi(pageUrl);
      const pageBody = await pageResult.text();
      const $page = parseHTML(pageBody);

      $page('div.m-newest2 ul.ul-list5 li a.con').each((_, el) => {
        const chapName = $page(el).attr('title') || $page(el).text().trim();
        const chapHref = $page(el).attr('href') || '';
        const chapPath = chapHref.replace(BASE_URL, '');
        if (chapName && chapPath) {
          chapters.push({
            name: chapName,
            path: chapPath,
            chapterNumber: chapters.length + 1,
          });
        }
      });
    }

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = `${BASE_URL}${chapterPath}`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);

    // Remove ads
    $('div[id^="pf-"]').remove();
    $('script').remove();

    const content = $('div.txt').html() || '';
    return content;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const result = await fetchApi(`${BASE_URL}/search/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `searchkey=${encodeURIComponent(searchTerm)}`,
    });
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('ul.ul-list1 li, div.m-book-item, li').each((_, el) => {
      const anchor = $(el).find('a.con, h3.tit a').first();
      const name = anchor.attr('title') || anchor.text().trim();
      const href = anchor.attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const cover = $(el).find('img').attr('src') || '';
      if (name && path && path.startsWith('/book/')) {
        novels.push({ name, cover, path });
      }
    });

    return novels;
  }
}

export default new NovelLive();
