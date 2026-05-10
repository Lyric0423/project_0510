# AI 接入说明

## 1. Key 配置在哪里

真实 key 不要写进代码仓库。本项目在 `server.js` 里读取本机密钥文件或环境变量。

- DeepSeek key：`server.js` 第 15-20 行。
  - 默认读取 `/Users/lyric/key/api-key`。
  - 也支持环境变量 `LLM_API_KEY`、`DEEPSEEK_API_KEY`、`DEEPSEEK_API_KEY_FILE`。
- DeepSeek 接口地址和模型：`server.js` 第 21-22 行。
  - 默认 `https://api.deepseek.com`。
  - 默认模型 `deepseek-chat`。
- 阿里云语音 key：`server.js` 第 23-30 行。
  - 默认读取 `/Users/lyric/key/ali-key`。
  - 也支持 `DASHSCOPE_API_KEY`、`ALIYUN_API_KEY`、`ALIYUN_VOICE_API_KEY` 等环境变量。
- 阿里云 TTS 接口和声音：`server.js` 第 31-33 行。
  - 默认模型 `qwen3-tts-flash`。
  - 默认声音 `Cherry`。

如果配置失败，前端会弹出具体提示，例如 DeepSeek 401、未读取到 key、阿里云语音失败等，并自动回退到本地规则或浏览器语音。

## 2. 大模型提示词在哪里

所有核心提示词都在 `prompts.js`：

- 全局系统提示词：`BASE_SYSTEM_PROMPT`，第 1-13 行。
- 题库生成和岗位诊断：`buildDiagnoseAndQuestionsPrompt`，第 15-52 行。
- 单题回答反馈：`buildFeedbackPrompt`，第 54-83 行。
- 模拟面试动态追问：`buildInterviewNextQuestionPrompt`，第 85-120 行。
- 面试报告补充：`buildReportPrompt`，第 122-153 行。

前端调用入口在 `app.js`：

- 统一 DeepSeek 调用：`callAiTask`，第 545-565 行。
- 题库生成：`generateWorkspace` 调用 `diagnoseAndQuestions`。
- 模拟面试下一题：`requestAiInterviewQuestion`，第 1026-1047 行。
- 语音合成播放：`speakInterviewerText`，第 1240-1259 行。

## 3. 面经或背景资料应该加在哪里

短期最快做法：直接加进 `prompts.js` 对应 prompt 的“材料”段，例如题库生成的 `buildDiagnoseAndQuestionsPrompt` 或动态追问的 `buildInterviewNextQuestionPrompt`。

更适合产品化的做法：

1. 在准备页新增一个“面经 / 背景资料”输入框。
2. 在 `app.js` 的 `getMaterials()` 返回值中加入 `backgroundText`。
3. `prompts.js` 不需要额外改很多，因为当前 prompt 已经会把 `payload.materials` 整体发送给 DeepSeek。

这样用户上传或粘贴公司面经、业务背景、岗位补充信息后，题库、追问、反馈和报告都能同时用到这份资料。
