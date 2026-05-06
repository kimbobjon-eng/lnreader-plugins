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
  version = '1.0.2';

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const listType = showLatestNovels ? 'latest-release-novels' : 'most-popular-novels';
    const url = `${BASE_URL}/list/${listType}/${pageNo}/`;
    const result = await fetchApi(url);
    const body = await result.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('div.ul-list1 div.li-row div.li').each((_, el) => {
      const anchor = $(el).find('h3.tit a').first();
      const name = anchor.attr('title') || anchor.text().trim();
      const href = anchor.attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const cover = $(el).find('div.pic img').attr('src') || '';
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
      name: $('div.m-desc h1.tit').first().text().trim(),
      cover: $('div.m-book1 div.pic img').first().attr('src') || '',
      summary: $('div.m-desc div.txt div.inner').text().trim(),
      author: $('div.m-imgtxt div.item a[href*="/author/"]').first().text().trim(),
      genres: $('div.m-imgtxt div.item a[href*="/genres/"]').map((_, el) => $(el).text().trim()).get().join(', '),
      status: NovelStatus.Ongoing,
      chapters: [],
    };

    const lastPageHref = $('div.m-newest2 div.page a.index-container-btn').last().attr('href') || '';
    const lastPageMatch = lastPageHref.match(/\/(\d+)\/?$/);
    const totalPages = lastPageMatch ? parseInt(lastPageMatch[1]) : 1;

    const chapters: Plugin.ChapterItem[] = [];

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
    const result = await fetchApi(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', 'Referer': 'https://novellive.app/' } });
    const body = await result.text();
    const $ = parseHTML(body);

    $('div[id^="pf-"]').remove();
    $('script').remove();

    return $('div.txt').html() || '';
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

    $('div.ul-list1 div.li-row div.li, div.li-row div.li').each((_, el) => {
      const anchor = $(el).find('h3.tit a').first();
      const name = anchor.attr('title') || anchor.text().trim();
      const href = anchor.attr('href') || '';
      const path = href.replace(BASE_URL, '');
      const cover = $(el).find('div.pic img').attr('src') || '';
      if (name && path && path.startsWith('/book/')) {
        novels.push({ name, cover, path });
      }
    });

    return novels;
  }
}

export default new NovelLive();
