# 个人 Markdown 仓库 · Engineer's Desk

一个本地优先的 Markdown 文档网站。**左目录 / 中正文 / 右大纲**的三栏 IDE 风格阅读，配**分屏 Markdown 编辑器**实时预览。所有文章以纯 `.md` 文件保存在 `articles/` 目录下，可以直接用 VS Code 编辑、git 版本控制。

## 视觉系统

沿用 Engineer's Desk 设计语言：

- **配色**：米黄纸张底 `#f4f1ea` + 朱砂红 `#a8321e` + 墨黑
- **字体**：Fraunces（衬线标题）+ IBM Plex Sans（正文）+ JetBrains Mono（数字）
- **圆角**：6px（克制，不浮夸）
- **阴影**：极轻，只在 hover 出现

## 目录结构

```
markdown_site/
├─ client/                       # React + Vite 前端
│  └─ src/
│     ├─ App.tsx                # 主入口（路由：欢迎/阅读/编辑）
│     ├─ components/
│     │  ├─ Sidebar.tsx        # 左：分类文件树（默认折叠，点击展开）
│     │  ├─ ArticleView.tsx    # 中：正文渲染 + 顶部元数据
│     │  ├─ Outline.tsx        # 右：滚动联动大纲（可折叠）
│     │  ├─ Editor.tsx         # 分屏 Markdown 编辑器
│     │  └─ ThemeToggle.tsx    # 亮/暗主题切换
│     ├─ lib/
│     │  ├─ api.ts             # fetch 封装
│     │  └─ markdown.ts        # marked 配置 + 大纲提取
│     └─ styles.css            # 设计 token（CSS 变量）
├─ server/
│  ├─ index.js                 # Express 后端，读写 .md（ESM 模块）
│  └─ package.json             # type: module（ESM 标识，必需）
├─ articles/                    # ⭐ 你的内容都存这里
│  ├─ Redis/
│  │  └─ redis-vs-caffeine.md
│  ├─ Java并发/
│  └─ 基础/
├─ package.json                 # 根依赖（express / gray-matter / marked 等）
├─ vite.config.ts              # /api 代理到 :3001
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
tags: [Redis, 缓存, Caffeine]      # 显示在正文顶部
createdAt: 2026-06-26T10:00:00.000Z
updatedAt: 2026-06-26T10:00:00.000Z
---

# 一句话核心结论

正文从这里开始……
```

## 本地开发

```bash
# 1. 装依赖（首次）
npm install

# 2. 启动开发模式（前端 + 后端同启）
npm run dev

# 输出示例：
# [server] listening on http://localhost:3001
# VITE  ready in 412 ms
# ➜  Local:   http://localhost:5173/
```

打开 **http://localhost:5173** 即可。

## 部署上线

### 架构说明

本项目**前后端都在 Node.js 运行时执行**，不是传统的前后端分离部署：

| 组件 | 本地开发 | 生产部署 |
| --- | --- | --- |
| 前端 UI | Vite :5173 | 同进程，由 Express 托管 |
| 后端 API | Express :3001 | **必须**独立运行（读写 articles/） |
| 依赖 | `node_modules/` | **必须**完整上传或重新 `npm install` |

这不是纯静态网站——后端 `server/index.js` 在运行时**动态读取 `articles/` 目录的 `.md` 文件**、解析 frontmatter、转为 HTML 返回给前端。所以服务器必须装 Node.js + 完整 `node_modules`。

### 方式一：一键部署（推荐宝塔/1Panel 等面板）

1. 把项目整个压缩包上传到服务器网站目录（如 `/www/wwwroot/markdown/`）
2. 在面板终端进入该目录：
   ```bash
   cd /www/wwwroot/markdown
   npm install
   ```
3. 运行后端（保持后台运行，用 `screen` / `pm2` / `systemd`）：
   ```bash
   screen -S server
   node server/index.js
   # 按 Ctrl+A D 退出 screen，后端继续在后台运行
   ```
   或用 pm2：
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name markdown-api
   ```
4. 配置 Nginx 反向代理，把外部请求转发到 Node.js：

   ```nginx
   # /www/server/nginx/conf/vhost/your-site.conf
   server {
       listen 80;
       server_name your-domain.com;

       # 前端静态文件
       location / {
           root /www/wwwroot/markdown;
           try_files $uri $uri/ /index.html;
       }

       # API 代理到后端
       location /api/ {
           proxy_pass http://127.0.0.1:3001/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

5. 重载 Nginx：`nginx -s reload`

### 方式二：Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "server/index.js"]
```

```bash
docker build -t markdown-site .
docker run -d -p 3001:3001 -v ./articles:/app/articles markdown-site
```

然后 Nginx 代理 `http://127.0.0.1:3001`。

### 方式三：只部署前端静态文件

如果后端已经在别处运行（如 Docker），可以只部署构建后的前端：

```bash
npm run build       # 生成 dist/ 目录
# 把 dist/ 里的文件上传到任意静态服务器（Nginx/CDN/对象存储）
# 注意修改 vite.config.ts 里的 proxy 配置，或让后端支持 CORS
```

## 端口说明

| 端口 | 服务 | 说明 |
| --- | --- | --- |
| 5173 | Vite (前端) | 仅本地开发使用 |
| 3001 | Express (后端) | 读写 .md 文件，前端通过 `/api/...` 调用 |

## 功能清单

- 📁 **左文件树**：分类默认折叠，点击展开；选中文章自动展开对应分类
- 📖 **中正文**：marked 渲染 GitHub 风格 markdown（GFM）
- 🧭 **右大纲**：从 `# / ## / ###` 抽取，滚动联动高亮，点击平滑跳转；可折叠，动画与左侧一致
- ✏️ **编辑器**：「新建文章」按钮进入分屏，左输入右实时预览
- 💾 **Ctrl/Cmd + S** 发布 / 保存；**Esc** 取消
- 🔍 **查看 .md 源码**：每篇正文底部有按钮
- 🗑 **删除**：右上有删除按钮（带确认）
- 🌙 **暗色主题**：右上角切换，与米黄精装风格对称
- 🤖 **移动端适配**：抽屉式侧边栏 + 响应式布局

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
A: 后端改环境变量 `PORT=3002 node server/index.js`；前端改 `vite.config.ts` 里的 `server.port`。

**Q: 部署后报 `Cannot use import statement outside a module`？**
A: 确保 `server/` 目录下有 `package.json` 且包含 `"type": "module"`（已包含在项目中）。

**Q: 部署后报 `Cannot find package 'express'`？**
A: 服务器上未安装依赖。在项目根目录执行 `npm install` 即可。

**Q: 中文文件名会有问题吗？**
A: 不会。`articles/基础/` 这种目录名直接能用。

**Q: 怎么 git 管理？**
A: 把整个项目目录 git 化，`articles/` 下的 `.md` 文件天然就是 git 友好的纯文本。

**Q: 编辑器能上传图片吗？**
A: 当前版本不支持。图片可以放 `articles/<分类>/assets/` 并在 markdown 里写相对路径 `![](./assets/xxx.png)`。

**Q: 后端能脱离前端独立部署吗？**
A: 能。后端只依赖 `articles/` 目录，把 `server/` + `package.json` + `articles/` 传到服务器即可，前端用 Docker/nginx 单独托管静态文件。

## 环境要求

- **Node.js** ≥ 18（建议 20 LTS）
- **npm** ≥ 9

## 验收情况

- ✅ 后端 `node --check` 语法 OK
- ✅ TypeScript 解析全部 .tsx / .ts 无代码错误
- ✅ API 端到端测试通过：GET/POST/DELETE 全通，磁盘真实读写
- ✅ Front-matter 解析全部成功
- ✅ 大纲提取完整（5~6 个标题/篇）
- ✅ 移动端适配完整（抽屉/响应式/主题切换）
