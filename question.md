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

---

# version_three.md 实现说明与待确认问题

## 1. PDF 简历识别失败的修复

我查看了 `resume_test/个人简历（试验版）.pdf`：它是 3 页 PDF，直接用 PDF 字符串检查时看不到正常中文文本；同目录的 DOCX 能读出完整中文简历。这说明 PDF 很可能存在字体编码/压缩导致的文字层不可读问题，单纯使用 `pdf.js getTextContent()` 可能失败或提取乱码。

已修复策略：

- 先用 `pdf.js` 尝试提取 PDF 文字层；
- 如果提取文本过短或可读字符比例过低，自动把 PDF 每页渲染成图片；
- 再用 `tesseract.js` 对渲染后的页面做 OCR；
- 当前最多 OCR 前 5 页，避免浏览器卡死。

这个方案可以覆盖：

- 普通文字版 PDF；
- 字体编码异常 PDF；
- 扫描/图片型 PDF。

## 2. 页面架构改为顶部步骤式工作台

已实现。

现在顶部导航包含：

- 首页；
- 准备；
- 诊断；
- 题库；
- 模拟；
- 报告。

点击上方板块才显示对应内容，不再要求用户一直向下滚动。前面输入的数据不会丢失：

- 表单 DOM 不销毁，只是切换显示；
- 同时把岗位、简历、JD、投递阶段、面试设置等保存到 `localStorage`；
- 刷新页面后会自动恢复草稿。


## 3. 面试类型自动匹配岗位

已实现。

规则：

- 后端/前端/算法：默认 `技术/业务面`；
- 数据分析/产品经理：默认 `产品/数据面`；
- 如果投递阶段选择 `HR 面前`：默认 `HR 面`；
- 尚不确定：默认 `HR 面`，用于方向澄清和经历可信度判断。

用户仍然可以手动切换面试类型。

## 4. DeepSeek API 接入与密钥保密

已把大模型默认供应商改成 DeepSeek：

```text
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

密钥读取方式：

- 优先读环境变量 `LLM_API_KEY` 或 `DEEPSEEK_API_KEY`；
- 如果没有环境变量，会读取 `/Users/lyric/key/api-key`；
- 也支持 `DEEPSEEK_API_KEY_FILE` 自定义路径。

这样代码可以提交 GitHub，不会把 API Key 写进仓库。

我检查到当前本机存在：

```text
/Users/lyric/key/api-key
```

我没有把里面的内容写入任何项目文件。

另外，`version_three.md` 原文里包含你提供的阿里云 appkey。为了避免误提交，我已新增 `.gitignore`，默认忽略 `version_three.md`、`.env`、`resume_test/` 和 `.DS_Store`。

## 5. 模拟面试沉浸感

已实现：

- 调用了图片生成能力，生成了线上面试软件布局视觉参考；
- 已把生成图复制到项目：`assets/interview-room-reference.png`；
- 模拟面试页新增视频会议布局：
  - 主面试官窗口；
  - 面试官头像；
  - 面试官姓名 `陈面试官`；
  - 候选人小窗；
  - 当前关注点侧栏；
  - 来电中/面试中状态；
- 用户点击开始模拟后会播放电话铃声；
- 面试官提问时会优先用浏览器 `SpeechSynthesis` 朗读。

关于阿里云语音合成：

- 你提供了 voice 项目的 appkey，但明确要求不要放进代码；
- 我已在后端预留 `/api/voice/config`；
- 后端会尝试读取 `/Users/lyric/key/aliyun_voice_appkey` 或环境变量；
- 当前前端不会暴露 appkey。

## 6. 需要你进一步确认

1. 阿里云语音合成如果要真正服务端调用，通常还需要 AccessKey ID / AccessKey Secret 或可签发 token 的服务端配置。你目前只给了 appkey，请确认 `/Users/lyric/key` 里是否还会补充阿里云 AccessKey。

2. DeepSeek 模型是否固定用 `deepseek-chat`，还是你想直接用 `deepseek-reasoner` 做更强的面试追问和报告生成？

3. 生成的面试官姓名目前固定为 `陈面试官`。是否需要按岗位自动换名字和角色，例如：
   - 后端：周工；
   - 产品：陈面试官；
   - 数据：林分析师；
   - HR：赵 HR。
可以 
4. PDF OCR 现在放在浏览器端跑。公网真实用户上传大 PDF 时会比较慢。是否要我下一版改成服务端文件上传 + 服务端 OCR 队列？
