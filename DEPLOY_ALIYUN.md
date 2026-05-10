# 阿里云部署说明

当前版本包含 Node.js 后端：既托管前端静态文件，也提供 `/api/ai/task` 大模型代理。推荐用 Node.js + Nginx 反向代理部署到阿里云 ECS。

## 1. 上传文件

将项目上传到服务器目录，例如 `/var/www/mianshicang`。

需要上传：

- `index.html`
- `styles.css`
- `app.js`
- `server.js`
- `prompts.js`
- `package.json`
- `.env.example`

示例：

```bash
scp -r . root@你的服务器IP:/var/www/mianshicang/
```

## 2. 安装 Node.js

建议 Node.js 18 或以上。

Ubuntu / Debian 可用 NodeSource：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

检查：

```bash
node -v
npm -v
```

## 3. 配置大模型 API Key

推荐先用阿里云百炼 OpenAI 兼容接口。

```bash
cd /var/www/mianshicang
export PORT=5173
export LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export LLM_MODEL="qwen-plus"
export LLM_API_KEY="你的API_KEY"
npm start
```

如果暂时没有 API Key，也可以启动，前端会使用本地规则兜底。

## 4. 使用 systemd 常驻运行

新建服务：

```bash
sudo nano /etc/systemd/system/mianshicang.service
```

写入：

```ini
[Unit]
Description=Mianshicang AI MVP
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/mianshicang
Environment=PORT=5173
Environment=LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
Environment=LLM_MODEL=qwen-plus
Environment=LLM_API_KEY=替换成你的API_KEY
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable mianshicang
sudo systemctl start mianshicang
sudo systemctl status mianshicang
```

## 5. 安装并配置 Nginx

安装：

```bash
sudo apt update
sudo apt install -y nginx
```

新建配置：

```bash
sudo nano /etc/nginx/conf.d/mianshicang.conf
```

写入：

```nginx
server {
    listen 80;
    server_name 你的域名或服务器IP;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 阿里云安全组

在阿里云控制台确认 ECS 安全组已开放：

- TCP 80；
- TCP 443，后续配置 HTTPS 时使用；
- TCP 22，仅用于 SSH。

不要对公网开放 Node.js 的 5173 端口，公网只暴露 Nginx 的 80/443。

## 7. HTTPS

有域名后建议用 Certbot 配置 HTTPS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

## 8. 健康检查

部署后访问：

```text
http://你的域名或IP/api/health
```

如果返回 `llmConfigured: true`，说明大模型 API Key 已被服务读取。
