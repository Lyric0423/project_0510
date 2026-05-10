# version_two.md 问题说明与实现决策

## 1. OCR：识别简历 PDF 和岗位截图照片

已实现前端 OCR/PDF 提取入口：

- 图片 OCR：接入 `tesseract.js` CDN，适合识别岗位截图、图片简历。它是纯 JavaScript/WebAssembly OCR，可在浏览器或 Node.js 运行，支持多语言。来源：<https://github.com/naptha/tesseract.js>
- PDF 文本提取：接入 Mozilla `pdf.js` CDN，适合提取“文字版 PDF 简历”的文本。`pdf.js` 是 Mozilla 维护的 Web 标准 PDF 解析/渲染项目。来源：<https://github.com/mozilla/pdf.js>

当前边界：

- 文字版 PDF：可以直接提取文本；
- 扫描版 PDF：需要先转图片再 OCR，MVP 暂未做多页扫描 PDF 自动 OCR；
- 图片截图：会用 OCR 尝试识别，但中文截图质量、字体、压缩会影响准确率；
- DOCX：当前建议用户复制文本粘贴，后续可在后端接 `mammoth` 等库解析。

建议后续生产方案：

- 前端继续保留 `tesseract.js` 做轻量识别；
- 后端增加文件解析服务，统一处理 PDF/DOCX/图片；
- 简历隐私敏感，服务端解析时要明确数据保留和删除策略。

## 2. 选择岗位后自动匹配通用 JD

已实现。

用户选择岗位方向后，系统会自动填入一段通用 JD：

- 后端开发；
- 前端开发；
- 数据分析；
- 算法；
- 产品经理；
- 尚不确定。

用户可以：

- 直接使用通用 JD 生成题库；
- 上传岗位截图，让 OCR 补充识别文本；
- 粘贴真实 JD；
- 手动修改 JD。

为了避免误覆盖用户输入，现在规则是：

- 如果 JD 为空，或当前 JD 是系统自动填入的，切换岗位会更新通用 JD；
- 如果用户手动编辑过 JD，切换岗位不会覆盖用户文本。

## 3. “填入后端示例”是什么意思？现在后端是什么？

原来的“填入后端示例”文案容易误解：它的意思不是“项目后端服务”，而是“填入一份后端开发实习生的演示数据”，方便你快速体验完整流程。

我已经把按钮改成：

- `载入演示数据`

现在项目里的“后端”分两层：

- 网站后端：新增了 `server.js`，负责静态网站托管和 `/api/ai/task` 大模型代理；
- 面试岗位里的后端：指“后端开发实习生”这个岗位方向。

也就是说，现在项目已经不只是纯静态页面了。它可以用 Node.js 启动一个服务：

```bash
npm start
```

如果没配置大模型 API Key，前端会自动用本地规则兜底；如果配置了 API Key，就会调用后端代理转发给大模型。

## 4. 语音转写工具选择

已修复浏览器语音转写体验：

- 现在使用浏览器 `Web Speech API` 做实时转写；
- 修复了之前 interim 文本可能重复追加的问题；
- 如果浏览器不支持，会提示用户改用文字输入。

生产环境建议两条路线：

1. 云服务商 ASR，推荐优先

- 如果你已经租了阿里云服务器，建议优先考虑阿里云智能语音交互/语音识别服务；
- 优点是稳定、部署快、中文识别好、运维压力小；
- 缺点是需要开通计费服务。

阿里云实时语音识别官方文档说明其适用于长时间语音流识别，并支持返回中间识别结果、标点、中文数字转阿拉伯数字等配置。来源：<https://www.alibabacloud.com/help/zh/doc-detail/84428.html>

2. 自部署开源 ASR，适合后续成本优化

- `FunASR`：国内中文 ASR 生态更友好，支持 ASR、VAD、标点恢复等能力。来源：<https://github.com/modelscope/FunASR>
- `whisper.cpp`：OpenAI Whisper 的 C/C++ 高性能实现，支持 CPU/GPU 和 WebAssembly 等平台。来源：<https://github.com/ggml-org/whisper.cpp>

我的建议：

- MVP 阶段：先用浏览器 Web Speech + 文字输入兜底；
- 小规模公测：购买阿里云语音识别服务；
- 用户量起来后：评估 FunASR/whisper.cpp 自部署，降低长期成本。

## 5. 大模型 API 接入说明

已新增后端大模型代理：

- `server.js`：Node.js 后端；
- `prompts.js`：面试官系统提示词和任务提示词；
- `/api/ai/task`：前端统一调用的大模型任务接口；
- `.env.example`：环境变量示例。

当前支持的任务：

- `diagnoseAndQuestions`：生成岗位匹配诊断和题库；
- `feedback`：生成单题反馈；
- `report`：生成面试报告补充。

推荐先接阿里云百炼，因为你服务器已经在阿里云，且百炼提供 OpenAI 兼容 Chat Completions API。阿里云 Qwen API reference 文档给出的北京地域兼容接口地址是：

```text
https://dashscope.aliyuncs.com/compatible-mode/v1
```

来源：<https://www.alibabacloud.com/help/doc-detail/2712576.html>

需要你购买或准备：

- 阿里云百炼 API Key；
- 可用模型名，例如 `qwen-plus`，也可以后续替换为更强模型；
- 如果接语音识别，还需要开通阿里云语音识别相关服务。

本地或服务器环境变量：

```bash
export LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export LLM_MODEL="qwen-plus"
export LLM_API_KEY="你的API_KEY"
npm start
```

提示词设计：

- 系统提示词放在 `prompts.js` 的 `BASE_SYSTEM_PROMPT`；
- 题库生成、单题反馈、报告生成分别有独立任务提示词；
- 所有提示词都要求输出 JSON，方便前端稳定解析；
- 提示词明确约束“不编造经历、不承诺 offer、不直接给完整背诵答案”。

## 6. 当前项目进展

已经完成：

- 大厂实习 MVP PRD；
- Web/H5 页面；
- 岗位方向选择；
- 岗位自动通用 JD；
- 简历文本输入；
- PDF 文本提取；
- 图片 OCR；
- JD 截图 OCR；
- 岗位匹配诊断；
- 三层题库；
- 自主练习；
- 模拟面试；
- 动态追问；
- 语音转写入口；
- 面试报告；
- 历史记录；
- Node.js 后端；
- 大模型 API 代理；
- 阿里云部署文档。

还需要你确认：

- 使用阿里云百炼还是其他大模型供应商；
- 是否购买阿里云语音识别；
- 首发岗位是否只开放后端、前端、数据分析，还是算法和产品也开放；
- 是否需要微信登录/支付。
