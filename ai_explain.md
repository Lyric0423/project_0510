# AI 接入说明

## 1. Key 配置在哪里

真实 key 不要写进代码仓库。本项目启动时会读取本地 `.env` 和系统环境变量，`.env` 已被 `.gitignore` 忽略。

- DeepSeek：使用 `DEEPSEEK_API_KEY`，兼容 `LLM_API_KEY`。
  - 接口地址默认 `https://api.deepseek.com`，模型默认 `deepseek-chat`。
- 阿里云 NLS：使用 `ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_NLS_APPKEY`。
  - WebSocket 地址默认 `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1`。
  - TTS 声音默认 `aixia`。
- PDF 字体：可选 `PDF_FONT_PATH`，用于服务器没有中文字体时指定字体文件。

如果配置失败，前端会弹出具体提示，例如 DeepSeek 401、未读取到 key、阿里云 Token 获取失败、语音识别失败等，并自动回退到本地规则、文字输入或浏览器语音。

## 2. 大模型提示词在哪里

所有核心提示词都在 `prompts.js`：

- 全局系统提示词：`BASE_SYSTEM_PROMPT`。
- 题库生成和岗位诊断：`buildDiagnoseAndQuestionsPrompt`。
- 单题回答反馈：`buildFeedbackPrompt`。
- 模拟面试动态追问：`buildInterviewNextQuestionPrompt`。
- 面试报告补充：`buildReportPrompt`。

前端调用入口在 `app.js`：

- 统一 DeepSeek 调用：`callAiTask`。
- 题库生成：`generateWorkspace` 调用 `diagnoseAndQuestions`。
- 模拟面试下一题：`requestAiInterviewQuestion`。
- 阿里 NLS 语音合成播放：`speakInterviewerText`。
- 阿里 NLS 语音识别：`toggleVoiceInput` 连接 `/api/voice/asr`。

## 3. 面经或背景资料应该加在哪里

短期最快做法：直接加进 `prompts.js` 对应 prompt 的“材料”段，例如题库生成的 `buildDiagnoseAndQuestionsPrompt` 或动态追问的 `buildInterviewNextQuestionPrompt`。

更适合产品化的做法：

1. 在准备页新增一个“面经 / 背景资料”输入框。
2. 在 `app.js` 的 `getMaterials()` 返回值中加入 `backgroundText`。
3. `prompts.js` 不需要额外改很多，因为当前 prompt 已经会把 `payload.materials` 整体发送给 DeepSeek。

这样用户上传或粘贴公司面经、业务背景、岗位补充信息后，题库、追问、反馈和报告都能同时用到这份资料。
