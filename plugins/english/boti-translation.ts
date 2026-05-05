import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { NovelStatus } from '@libs/novelStatus';

const API_URL = 'https://api.mystorywave.com/story-wave-backend/api/v1';

class BoTiTranslation implements Plugin.PluginBase {
  id = 'botitranslation';
  name = 'BOTI Translation';
  icon = 'https://botitranslation.com/favicon.ico';
  site = 'https://botitranslation.com';
  version = '1.0.6';

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const sortField = showLatestNovels ? 'lastUpdateTime' : 'readCounts';
    const url = `${API_URL}/content/books?pageNumber=${pageNo}&pageSize=20&sortField=${sortField}&sortDirection=DESC`;
    const result = await fetchApi(url);
    const json = await result.json();
    const items = json?.data?.list || [];
    return items.map((item: any) => ({
      name: item.title || 'Unknown',
      cover: item.coverImgUrl || '',
      path: `/book/${item.id}`,
    }));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const idMatch = novelPath.match(/\/book\/(\d+)/);
    const bookId = idMatch ? idMatch[1] : '';

    const result = await fetchApi(`${API_URL}/content/books/${bookId}`);
    const json = await result.json();
    const book = json?.data || {};

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: book.title || 'Unknown',
      cover: book.coverImgUrl || '',
      summary: book.synopsis || '',
      author: book.authorPseudonym || '',
      status: book.status === 1 ? NovelStatus.Completed : NovelStatus.Ongoing,
      genres: book.genreName || '',
      chapters: [],
    };

    const chapters: Plugin.ChapterItem[] = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const chapResult = await fetchApi(
        `${API_URL}/content/chapters/page?sortDirection=ASC&bookId=${bookId}&pageNumber=${pageNumber}&pageSize=100`,
      );
      const chapJson = await chapResult.json();
      const records = chapJson?.data?.list || [];
      const totalCount = chapJson?.data?.totalCount || 0;

      for (const chap of records) {
        chapters.push({
          name: chap.title || `Chapter ${chap.chapterOrder}`,
          path: `/chapter/${chap.id}`,
          releaseTime: chap.publishTime
            ? new Date(chap.publishTime).toISOString()
            : null,
          chapterNumber: chap.chapterOrder || chapters.length + 1,
        });
      }

      hasMore = chapters.length < totalCount && records.length === 100;
      pageNumber++;
    }

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const idMatch = chapterPath.match(/\/chapter\/(\d+)/);
    const chapterId = idMatch ? idMatch[1] : '';

    const result = await fetchApi(
      `${API_URL}/content/chapters/${chapterId}`,
    );
    const json = await result.json();
    const chap = json?.data || {};

    const content = chap.content || chap.text || chap.body || '';

    if (content && !content.includes('<p') && !content.includes('<div')) {
      return content
        .split(/\n+/)
        .filter((p: string) => p.trim())
        .map((p: string) => `<p>${p.trim()}</p>`)
        .join('\n');
    }

    return content;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${API_URL}/content/books/search?keyWord=${searchTerm.split(' ').join('+')}&pageNumber=${pageNo}&pageSize=50`;
    const result = await fetchApi(url);
    const json = await result.json();
    const items = json?.data?.list || [];
    return items.map((item: any) => ({
      name: item.title || 'Unknown',
      cover: item.coverImgUrl || '',
      path: `/book/${item.id}`,
    }));
  }
}

export default new BoTiTranslation();
