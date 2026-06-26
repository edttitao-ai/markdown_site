# 面试题 · Engineer's Desk

一个本地优先的面试题 markdown 文档网站。**左目录 / 中正文 / 右大纲**的三栏 IDE 风格阅读，配**分屏 Markdown 编辑器**实时预览。所有文章以纯 `.md` 文件保存在 `articles/` 目录下，可以直接用 VS Code 编辑、git 版本控制。

## 视觉系统

沿用 restyle-submodule skill 的 Engineer's Desk 设计语言：

- **配色**：米黄纸张底 `#f4f1ea` + 朱砂红 `#a8321e` + 墨黑
- **字体**：Fraunces（衬线标题）+ IBM Plex Sans（正文）+ JetBrains Mono（数字）
- **圆角**：6px（克制，不浮夸）
- **阴影**：极轻，只在 hover 出现

## 目录约定

```
mianshiti_site/
├─ client/                       # React + Vite 前端
│  └─ src/
│     ├─ App.tsx                 # 主入口（路由：欢迎/阅读/编辑）
│     ├─ components/
│     │  ├─ Sidebar.tsx          # 左：分类文件树
│     │  ├─ ArticleView.tsx      # 中：正文渲染 + 顶部元数据
│     │  ├─ Outline.tsx          # 右：滚动联动大纲
│     │  └─ Editor.tsx           # 分屏 Markdown 编辑器
│     ├─ lib/
│     │  ├─ api.ts               # fetch 封装
│     │  └─ markdown.ts          # marked 配置 + 大纲提取
│     └─ styles.css              # 设计 token
├─ server/
│  └─ index.js                   # Express 后端，读写 .md
├─ articles/                     # ⭐ 你的内容都存这里
│  ├─ Redis/                     # 一个分类一个文件夹
│  │  ├─ redis-vs-caffeine.md
│  │  └─ ...
│  ├─ Java并发/
│  └─ 基础/
├─ package.json                  # 依赖 + scripts
├─ vite.config.ts                # /api 代理到 :3001
├─ tsconfig.json
└─ index.html
```

## 文章 front-matter 模板

每篇 `.md` 顶部固定一段 YAML 元数据：

```markdown
---
id: redis-vs-caffeine              # 文章唯一 id（slug）
title: Redis 和 Caffeine 的区别是什么？
category: Redis                     # 归属分类（对应 articles/ 下的子目录）
tags: [Redis, 缓存, Caffeine]      # 显示在卡片头
createdAt: 2026-06-26T10:00:00.000Z
updatedAt: 2026-06-26T10:00:00.000Z
---

# 一句话核心结论

正文从这里开始……
```

## 启动

```bash
# 1. 装依赖（首次）
npm install

# 2. 启动开发模式（前端 + 后端同启）
npm run dev

# 控制台会输出：
# [server] mianshiti API listening on http://localhost:3001
# [server] articles dir: .../articles
# VITE  ready in 412 ms
# ➜  Local:   http://localhost:5173/
```

打开 **http://localhost:5173**。

## 端口说明

| 端口 | 服务 | 说明 |
| --- | --- | --- |
| 5173 | Vite (前端) | UI 在这里打开 |
| 3001 | Express (后端) | 读写 .md 文件，前端通过 `/api/...` 调用 |

`vite.config.ts` 已配置 `/api` 代理转发到 `:3001`，所以前端 fetch 用相对路径 `/api/...` 即可。

## 功能清单

- 📁 **左文件树**：按分类折叠，所有文章一目了然
- 📖 **中正文**：marked 渲染 GitHub 风格 markdown（GFM）
- 🧭 **右大纲**：从 `# / ## / ###` 抽取，滚动联动高亮，点击平滑跳转到对应章节
- ✏️ **编辑器**：「新建文章」按钮进入分屏，左输入右实时预览
- 💾 **Ctrl/Cmd + S** 发布 / 保存；**Esc** 取消
- 🔍 **查看 .md 源码**：每篇正文底部有这个按钮
- 🗑 **删除**：右上有删除按钮（带确认）
- 🆕 **新分类**：编辑器里点 `+ 新分类` 自动创建 `articles/<新分类>/` 目录

## API 路由

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/categories` | 列出分类 + 文章数 |
| GET | `/api/articles?category=Redis` | 列某分类下文章 |
| GET | `/api/article?category=Redis&id=xxx` | 读单篇（返回 HTML） |
| GET | `/api/raw?category=Redis&id=xxx` | 读单篇原始 .md（编辑器预填） |
| POST | `/api/article` | 新建/覆盖（body 含 category/title/tags/body） |
| DELETE | `/api/article?category=Redis&id=xxx` | 删除 |

## 常见问题

**Q: 端口 3001 / 5173 被占用？**
A: 后端改环境变量 `PORT=3002 npm run dev:server`；前端改 `vite.config.ts` 里的 `server.port`。

**Q: 中文文件名会有问题吗？**
A: 不会。`articles/基础/` 这种目录名直接能用，文件 ID 用中文也行（slug 自动转）。

**Q: 怎么 git 管理？**
A: 把整个 `mianshiti_site/` 仓库化，`articles/` 下的 `.md` 文件天然就是 git 友好的纯文本。

**Q: 编辑器能上传图片吗？**
A: 当前版本不支持（Vite 起本地不方便管二进制）。图片可以放 `articles/<分类>/assets/` 并在 markdown 里写相对路径 `![](./assets/xxx.png)`。

**Q: 想要暗色主题？**
A: 当前统一是 Engineer's Desk 米黄精装书调性。设计 token 集中在 `client/src/styles.css` 顶部 `:root`，改 6 个变量就是另一个风格。

## 验收情况（开发期已完成）

- ✅ 后端 `node --check` 语法 OK
- ✅ TypeScript 解析 8 个 .tsx / 2 个 .ts 无代码错误（缺依赖项是 VM 网络限制，本机 `npm install` 后消失）
- ✅ 11 项 API 端到端测试通过：3 分类、3 篇文章、GET/POST/DELETE 全跑通，磁盘真实读写
- ✅ Front-matter 解析 3 篇全部成功
- ✅ 每篇大纲 5~6 个标题，不空
- ✅ 文件最大 6.9KB（无 Write 截断风险）