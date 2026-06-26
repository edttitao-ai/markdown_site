# 宝塔面板部署操作指南

本文针对一台**全新的、刚装好宝塔面板**的云服务器（Ubuntu 22.04 / Debian 11 通用），按面板里的实际菜单顺序一步步带你把 `mianshiti_site/` 部署上线。

**预计时间：30-45 分钟。** 主要是装环境慢，操作本身很快。

---

## 0 · 前置条件

| 项 | 怎么搞 |
| --- | --- |
| 云服务器 | 腾讯云轻量 / 阿里云 ECS / 华为云，2C2G 起步，系统选 Ubuntu 22.04 |
| 宝塔面板 | 服务器厂商控制台一键安装，或 ssh 装：<br>`wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec` |
| 域名 + 解析 | 一个域名解析到服务器公网 IP（A 记录） |
| 安全组 / 防火墙 | 公网放行 80 / 443 / 22，宝塔自己用 8888（默认） |

> 厂商控制台的安全组和系统里的 ufw/firewalld 要**同时开**才能通。

---

## 1 · 装好宝塔后第一次进面板要做的事

浏览器打开面板地址（`http://你的IP:8888/安全入口`），登录后通常会弹"推荐安装套件"。

### 1.1 必装软件（软件商店里）

| 软件 | 推荐版本 | 用途 |
| --- | --- | --- |
| **Nginx** | 1.24+ | 反向代理 + SSL 终结 |
| **PM2 管理器** | 最新 | 守护 Node 进程 + 开机自启 |
| **Node.js 版本管理器** | 最新 | 装 Node 20 LTS |

> 不要装 MySQL / PHP / Tomcat —— 浪费磁盘，本项目纯 Node。

### 1.2 装 Node 20

左侧菜单「Node 版本管理器」→「版本管理」→ 找到 **Node 20.x LTS** → 一键安装 → 命令行版本切到 20。

或者在终端里验证：`node -v` 应输出 `v20.x.x`。

---

## 2 · 上传代码

### 方式 A：用宝塔「文件」上传（推荐新手）

1. 左侧菜单「文件」→ 顶部路径切到 `/www/wwwroot/`
2. 右上「上传」→ 拖拽你的项目 zip（先在本地 `mianshiti_site/` 目录里压缩成 zip，**不要把 node_modules 打包**，省 100+ MB）
3. 上传完右键解压

最终目录：`/www/wwwroot/mianshiti_site/`

### 方式 B：git 拉取（推荐熟手）

宝塔「终端」→

```bash
cd /www/wwwroot/
# 改成你的仓库地址
sudo git clone https://github.com/你的用户名/mianshiti_site.git
sudo chown -R www:www mianshiti_site
```

---

## 3 · 装依赖 + 构建前端

宝塔「终端」→

```bash
cd /www/wwwroot/mianshiti_site
# 1. 装运行时依赖（express / marked / gray-matter / cors）
npm install --omit=dev
# 2. 装 dev 依赖（vite / react / typescript）才能 build
npm install
# 3. 构建前端 → 生成 dist/
npm run build
```

**验证 build 成功**：

```bash
ls dist/
# 应该看到：index.html  assets/
```

> 如果 build 报错 "Cannot find module ..."，说明第 2 步 `npm install` 没装全，删 `node_modules` 重来。

---

## 4 · 用 PM2 跑后端

左侧菜单「PM2 管理器」→ 顶部「添加项目」→ 填：

| 字段 | 值 |
| --- | --- |
| 项目名称 | `mianshiti-api` |
| 运行目录 | `/www/wwwroot/mianshiti_site` |
| 启动文件 | `server/index.js` |
| 项目端口 | `3001` |
| **环境变量** | 点「添加」→ 名字 `NODE_ENV`、值 `production` |
| 启动方式 | 选 `fork`（单进程就够） |

点「提交」→ 等 2 秒 → 列表里 `mianshiti-api` 应该是 `online` 状态。

**点「日志」看启动输出**，应该看到：

```
[server] mianshiti API listening on http://localhost:3001
[server] articles dir: /www/wwwroot/mianshiti_site/articles
[server] serving SPA from: /www/wwwroot/mianshiti_site/dist
```

> ⚠️ **必须看到 `serving SPA from:` 这一行**。没有这一行说明 NODE_ENV 没生效，SPA 路由刷新会 404。

**冒烟测试**（在宝塔终端里跑）：

```bash
curl http://127.0.0.1:3001/api/health
# 应输出 {"ok":true,...}
curl http://127.0.0.1:3001/
# 应输出 HTML 而不是 "Cannot GET /"
```

---

## 5 · 建网站（反代 3001）

左侧菜单「网站」→「添加站点」：

| 字段 | 值 |
| --- | --- |
| 域名 | 你的域名（如 `mianshiti.example.com`） |
| 根目录 | `/www/wwwroot/mianshiti_site/dist` ← **关键** |
| FTP / 数据库 | **不创建** |
| PHP 版本 | 纯静态 |

点「提交」。

### 5.1 改反代

刚加完站点，「网站」列表里点你这域名那一行 → 「设置」→「反向代理」选项卡 → 「添加反向代理」：

| 字段 | 值 |
| --- | --- |
| 代理名称 | `node` |
| 目标 URL | `http://127.0.0.1:3001` |
| 发送域名 | `$host` |
| **代理目录** | `/`（默认就是） |

点「提交」。宝塔会自动改 Nginx 配置。

### 5.2 让反代也能 serve 静态（关键）

默认反代会把所有请求转发给 Node，但 `dist/assets/*.js` 其实可以直接由 Nginx serve，更快。

「设置」→「配置文件」（一个文本编辑器），把整个 `server` 块替换成下面这段：

```nginx
server {
    listen 80;
    server_name mianshiti.example.com;

    # 1. 静态前端资源（最长缓存）
    location /assets/ {
        root /www/wwwroot/mianshiti_site/dist;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 2. 图片资源（/articles/ 走反代到 Node，因为 articles/ 在项目根不在 dist/）
    location /articles/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 3. API 走反代
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 4. 其他全部走反代（包括 / 这种 SPA 入口）
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 宝塔会自己加 SSL 配置段，先不用管
}
```

保存。宝塔里改完配置它会**自动 reload Nginx**。

**冒烟测试**：

```bash
curl -I http://mianshiti.example.com/
# 应输出 200 OK
curl http://mianshiti.example.com/api/health
# 应输出 {"ok":true,...}
```

---

## 6 · 上 HTTPS（强烈建议）

「设置」→「SSL」→「Let's Encrypt」选项卡 → 勾选域名 → 点「申请」。

成功后切到「强制 HTTPS」开关 → 开启。

> Let's Encrypt 失败常见原因：域名没解析到这台服务器 / 80 端口没通。`curl -I http://mianshiti.example.com/` 必须 200 才能签。

---

## 7 · 防火墙放行

宝塔「安全」选项卡 → 放行端口 80、443。**3001 端口绝对不要放行到公网**，只允许本机访问。

---

## 8 · 日常维护

### 更新代码

```bash
cd /www/wwwroot/mianshiti_site
# git 用户：
sudo git pull && sudo npm install && sudo npm run build
# zip 上传用户：用宝塔「文件」覆盖 → 终端跑 npm install + npm run build
# 重启进程：
pm2 restart mianshiti-api   # 或在 PM2 管理器界面点「重载」
```

### 备份 articles

宝塔「计划任务」→ 添加任务：

| 字段 | 值 |
| --- | --- |
| 任务类型 | Shell 脚本 |
| 任务名称 | `备份面试题文章` |
| 执行周期 | 每天 03:00 |
| 脚本内容 | 见下 |

```bash
tar -czf /www/backup/articles-$(date +\%F).tar.gz -C /www/wwwroot/mianshiti_site articles/
find /www/backup/articles-*.tar.gz -mtime +30 -delete
```

> `articles/` 本身就是 git 管的话，这条可省；保留这条是双保险。

### 看日志

宝塔「PM2 管理器」→ 项目那一行右侧「日志」按钮 → 看实时 stdout / stderr。

Nginx 错误日志在「网站」→「设置」→「日志」。

---

## 9 · 常见坑速查

| 现象 | 原因 | 解法 |
| --- | --- | --- |
| 进首页白屏，看 console 报 404 | SPA fallback 没生效 | 检查 NODE_ENV 是否设为 production，重启 PM2 |
| `/api/health` 502 | PM2 项目挂了或端口不对 | PM2 管理器看状态；`curl 127.0.0.1:3001/api/health` 验证 |
| 在线编辑文章后没出现 | `articles/` 没写权限 | `chown -R www:www /www/wwwroot/mianshiti_site/articles` |
| 图片加载 404 | `/articles/` 反代没配 | 回到 5.2 步 |
| Let's Encrypt 申请失败 | 80 端口不通 / 域名没解析 | 域名 dig 看一下；Nginx 配置先保持 HTTP 可访问 |
| 中文文件名乱码 | 系统 locale 不是 UTF-8 | `locale -a | grep zh`；宝塔终端一般默认 OK |
| npm install 报 ETARGET | Node 版本太老 | PM2 管理器或 nvm 装 Node 20 LTS，重启终端 |
| build 完 dist 是空的 | `vite build` 报错但被吞了 | 直接在终端跑 `npm run build` 看完整输出 |

---

## 10 · 完整流程一张图

```
浏览器 → :443 Nginx (TLS)
            ↓ 反代
         :3001 Node (PM2 守护)
            ↓ 读写
        /www/wwwroot/mianshiti_site/articles/*.md
```

中间任何一个环节断了都能在对应章节查。

---

## 11 · 第一次部署后自检清单

挨条过一遍：

- [ ] `https://你的域名/` 打开看到 Engineer's Desk 米黄界面
- [ ] 左侧文件树能看到分类和文章
- [ ] 浏览器 console 无红色报错（network 面板 `/api/...` 都 200）
- [ ] 在线编辑器里写一篇测试文章，能存盘，`articles/<分类>/` 下出现对应 `.md` 文件
- [ ] 刷新任意一篇正文 URL，**不会 404**（SPA fallback 生效的标志）
- [ ] PM2 管理器里 `mianshiti-api` 状态 `online`
- [ ] 服务器重启后 PM2 自动拉起（`pm2 startup` 已生效）

全勾上就部署完成。