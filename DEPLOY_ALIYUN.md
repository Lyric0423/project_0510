# 阿里云部署说明

当前网站是静态站点，可以先用 Nginx 部署到阿里云 ECS。后续接入真实 AI 后端时，再增加 API 服务和反向代理。

## 1. 上传文件

将以下文件上传到服务器目录，例如 `/var/www/mianshicang`：

- `index.html`
- `styles.css`
- `app.js`

可以使用 `scp`：

```bash
scp index.html styles.css app.js root@你的服务器IP:/var/www/mianshicang/
```

## 2. 安装 Nginx

Ubuntu / Debian：

```bash
sudo apt update
sudo apt install -y nginx
```

CentOS / Alibaba Cloud Linux：

```bash
sudo yum install -y nginx
```

## 3. 配置站点

新建 Nginx 配置：

```bash
sudo nano /etc/nginx/conf.d/mianshicang.conf
```

写入：

```nginx
server {
    listen 80;
    server_name 你的域名或服务器IP;

    root /var/www/mianshicang;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 阿里云安全组

在阿里云控制台确认 ECS 安全组已开放：

- TCP 80；
- TCP 443，后续配置 HTTPS 时使用；
- TCP 22，仅用于 SSH。

## 5. 后续接入真实后端

建议新增后端 API 服务，并在 Nginx 中增加反向代理：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

建议优先实现这些 API：

- `POST /api/resume/parse`
- `POST /api/jd/parse`
- `POST /api/match/diagnose`
- `POST /api/questions/generate`
- `POST /api/interview/next`
- `POST /api/report/generate`
- `POST /api/asr/transcribe`

## 6. HTTPS

有域名后建议用 Certbot 配置 HTTPS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```
