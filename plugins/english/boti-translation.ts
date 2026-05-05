import { Plugin } from "@typings/plugin";
import { FilterTypes, Filters } from "@libs/filterInputs";
import { fetchApi } from "@libs/fetch";
import { CheerioAPI, load } from "cheerio";
import { NovelStatus } from "@libs/novelStatus";

const BASE_URL = "https://botitranslation.com";
const API_URL = "https://api.mystorywave.com/story-wave-backend/api/v1";

export const BoTiTranslation: Plugin.PluginBase = {
  id: "botitranslation",
  name: "BOTI Translation",
  icon: "https://botitranslation.com/favicon.ico",
  site: BASE_URL,
  version: "1.0.0",
  filters: undefined,

  async popularNovels(
    pageNo: number,
    { showLatestNovels, filters }: Plugin.PopularNovelsOptions<typeof this.filters>
  ): Promise<Plugin.NovelItem[]> {
    const sortField = showLatestNovels ? "updateTime" : "reads";
    const url = `${API_URL}/content/books/page?sortDirection=DESC&sortField=${sortField}&pageNumber=${pageNo}&pageSize=20`;

    const result = await fetchApi(url);
    const json = await result.json() as any;
    const items = json?.data?.records || [];

    return items.map((item: any) => ({
      name: item.name || item.title || "Unknown",
      cover: item.coverUrl || item.cover || "",
      path: `/book/${item.id}-${slugify(item.name || item.title || "")}`,
    }));
  },

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    // Extract book ID from path like /book/22068-some-title
    const idMatch = novelPath.match(/\/book\/(\d+)/);
    const bookId = idMatch ? idMatch[1] : "";

    const result = await fetchApi(`${API_URL}/users/favor/book/${bookId}`);
    const json = await result.json() as any;
    const book = json?.data || {};

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: book.name || book.title || "Unknown",
      cover: book.coverUrl || book.cover || "",
      summary: book.introduction || book.synopsis || "",
      author: book.author || "",
      status: book.status === "COMPLETED" ? NovelStatus.Completed : NovelStatus.Ongoing,
      genres: (book.tags || []).join(", "),
      chapters: [],
    };

    // Fetch all chapters (paginated, 100 per page)
    const chapters: Plugin.ChapterItem[] = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const chapResult = await fetchApi(
        `${API_URL}/content/chapters/page?sortDirection=ASC&bookId=${bookId}&pageNumber=${pageNumber}&pageSize=100`
      );
      const chapJson = await chapResult.json() as any;
      const records = chapJson?.data?.records || [];

      for (const chap of records) {
        chapters.push({
          name: chap.name || chap.title || `Chapter ${chap.chapterNumber || chap.sort}`,
          path: `/chapter/${chap.id}-${slugify(chap.name || chap.title || "")}`,
          releaseTime: chap.createTime || chap.updateTime || null,
          chapterNumber: chap.chapterNumber || chap.sort || chapters.length + 1,
        });
      }

      // Check if there are more pages
      const total = chapJson?.data?.total || 0;
      hasMore = chapters.length < total && records.length === 100;
      pageNumber++;
    }

    novel.chapters = chapters;
    return novel;
  },

  async parseChapter(chapterPath: string): Promise<string> {
    // Extract chapter ID from path like /chapter/1599309-chapter-1-stableman
    const idMatch = chapterPath.match(/\/chapter\/(\d+)/);
    const chapterId = idMatch ? idMatch[1] : "";

    const result = await fetchApi(`${API_URL}/content/chapters/${chapterId}`);
    const json = await result.json() as any;
    const chap = json?.data || {};

    // Content may be HTML or plain text
    const content = chap.content || chap.text || chap.body || "";

    // Wrap plain text paragraphs in <p> tags if not already HTML
    if (content && !content.includes("<p") && !content.includes("<div")) {
      return content
        .split(/\n+/)
        .filter((p: string) => p.trim())
        .map((p: string) => `<p>${p.trim()}</p>`)
        .join("\n");
    }

    return content;
  },

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${API_URL}/content/books/page?sortDirection=DESC&sortField=reads&pageNumber=${pageNo}&pageSize=20&name=${encodeURIComponent(searchTerm)}`;

    const result = await fetchApi(url);
    const json = await result.json() as any;
    const items = json?.data?.records || [];

    return items.map((item: any) => ({
      name: item.name || item.title || "Unknown",
      cover: item.coverUrl || item.cover || "",
      path: `/book/${item.id}-${slugify(item.name || item.title || "")}`,
    }));
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default BoTiTranslation;
