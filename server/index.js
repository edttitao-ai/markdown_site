// Express 后端：把 articles/ 目录的 .md 文件以 REST 形式暴露给前端
// 文件布局：articles/{category}/{slug}.md
// front-matter 字段：id, title, category, tags[], createdAt, updatedAt

import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const PORT = Number(process.env.PORT) || 3001;

// ---------- helpers ----------
function safeId(input) {
  // 把标题转成稳定 id：只保留中英文/数字/_/-, 多余的换成 -
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '');
  return s || `untitled-${Date.now()}`;
}

// 与 client/src/lib/markdown.ts 共用的 slug 规则：
// 把非 字母/数字/空白/-/_ 去掉再小写化,把空白合为 -
function makeHeadingId(text, slugCount) {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, '')
    .replace(/\s+/g, '-');
  const n = slugCount.get(base) || 0;
  slugCount.set(base, n + 1);
  return n === 0 ? base : base + '-' + n;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 给 marked 装一个和客户端完全一致的 heading renderer,这样正文里的 h1/h2/h3 都会带上 id,
// 客户端的 extractOutline 算出来的 id 才能在 DOM 里找到。
const slugCount = new Map();
const serverRenderer = new marked.Renderer();
serverRenderer.heading = function (token) {
  const id = makeHeadingId(token.text, slugCount);
  return (
    '<h' + token.depth + ' id="' + escapeHtml(id) + '">' + token.text + '</h' + token.depth + '>'
  );
};

function renderArticleHtml(md, category) {
  slugCount.clear();
  const html = marked.parse(md, { renderer: serverRenderer, gfm: true, breaks: false });
  // 重写 <img src="相对路径"> 为 <img src="/articles/{category}/相对路径">
  // 原因：marked 原样输出 <img>，相对路径是相对于 .md 文件的，但浏览器把它解析为
  // 相对于当前 URL（http://localhost:5173/...），导致 404。改成绝对路径后由后端静态服务接管
  if (category) {
    return html.replace(
      /<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi,
      (_match, pre, src, post) => {
        // 已经是 http:// https:// data: / 开头的绝对 URL,不动
        if (/^(https?:|data:|\/)/i.test(src)) {
          return `<img ${pre}src="${src}"${post}>`;
        }
        return `<img ${pre}src="/articles/${category}/${src}"${post}>`;
      },
    );
  }
  return html;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readCategoryDir(category) {
  const dir = path.join(ARTICLES_DIR, category);
  if (!fsSync.existsSync(dir)) return [];
  const files = await fs.readdir(dir);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(dir, f);
    const raw = await fs.readFile(full, 'utf8');
    const fm = matter(raw);
    const data = fm.data || {};
    out.push({
      id: data.id || path.basename(f, '.md'),
      title: data.title || path.basename(f, '.md'),
      category,
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      file: f,
    });
  }
  // 按 updatedAt 倒序，没有就按 title
  out.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    return a.title.localeCompare(b.title);
  });
  return out;
}

function toFM({ id, title, category, tags, createdAt, updatedAt }) {
  const fm = {
    id,
    title,
    category,
    tags: Array.isArray(tags) ? tags : [],
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
  };
  return matter.stringify('', fm);
}

// ---------- app ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
// 把 articles/ 整个目录暴露成 /articles 静态资源
// 前端 markdown 里的 <img src="相对路径"> 会被重写为 /articles/{category}/相对路径
app.use('/articles', express.static(ARTICLES_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, articlesDir: ARTICLES_DIR });
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    await ensureDir(ARTICLES_DIR);
    const entries = await fs.readdir(ARTICLES_DIR, { withFileTypes: true });
    const cats = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const articles = await readCategoryDir(e.name);
      cats.push({
        name: e.name,
        count: articles.length,
      });
    }
    cats.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    res.json({ categories: cats });
  } catch (err) {
    next(err);
  }
});

app.get('/api/articles', async (req, res, next) => {
  try {
    const category = req.query.category;
    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'category required' });
    }
    const articles = await readCategoryDir(category);
    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

app.get('/api/article', async (req, res, next) => {
  try {
    const { category, id } = req.query;
    if (!category || !id) return res.status(400).json({ error: 'category & id required' });
    const dir = path.join(ARTICLES_DIR, String(category));
    if (!fsSync.existsSync(dir)) return res.status(404).json({ error: 'category not found' });

    const files = await fs.readdir(dir);
    let target = null;
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const fm = matter(raw);
      if ((fm.data?.id || path.basename(f, '.md')) === id) {
        target = { f, raw, fm };
        break;
      }
    }
    if (!target) return res.status(404).json({ error: 'article not found' });

    const data = target.fm.data || {};
    const html = renderArticleHtml(target.fm.content, category);
    res.json({
      meta: {
        id: data.id || path.basename(target.f, '.md'),
        title: data.title || path.basename(target.f, '.md'),
        category,
        tags: data.tags || [],
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        file: target.f,
      },
      html,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/raw', async (req, res, next) => {
  try {
    const { category, id } = req.query;
    if (!category || !id) return res.status(400).json({ error: 'category & id required' });
    const dir = path.join(ARTICLES_DIR, String(category));
    if (!fsSync.existsSync(dir)) return res.status(404).json({ error: 'category not found' });
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const fm = matter(raw);
      if ((fm.data?.id || path.basename(f, '.md')) === id) {
        return res.json({
          meta: fm.data || {},
          body: fm.content,
        });
      }
    }
    res.status(404).json({ error: 'article not found' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/article', async (req, res, next) => {
  try {
    const { category, title, tags, body, id: providedId } = req.body || {};
    if (!category || !title) {
      return res.status(400).json({ error: 'category & title required' });
    }
    if (!fsSync.existsSync(path.join(ARTICLES_DIR, category))) {
      // 新分类自动建目录
      await ensureDir(path.join(ARTICLES_DIR, category));
    }
    const id = providedId || safeId(title);
    const filename = `${safeId(id)}.md`;
    const fullPath = path.join(ARTICLES_DIR, category, filename);
    const isOverwrite = fsSync.existsSync(fullPath);

    let createdAt;
    if (isOverwrite) {
      const old = await fs.readFile(fullPath, 'utf8');
      createdAt = matter(old).data?.createdAt || new Date().toISOString();
    } else {
      createdAt = new Date().toISOString();
    }

    const fm = toFM({
      id,
      title,
      category,
      tags,
      createdAt,
      updatedAt: new Date().toISOString(),
    });
    const fileContent = fm + '\n' + (body || '').replace(/^\n+/, '');
    await fs.writeFile(fullPath, fileContent, 'utf8');
    res.json({ ok: true, id, file: filename, category, isOverwrite });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/article', async (req, res, next) => {
  try {
    const { category, id } = req.query;
    if (!category || !id) return res.status(400).json({ error: 'category & id required' });
    const dir = path.join(ARTICLES_DIR, String(category));
    if (!fsSync.existsSync(dir)) return res.status(404).json({ error: 'category not found' });
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const fm = matter(raw);
      if ((fm.data?.id || path.basename(f, '.md')) === id) {
        await fs.unlink(path.join(dir, f));
        return res.json({ ok: true });
      }
    }
    res.status(404).json({ error: 'article not found' });
  } catch (err) {
    next(err);
  }
});

// ---------- error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'internal error' });
});

// ---------- production static + SPA fallback ----------
// 生产模式（NODE_ENV=production）下，把 dist/ 也交给 Express，
// 同时把非 /api、非 /articles 的所有 GET 兜底到 index.html，避免刷新 404。
// 本地开发仍走 Vite dev server，不受影响。
if (process.env.NODE_ENV === 'production') {
  const DIST_DIR = path.resolve(ROOT, 'dist');
  app.use(express.static(DIST_DIR, { maxAge: '7d' }));
  app.get(new RegExp('^(?!/api|/articles).*'), (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// ---------- listen ----------
app.listen(PORT, () => {
  console.log(`[server] mianshiti API listening on http://localhost:${PORT}`);
  console.log(`[server] articles dir: ${ARTICLES_DIR}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`[server] serving SPA from: ${path.resolve(ROOT, 'dist')}`);
  }
});
