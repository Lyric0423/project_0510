# 面试舱 AI - 大厂实习版 MVP

这是一个面向本科生大厂实习面试准备的 Web/H5 MVP，依据 `prd_bigtech_internship_mvp.md` 制作。

当前版本已经包含一个轻量 Node.js 后端，不依赖第三方 npm 包。未配置大模型 API Key 时会自动使用前端本地规则兜底；配置 API Key 后会通过后端代理调用大模型。

- 岗位方向选择；
- 简历文本/文件输入；
- JD 文本/文件输入；
- 岗位匹配诊断；
- 基础/进阶/挑战三层题库；
- 自主练习与单题反馈；
- 模拟面试与动态追问；
- 面试报告；
- 本地历史记录；
- 浏览器 OCR/PDF 文本提取；
- 大模型 API 代理。

## 本地运行

在项目目录执行：

```bash
npm start
```

然后访问：

```text
http://localhost:5173
```

## 文件说明

- `index.html`：页面结构；
- `styles.css`：界面样式；
- `app.js`：本地 MVP 交互逻辑；
- `server.js`：静态托管与大模型 API 代理；
- `prompts.js`：大模型系统提示词与任务提示词；
- `.env.example`：环境变量示例；
- `question.md`：`version_two.md` 中问题的解释和实现决策；
- `prd_bigtech_internship_mvp.md`：大厂实习 MVP PRD；
- `DEPLOY_ALIYUN.md`：阿里云/Nginx 部署说明。

## 大模型 API 配置

推荐先用阿里云百炼 OpenAI 兼容接口：

```bash
export LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export LLM_MODEL="qwen-plus"
export LLM_API_KEY="你的API_KEY"
npm start
```

不要把真实 API Key 写进前端文件。

## 当前边界

当前版本已能作为公网 MVP 访问。真实上线后建议继续补强：

- DOCX 服务端解析；
- 扫描版多页 PDF OCR；
- 云端 ASR；
- 用户登录与支付；
- 后端数据库与对象存储。
