# 阿里云部署说明

本文档说明如何把面试舱 AI 部署到阿里云 ECS，并通过 Nginx 对公网提供访问。

推荐架构：

- Node.js 负责静态文件、AI 代理、语音代理和报告导出；
- Nginx 负责公网入口、反向代理和后续 HTTPS；
- `.env` 或 systemd 环境变量负责密钥配置；
- 不直接向公网暴露 Node.js 端口。

## 1. 准备服务器

建议环境：

- Ubuntu / Debian；
- Node.js 18 或以上；
- Nginx；
- 一个已经解析到 ECS 的域名，或直接使用服务器公网 IP。

安装 Node.js 示例：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2. 上传项目

示例目录：

```bash
/var/www/mianshicang
```

上传代码：

```bash
scp -r . root@你的服务器IP:/var/www/mianshicang/
```

进入项目并安装依赖：

```bash
cd /var/www/mianshicang
npm ci
```

如果没有提交 `package-lock.json`，可改用：

```bash
npm install
```

## 3. 配置环境变量

复制示例文件：

```bash
cd /var/www/mianshicang
cp .env.example .env
nano .env
```

按需填写：

```bash
PORT=5173

LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=你的DeepSeek_API_KEY

ALIYUN_ACCESS_KEY_ID=你的阿里云AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=你的阿里云AccessKeySecret
ALIYUN_NLS_APPKEY=你的智能语音交互AppKey
ALIYUN_NLS_URL=wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1
ALIYUN_NLS_VOICE=aixia

PDF_FONT_PATH=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

保护 `.env`：

```bash
chmod 600 .env
```

如果暂时没有 API Key，也可以启动项目，基础诊断和题库会使用本地规则兜底；语音功能会提示未配置。

## 4. 本地启动测试

```bash
npm start
```

访问健康检查：

```text
http://你的服务器IP:5173/api/health
```

确认可用后停止前台进程，继续配置 systemd。

## 5. 使用 systemd 常驻运行

新建服务：

```bash
sudo nano /etc/systemd/system/mianshicang.service
```

写入：

```ini
[Unit]
Description=Mianshicang AI
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/mianshicang
EnvironmentFile=/var/www/mianshicang/.env
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

查看日志：

```bash
journalctl -u mianshicang -f
```

## 6. 配置 Nginx

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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 语音识别 WebSocket 需要 Upgrade 头。
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 阿里云安全组

在阿里云控制台开放：

- TCP 80；
- TCP 443；
- TCP 22，仅用于 SSH。

不要对公网开放 Node.js 的 5173 端口。公网只暴露 Nginx 的 80/443。

## 8. 配置 HTTPS

有域名后建议使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

## 9. 验证

访问：

```text
http://你的域名或IP/api/health
```

重点检查：

- 页面能正常打开；
- `/api/health` 返回服务状态；
- 生成诊断时，如果大模型未配置，会有明确提示并降级；
- 语音识别/合成未配置时，文字面试仍可使用；
- DOCX/PDF 导出能下载文件。

## 10. 发布前安全检查

```bash
git status --ignored --short
```

确认：

- `.env` 显示为 ignored；
- 不要提交真实 API Key；
- 不要提交私人简历、测试材料或本地缓存；
- 如密钥曾经泄露，请先到对应平台轮换。
