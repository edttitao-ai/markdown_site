// 浏览器端 fetch 封装。所有请求走 Vite 代理到 :3001

export interface ArticleMeta {
  id: string;
  title: string;
  category: string;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  file: string;
}

export interface Category {
  name: string;
  count: number;
}

export interface ArticleFull {
  meta: ArticleMeta;
  html: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text || res.url}`);
  }
  return res.json() as Promise<T>;
}

export async function getCategories(): Promise<Category[]> {
  const r = await fetch('/api/categories');
  const j = await jsonOrThrow<{ categories: Category[] }>(r);
  return j.categories;
}

export async function getArticles(category: string): Promise<ArticleMeta[]> {
  const r = await fetch(`/api/articles?category=${encodeURIComponent(category)}`);
  const j = await jsonOrThrow<{ articles: ArticleMeta[] }>(r);
  return j.articles;
}

export async function getArticle(category: string, id: string): Promise<ArticleFull> {
  const r = await fetch(`/api/article?category=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`);
  return jsonOrThrow<ArticleFull>(r);
}

export async function getRaw(category: string, id: string): Promise<{ meta: any; body: string }> {
  const r = await fetch(`/api/raw?category=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`);
  return jsonOrThrow<{ meta: any; body: string }>(r);
}

export async function saveArticle(payload: {
  category: string;
  title: string;
  tags: string[];
  body: string;
  id?: string;
}): Promise<{ id: string; file: string; isOverwrite: boolean }> {
  const r = await fetch('/api/article', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(r);
}

export async function deleteArticle(category: string, id: string): Promise<void> {
  const r = await fetch(`/api/article?category=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(`delete failed: ${r.status}`);
}