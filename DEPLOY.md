# 面试题站 · 部署指南

这份文档针对 `mianshiti_site/` 这个 React + Vite + Express 的纯本地优先项目。

## 先看清本质

在选方案之前，先认清这个项目的特殊性：

| 层 | 技术 | 产物 | 部署约束 |
| --- | --- | --- | --- |
| 前端 | React + Vite | `npm run build` → `dist/`（纯静态） | 可放任何 CDN / 静态托管 |
| 后端 | Express + Node 18+ | `node server/index.js` | 必须能**写磁盘**（新建/编辑/删除文章） |
| 内容 | `articles/{分类}/{slug}.md` | 普通文件 | 必须**持久化**，否则写入会丢 |

**这意味着什么？** 你必须有一个能跑 Node 进程、能挂持久磁盘的环境。Vercel / Netlify Functions / Cloudflare Workers 这类纯 serverless + 只读磁盘的平台**直接不能用**（除非改造后端，改成提交到 GitHub 或写到对象存储，这是另一个工程量）。

下面按"省心程度从高到低"列方案。

---

## 方案 A · 自有服务器 + PM2 + Nginx（推荐）

最贴合项目当前结构，几乎零改动。适合你有一台云服务器（腾讯云轻量、阿里云 ECS、Vultr、DigitalOcean 都行，2C2G 就够）。

### 服务器准备

```bash
# Ubuntu 22.04 为例
sudo apt update && sudo apt install -y nodejs npm nginx git
# 建议用 nvm 装 Node 20 LTS，避免 apt 版太旧
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

### 上代码

```bash
cd /srv
sudo git clone <你的仓库地址> mianshiti_site
cd mianshiti_site
npm ci --omit=dev   # 只要运行时依赖，省几百 MB
npm run build       # 出 dist/
```

### 进程守护（PM2）

```bash
sudo npm i -g pm2
PORT=3001 pm2 start server/index.js --name mianshiti-api
pm2 startup && pm2 save
```

### Nginx 反向代理

`/etc/nginx/sites-available/mianshiti`：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 静态前端
    root /srv/mianshiti_site/dist;
    index index.html;

    # SPA fallback —— 刷新不 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API + 文章静态资源
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /articles/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    # 静态资源缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mianshiti /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS（强烈建议）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 更新流程

```bash
cd /srv/mianshiti_site
git pull
npm ci --omit=dev
npm run build
pm2 restart mianshiti-api
```

**优点**：完全保留当前代码，磁盘读写照常工作，零改造。
**成本**：云服务器 ≈ ¥30-60/月（国内）/ $6/月（海外）。

---

## 方案 B · Docker 镜像 → 任意容器平台

把项目打成镜像，部署到腾讯云容器服务 / 阿里云 ACK / Railway / Fly.io / Render 都行。本质上是 A 方案的容器化版本。

### `Dockerfile`（新增到项目根目录）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist
COPY articles ./articles

EXPOSE 3001
CMD ["node", "server/index.js"]
```

### `server/index.js` 加 SPA fallback（必须）

当前后端只 serve `/api` 和 `/articles`，刷新非根路由会 404。在文件末尾、`app.listen` 之前加：

```js
// 生产模式：把 dist/ 也交给 Express，省一层 Nginx
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api|\/articles).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}
```

### `.dockerignore`

```
node_modules
dist
.git
.idea
*.log
```

### 跑起来

```bash
docker build -t mianshiti-site:latest .
docker run -d -p 3001:3001 -v $(pwd)/articles:/app/articles --name mianshiti mianshiti-site:latest
```

`-v $(pwd)/articles:/app/articles` 这一行是**关键** —— 把宿主机的文章目录挂进去，否则容器重启你的文章全没了。

部署到平台时同理：挂一个持久卷到 `/app/articles`。

**优点**：一套镜像到处跑，更新只 rebuild。
**成本**：Railway / Fly.io 免费档够用，但免费档磁盘不持久（重启就丢文章），得用他们的挂载卷方案（约 $1/月）。

---

## 方案 C · 纯静态托管（GitHub Pages / Vercel / Netlify）

**只能用在你不需要在线新建/编辑/删除文章的子集场景** —— 比如你只在本地写好 `.md`，推 git，线上只读。

需要改造：

1. 把后端的 `marked` + front-matter 解析挪到前端（用 `gray-matter` 的浏览器版 + 同样配置的 `marked`），前端启动时拉一份 `articles-index.json`。
2. 或者更简单：写个 build 期脚本，在 `npm run build` 时跑一次 `server/index.js` 的逻辑，把所有文章预渲染成 JSON 产物。

这个改造工作量大约 2-4 小时，但会让项目失去"在线编辑器"。**个人项目且只用本地写 md 的场景才建议**。代码里也没有 read-only 模式开关，得自己加。

不推荐作为首选。

---

## 方案 D · GitHub Pages + Actions 自动构建

方案 C 的 GitHub 专属版。

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      # 这里跑方案 C 第 2 步的预渲染脚本
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

**缺点**：和 C 一样，线上无编辑器。

---

## 推荐选择

| 你的情况 | 选 |
| --- | --- |
| 有云服务器 / 想长期持有自己的内容 | **A**（PM2 + Nginx） |
| 想"开箱即用"按月付费、不想管服务器 | **B**（Docker → Railway / Fly.io，挂 $1/月卷） |
| 只在本地写文章、线上纯展示 | **C 或 D**（要改造代码） |

如果让我替你拍板：**A**，5 分钟出活，磁盘天然持久，文章一辈子不丢。

---

## 上线后的小事

- **端口**：公网只开 80/443，3001 走 Nginx 反代，永远别把 3001 暴露到公网
- **备份**：`articles/` 整个目录就是你的内容，`tar -czf articles-$(date +%F).tar.gz articles/` 定时扔到对象存储；反正 git 也在管，理论上不会丢
- **首次启动 `articles/` 为空**：后端已经做了 `ensureDir(ARTICLES_DIR)`，线上第一次启动会自动建空目录
- **日志**：`pm2 logs mianshiti-api`（方案 A）/ `docker logs mianshiti`（方案 B）

---

## 如果以后想加在线编辑器 + 公网可写

升级路径（不在本次范围内）：

1. 后端加 `JWT` 鉴权 + 写一个简单的管理密码
2. 把 Express 拆出来部署（前端纯静态托管，后端跑在 VPS 上）
3. 反代 `/api/` 到后端域名，跨域要 `app.use(cors({ origin: 'https://yourdomain.com' }))`

到那时再决定不迟。先把"能打开看"这步搞定就行。