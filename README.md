# 面试舱 AI - 大厂实习版 MVP

面试舱 AI 是一个面向本科生大厂实习面试准备的 Web MVP。用户上传简历、填写目标岗位或 JD 后，系统会生成岗位匹配诊断、个性化题库、模拟面试追问和面试报告，帮助用户在正式投递前发现项目表达、岗位理解和面试回答中的高风险问题。

项目当前聚焦后端、前端、数据分析、算法和产品经理实习场景。

## 产品思想

这个项目不是“标准答案生成器”，而是一个更接近真实面试的训练工具：

- 先理解用户的简历、岗位和投递阶段，再生成问题；
- 诊断优先指出关键风险，而不是堆很多泛泛建议；
- 题库按基础、进阶、挑战分层，方便从自测过渡到模拟；
- 模拟面试会根据回答动态追问，但不会无限纠缠同一个点；
- 报告保留逐题回答、反馈、笔记和后续行动计划。

## 主要功能

- 顶部步骤式工作台：首页、准备、诊断、题库、模拟、报告、我的；
- 简历与 JD 输入：支持粘贴文本、上传文本/PDF/图片并尝试提取内容；
- 岗位匹配诊断：输出优势、风险和准备优先级；
- 个性化题库：基础、进阶、挑战三层题库，支持单题练习和反馈；
- 个人资料页：本地保存上传记录、准备计划、个人笔记、错题本、做过的题；
- 模拟面试：面试官画面、当前问题、回答框、语音输入、摄像头入口、面试笔记；
- 面试报告：逐题复盘、分项评分、面试笔记和行动计划；
- 报告导出：支持服务端生成 DOCX 和 PDF 文件；
- 降级兜底：未配置大模型时，仍可使用本地规则体验基础流程。

## 技术栈

前端：

- 原生 HTML / CSS / JavaScript；
- Hash 路由实现单页工作台；
- `localStorage` 保存草稿、历史记录、个人笔记和错题本；
- 浏览器端 PDF 文本提取与 OCR 辅助能力。

后端：

- Node.js 原生 HTTP 服务；
- 静态文件托管；
- 大模型 API 代理；
- 阿里云 NLS 语音识别/合成代理；
- DOCX / PDF 报告导出。

主要依赖：

- `docx`：生成 DOCX 报告；
- `pdfkit`：生成 PDF 报告；
- `ws`：语音识别 WebSocket 转发；
- `alibabacloud-nls`、`@alicloud/pop-core`：阿里云智能语音交互。

## 本地运行

克隆项目后安装依赖：

```bash
npm install
```

复制环境变量示例：

```bash
cp .env.example .env
```

如果只是体验基础流程，可以先不配置 API Key，系统会使用本地规则兜底。启动服务：

```bash
npm start
```

访问：

```text
http://localhost:5173
```

检查语法：

```bash
npm run check
```

## 环境变量

真实密钥请写入本地 `.env` 或服务器环境变量。`.env` 已被 `.gitignore` 忽略，不要提交到 GitHub。

常用配置：

```bash
PORT=5173

LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=替换成你的DeepSeek_API_KEY

ALIYUN_ACCESS_KEY_ID=替换成你的阿里云AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=替换成你的阿里云AccessKeySecret
ALIYUN_NLS_APPKEY=替换成你的智能语音交互AppKey
ALIYUN_NLS_URL=wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1
ALIYUN_NLS_VOICE=aixia

PDF_FONT_PATH=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

说明：

- DeepSeek / OpenAI 兼容接口用于岗位诊断、题库、反馈、动态追问和报告增强；
- 未配置大模型 Key 时，前端会提示并使用本地规则兜底；
- 阿里云 NLS 用于语音识别和语音合成，未配置时仍可文字作答；
- `PDF_FONT_PATH` 用于服务器缺少中文字体时保证 PDF 中文显示正常。

## 文件结构

- `index.html`：页面结构；
- `styles.css`：界面样式；
- `app.js`：前端交互、路由、本地状态和页面渲染；
- `server.js`：静态托管、AI 代理、语音代理、报告导出接口；
- `prompts.js`：大模型系统提示词与任务提示词；
- `.env.example`：环境变量示例；
- `DEPLOY_ALIYUN.md`：阿里云 ECS + Nginx 部署说明；
- `ai_explain.md`：AI、语音、Prompt 接入说明。

## 部署

推荐使用：

- Node.js 18+；
- Nginx 反向代理；
- `.env` 或服务器环境变量管理密钥；
- systemd / PM2 等进程管理工具常驻运行。

阿里云部署参考 [DEPLOY_ALIYUN.md](./DEPLOY_ALIYUN.md)。

## 安全提醒

- 不要提交 `.env`；
- 不要把真实 API Key 写入 README、代码、Issue、截图或提交记录；
- 公开部署时建议开启 HTTPS；
- 不要直接暴露 Node.js 端口，公网只开放 Nginx 的 80/443；
- 如果密钥曾经出现在公开仓库或聊天截图中，请立即轮换。

## 当前边界

这是一个 MVP，不包含账号系统和云端数据库。用户的草稿、个人笔记、错题本和历史报告默认保存在浏览器本地 `localStorage` 中，不支持跨设备同步。

后续可继续扩展：

- 用户登录与云端数据同步；
- 更完整的简历结构化解析；
- 公司/岗位面经资料库；
- 面试表现趋势追踪；
- 支付与订阅能力。
