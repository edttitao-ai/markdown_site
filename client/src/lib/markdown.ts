// Markdown 渲染 + 大纲提取
// 适配 marked v15+ 的 renderer API (token 对象签名)

import { marked, Tokens } from 'marked';

const slugCount = new Map<string, number>();

function makeSlug(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, '')
    .replace(/\s+/g, '-');
  const n = slugCount.get(base) || 0;
  slugCount.set(base, n + 1);
  return n === 0 ? base : base + '-' + n;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const renderer = new marked.Renderer();

// marked v15: heading 签名是 ({ tokens, depth, text, raw }) => string
renderer.heading = function (token: Tokens.Heading) {
  const id = makeSlug(token.text);
  // token.text 已经被 marked 转义过了，但保险起见再 escape 一次
  return '<h' + token.depth + ' id="' + escapeHtml(id) + '">' + token.text + '</h' + token.depth + '>';
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  slugCount.clear();
  return marked.parse(md) as string;
}

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

// 从 markdown 源里抽取 # ## ### 标题大纲
// 与 renderer 共享同一套 slug 规则，保证 outline.id 和正文中 id 一致
// 关键：跟踪 ``` 代码块状态，代码块内的 # 注释行不算标题
export function extractOutline(md: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  const lines = md.split('\n');
  const seen = new Map<string, number>();
  let inCode = false;
  for (const line of lines) {
    // ``` 围栏代码块：行首 ``` 或 ~~~（支持 ```js、 ```java 等带语言名）
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/`/g, "").trim();
    const base = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s\-_]/gu, '')
      .replace(/\s+/g, '-');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    const id = n === 0 ? base : base + '-' + n;
    out.push({ id, text, level });
  }
  return out;
}
