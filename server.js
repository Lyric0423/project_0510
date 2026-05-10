const http = require("http");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const Nls = require("alibabacloud-nls");
const { WebSocketServer } = require("ws");
const { RPCClient } = require("@alicloud/pop-core");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require("docx");
const {
  BASE_SYSTEM_PROMPT,
  buildDiagnoseAndQuestionsPrompt,
  buildFeedbackPrompt,
  buildInterviewNextQuestionPrompt,
  buildReportPrompt,
} = require("./prompts");

const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));

const port = Number(process.env.PORT || 5173);
const secretRoot = process.env.SECRET_ROOT || "/Users/lyric/key";
const llmApiKey =
  process.env.LLM_API_KEY ||
  process.env.DEEPSEEK_API_KEY ||
  readSecret(process.env.DEEPSEEK_API_KEY_FILE || path.join(secretRoot, "api-key")) ||
  readSecret(path.join(secretRoot, "deepseek_api_key")) ||
  "";
const llmBaseUrl = (process.env.LLM_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const llmModel = process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";
const aliyunAccessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || "";
const aliyunAccessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || "";
const aliyunNlsAppkey = process.env.ALIYUN_NLS_APPKEY || "";
const aliyunNlsUrl = process.env.ALIYUN_NLS_URL || "wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1";
const aliyunNlsVoice = process.env.ALIYUN_NLS_VOICE || "aixia";
const aliyunNlsEndpoint = process.env.ALIYUN_NLS_TOKEN_ENDPOINT || "http://nls-meta.cn-shanghai.aliyuncs.com";
const aliyunNlsApiVersion = process.env.ALIYUN_NLS_TOKEN_API_VERSION || "2019-02-28";
let aliyunTokenCache = { token: "", expireAtMs: 0 };

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "mianshicang-ai",
        llmConfigured: Boolean(llmApiKey),
        voiceConfigured: isAliyunNlsConfigured(),
        model: llmModel,
        baseUrl: llmBaseUrl,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/ai/task") {
      return await handleAiTask(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/asr/transcribe") {
      return sendJson(res, 501, {
        ok: false,
        error: "ASR endpoint is reserved. Use browser Web Speech in MVP, or connect Aliyun NLS/FunASR later.",
      });
    }

    if (req.method === "POST" && url.pathname === "/api/voice/tts") {
      return await handleVoiceTts(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/report/export/docx") {
      return await handleReportExportDocx(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/report/export/pdf") {
      return await handleReportExportPdf(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/voice/config") {
      return sendJson(res, 200, {
        ok: true,
        provider: isAliyunNlsConfigured() ? "aliyun-nls" : "browser-speech-synthesis",
        configured: isAliyunNlsConfigured(),
        voice: aliyunNlsVoice,
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    return serveStatic(url.pathname, req, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: "Internal server error" });
  }
});

const asrServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/api/voice/asr") {
    socket.destroy();
    return;
  }
  asrServer.handleUpgrade(req, socket, head, (ws) => {
    asrServer.emit("connection", ws, req);
  });
});

asrServer.on("connection", (ws) => {
  handleVoiceAsrSocket(ws);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Mianshicang MVP server is running at http://0.0.0.0:${port}`);
  console.log(`LLM model: ${llmModel}; configured: ${Boolean(llmApiKey)}`);
  console.log(`Voice provider configured: ${isAliyunNlsConfigured()}`);
});

async function handleAiTask(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON request body" });
  }
  const task = body.task;
  const payload = body.payload || {};

  if (!llmApiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: "DeepSeek 调用失败：未读取到 /Users/lyric/key/api-key",
      code: "DEEPSEEK_KEY_MISSING",
    });
  }

  const prompt = buildTaskPrompt(task, payload);
  if (!prompt) {
    return sendJson(res, 400, { ok: false, error: "Unknown AI task" });
  }

  try {
    const data = await callLLM(prompt);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    console.error(error);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: error.publicMessage || "DeepSeek 调用失败：网络或服务异常，请检查 API Key、余额和服务状态",
      code: error.code || "DEEPSEEK_REQUEST_FAILED",
    });
  }
}

function buildTaskPrompt(task, payload) {
  if (task === "diagnoseAndQuestions") return buildDiagnoseAndQuestionsPrompt(payload);
  if (task === "feedback") return buildFeedbackPrompt(payload);
  if (task === "interviewNextQuestion") return buildInterviewNextQuestionPrompt(payload);
  if (task === "report") return buildReportPrompt(payload);
  return "";
}

async function callLLM(userPrompt) {
  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify({
      model: llmModel,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BASE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`LLM request failed: ${response.status} ${text.slice(0, 500)}`);
    error.code = `DEEPSEEK_HTTP_${response.status}`;
    error.publicMessage = buildDeepSeekErrorMessage(response.status, text);
    throw error;
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  return parseLooseJson(content);
}

async function handleVoiceTts(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON request body" });
  }

  const text = String(body.text || "").trim();
  if (!text) {
    return sendJson(res, 400, { ok: false, error: "阿里云语音失败：待合成文本为空" });
  }
  if (!isAliyunNlsConfigured()) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: "阿里云语音失败：未读取到 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_NLS_APPKEY，请检查本地 .env",
      code: "ALIYUN_NLS_CONFIG_MISSING",
    });
  }

  try {
    const audio = await callAliyunTts(text, body.voice || aliyunNlsVoice);
    if (!audio.base64) {
      return sendJson(res, 200, {
        ok: false,
        fallback: true,
        error: "阿里云语音失败：接口返回音频为空，已切换浏览器语音",
        code: "ALIYUN_EMPTY_AUDIO",
      });
    }
    return sendJson(res, 200, {
      ok: true,
      provider: "aliyun-nls",
      mimeType: audio.mimeType,
      audioBase64: audio.base64,
    });
  } catch (error) {
    console.error(error);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: error.publicMessage || "阿里云语音失败：网络或服务异常，已切换浏览器语音",
      code: error.code || "ALIYUN_TTS_FAILED",
    });
  }
}

async function callAliyunTts(text, voice) {
  const token = await getAliyunNlsToken();
  const tts = new Nls.SpeechSynthesizer({
    url: aliyunNlsUrl,
    appkey: aliyunNlsAppkey,
    token,
  });
  const chunks = [];
  let ttsFailedMessage = "";
  tts.on("data", (chunk) => {
    chunks.push(Buffer.from(chunk));
  });
  tts.on("failed", (message) => {
    ttsFailedMessage = message;
  });

  const param = tts.defaultStartParams(voice || aliyunNlsVoice);
  param.text = text;
  param.voice = voice || aliyunNlsVoice;

  try {
    await tts.start(param, true, 6000);
  } catch (error) {
    const wrapped = new Error(`Aliyun NLS TTS request failed: ${safeDetail(error)}`);
    wrapped.code = error.code || "ALIYUN_NLS_TTS_FAILED";
    wrapped.publicMessage = error.publicMessage || buildAliyunNlsErrorMessage("语音合成", ttsFailedMessage || error);
    throw wrapped;
  }

  return {
    mimeType: "audio/wav",
    base64: Buffer.concat(chunks).toString("base64"),
  };
}

async function handleVoiceAsrSocket(ws) {
  if (!isAliyunNlsConfigured()) {
    sendWsJson(ws, {
      type: "error",
      code: "ALIYUN_NLS_CONFIG_MISSING",
      message: "阿里云语音识别失败：未读取到 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_NLS_APPKEY，请检查本地 .env",
    });
    ws.close();
    return;
  }

  let transcription = null;
  let ready = false;
  let closed = false;
  const pendingAudio = [];

  const closeTranscription = async () => {
    if (!transcription) return;
    try {
      await transcription.close({});
    } catch {
      transcription.shutdown();
    } finally {
      transcription = null;
    }
  };

  ws.on("message", async (data, isBinary) => {
    if (closed) return;
    if (!isBinary) {
      const message = parseWsClientMessage(data);
      if (message?.type === "stop") {
        await closeTranscription();
        sendWsJson(ws, { type: "closed" });
        ws.close();
      }
      return;
    }

    const audio = Buffer.from(data);
    if (!ready || !transcription) {
      pendingAudio.push(audio);
      return;
    }
    if (!transcription.sendAudio(audio)) {
      sendWsJson(ws, { type: "error", message: "阿里云语音识别失败：音频发送失败，请重新录音。" });
    }
  });

  ws.on("close", () => {
    closed = true;
    if (transcription) transcription.shutdown();
    transcription = null;
  });

  try {
    const token = await getAliyunNlsToken();
    transcription = new Nls.SpeechTranscription({
      url: aliyunNlsUrl,
      appkey: aliyunNlsAppkey,
      token,
    });
    transcription.on("changed", (message) => {
      const text = parseNlsResultText(message);
      if (text) sendWsJson(ws, { type: "partial", text });
    });
    transcription.on("end", (message) => {
      const text = parseNlsResultText(message);
      if (text) sendWsJson(ws, { type: "final", text });
    });
    transcription.on("completed", () => {
      sendWsJson(ws, { type: "closed" });
    });
    transcription.on("failed", (message) => {
      sendWsJson(ws, {
        type: "error",
        code: "ALIYUN_NLS_ASR_FAILED",
        message: buildAliyunNlsErrorMessage("语音识别", message),
      });
    });

    await transcription.start(transcription.defaultStartParams(), true, 6000);
    ready = true;
    sendWsJson(ws, { type: "ready" });
    while (pendingAudio.length && transcription) {
      transcription.sendAudio(pendingAudio.shift());
    }
  } catch (error) {
    console.error(error);
    sendWsJson(ws, {
      type: "error",
      code: error.code || "ALIYUN_NLS_ASR_FAILED",
      message: error.publicMessage || buildAliyunNlsErrorMessage("语音识别", error),
    });
    ws.close();
  }
}

function isAliyunNlsConfigured() {
  return Boolean(aliyunAccessKeyId && aliyunAccessKeySecret && aliyunNlsAppkey);
}

async function getAliyunNlsToken() {
  if (!isAliyunNlsConfigured()) {
    const error = new Error("Aliyun NLS config missing");
    error.code = "ALIYUN_NLS_CONFIG_MISSING";
    error.publicMessage = "阿里云语音失败：未读取到 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_NLS_APPKEY，请检查本地 .env";
    throw error;
  }

  if (aliyunTokenCache.token && aliyunTokenCache.expireAtMs - Date.now() > 5 * 60 * 1000) {
    return aliyunTokenCache.token;
  }

  try {
    const client = new RPCClient({
      accessKeyId: aliyunAccessKeyId,
      accessKeySecret: aliyunAccessKeySecret,
      endpoint: aliyunNlsEndpoint,
      apiVersion: aliyunNlsApiVersion,
    });
    const result = await client.request("CreateToken", {}, { method: "GET", timeout: 8000 });
    const token = result?.Token?.Id || result?.Token?.Token || result?.Id || "";
    const expireTime = Number(result?.Token?.ExpireTime || result?.ExpireTime || 0);
    if (!token) {
      const error = new Error("Aliyun NLS token response has no token");
      error.code = "ALIYUN_NLS_TOKEN_EMPTY";
      error.publicMessage = "阿里云语音失败：CreateToken 返回为空，请检查 AccessKey 权限和智能语音交互服务是否开通。";
      throw error;
    }
    aliyunTokenCache = {
      token,
      expireAtMs: expireTime > 0 ? expireTime * 1000 : Date.now() + 55 * 60 * 1000,
    };
    return token;
  } catch (error) {
    const wrapped = new Error(`Aliyun NLS token request failed: ${safeDetail(error)}`);
    wrapped.code = error.code || "ALIYUN_NLS_TOKEN_FAILED";
    wrapped.publicMessage = error.publicMessage || buildAliyunNlsErrorMessage("Token 获取", error);
    throw wrapped;
  }
}

function sendWsJson(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function parseWsClientMessage(data) {
  try {
    return JSON.parse(Buffer.from(data).toString("utf8"));
  } catch {
    return null;
  }
}

function parseNlsResultText(message) {
  try {
    const parsed = typeof message === "string" ? JSON.parse(message) : JSON.parse(Buffer.from(message).toString("utf8"));
    return String(parsed?.payload?.result || parsed?.payload?.text || "").trim();
  } catch {
    return "";
  }
}

async function handleReportExportDocx(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON request body" });
  }

  const report = normalizeExportReport(body.report);
  if (!report) {
    return sendJson(res, 400, { ok: false, error: "请先生成报告，再导出 DOCX。" });
  }

  try {
    const buffer = await buildDocxReport(report);
    return sendDownload(
      res,
      200,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buildReportFilename(report, "docx"),
    );
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: "DOCX 导出失败：报告文件生成异常。" });
  }
}

async function handleReportExportPdf(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON request body" });
  }

  const report = normalizeExportReport(body.report);
  if (!report) {
    return sendJson(res, 400, { ok: false, error: "请先生成报告，再导出 PDF。" });
  }

  try {
    const { buffer, fontWarning } = await buildPdfReport(report);
    return sendDownload(
      res,
      200,
      buffer,
      "application/pdf",
      buildReportFilename(report, "pdf"),
      fontWarning ? { "X-PDF-Font-Warning": encodeURIComponent(fontWarning) } : {},
    );
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: error.publicMessage || "PDF 导出失败：报告文件生成异常。" });
  }
}

async function buildDocxReport(report) {
  const children = [
    new Paragraph({
      text: "面试舱 AI 模拟面试报告",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    textParagraph(`${report.type} · ${report.jobTitle} · ${report.companyName || report.role}`),
    textParagraph(`生成时间：${formatDateForExport(report.createdAt)}`),
    textParagraph(`总分：${report.score}/100`),
    spacerParagraph(),
    headingParagraph("基本信息"),
    textParagraph(`岗位方向：${report.role}`),
    textParagraph(`目标岗位：${report.jobTitle}`),
    textParagraph(`目标公司/业务：${report.companyName || "未填写"}`),
    textParagraph(`面试类型：${report.type}`),
    spacerParagraph(),
    headingParagraph("分项评分"),
    ...Object.entries(report.dimensions).map(([name, score]) => textParagraph(`${name}：${score}/100`)),
    spacerParagraph(),
    headingParagraph("关键亮点"),
    ...listParagraphs(report.strengths),
    spacerParagraph(),
    headingParagraph("高风险问题"),
    ...listParagraphs(report.risks.length ? report.risks : report.suggestions.slice(0, 3)),
    spacerParagraph(),
    headingParagraph("逐题复盘"),
    ...report.turns.flatMap((turn, index) => turnDocxParagraphs(turn, index)),
    spacerParagraph(),
    headingParagraph("面试笔记"),
    ...noteDocxParagraphs(report.notes),
    spacerParagraph(),
    headingParagraph("行动计划"),
    ...Object.entries(report.actionPlan).flatMap(([period, items]) => [
      new Paragraph({ children: [new TextRun({ text: period, bold: true })] }),
      ...listParagraphs(items),
    ]),
  ];

  const doc = new Document({
    creator: "面试舱 AI",
    title: "面试舱 AI 模拟面试报告",
    description: "AI 模拟面试结构化复盘报告",
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

function textParagraph(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: cleanExportText(text), size: 22 })],
  });
}

function headingParagraph(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 120 },
    children: [new TextRun({ text: cleanExportText(text), bold: true })],
  });
}

function spacerParagraph() {
  return new Paragraph({ text: "" });
}

function listParagraphs(items) {
  const list = Array.isArray(items) && items.length ? items : ["暂无。"];
  return list.map((item) => textParagraph(`• ${item}`));
}

function turnDocxParagraphs(turn, index) {
  const suggestions = arrayOrFallback(turn.feedback?.suggestions, ["继续补充细节。"]);
  const strengths = arrayOrFallback(turn.feedback?.strengths, ["完成作答。"]);
  return [
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: `Q${index + 1}：${cleanExportText(turn.question?.text || "未记录题目")}`, bold: true, size: 23 })],
    }),
    textParagraph(`你的回答：${turn.answer || "未记录回答"}`),
    textParagraph(`单题评分：${turn.feedback?.score || "-"} / 100`),
    textParagraph(`亮点：${strengths.join("；")}`),
    textParagraph(`建议：${suggestions.join("；")}`),
  ];
}

function noteDocxParagraphs(notes) {
  if (!Array.isArray(notes) || !notes.length) return [textParagraph("本次面试没有记录额外笔记。")];
  return notes.flatMap((note, index) => [
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: `笔记 ${index + 1}：${cleanExportText(note.createdAt || "")}`, bold: true, size: 23 })],
    }),
    textParagraph(note.text || "未记录内容"),
    textParagraph(`关联问题：${note.question || "面试记录"}`),
  ]);
}

function buildPdfReport(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "面试舱 AI 模拟面试报告", Author: "面试舱 AI" } });
    const chunks = [];
    let fontWarning = "";

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), fontWarning }));
    doc.on("error", reject);

    const fontPath = findPdfFontPath();
    if (fontPath) {
      try {
        doc.registerFont("ReportFont", fontPath);
        doc.font("ReportFont");
      } catch (error) {
        fontWarning = `PDF 中文字体加载失败，请通过 PDF_FONT_PATH 指定可用中文字体：${error.message}`;
        doc.font("Helvetica");
      }
    } else {
      fontWarning = "未找到中文字体，PDF 中文可能无法正确显示。请通过 PDF_FONT_PATH 指定 Noto Sans CJK、微软雅黑、宋体等字体文件。";
      doc.font("Helvetica");
    }

    pdfTitle(doc, "面试舱 AI 模拟面试报告");
    pdfText(doc, `${report.type} · ${report.jobTitle} · ${report.companyName || report.role}`);
    pdfText(doc, `生成时间：${formatDateForExport(report.createdAt)}`);
    pdfScoreBlock(doc, report);

    pdfSection(doc, "基本信息");
    pdfList(doc, [
      `岗位方向：${report.role}`,
      `目标岗位：${report.jobTitle}`,
      `目标公司/业务：${report.companyName || "未填写"}`,
      `面试类型：${report.type}`,
    ]);

    pdfSection(doc, "分项评分");
    pdfList(doc, Object.entries(report.dimensions).map(([name, score]) => `${name}：${score}/100`));

    pdfSection(doc, "关键亮点");
    pdfList(doc, report.strengths);

    pdfSection(doc, "高风险问题");
    pdfList(doc, report.risks.length ? report.risks : report.suggestions.slice(0, 3));

    pdfSection(doc, "逐题复盘");
    report.turns.forEach((turn, index) => {
      ensurePdfSpace(doc, 130);
      doc.fontSize(12).fillColor("#111827").text(`Q${index + 1}：${cleanExportText(turn.question?.text || "未记录题目")}`, { lineGap: 3 });
      doc.fontSize(10.5).fillColor("#374151").text(`你的回答：${cleanExportText(turn.answer || "未记录回答")}`, { lineGap: 3 });
      doc.text(`单题评分：${turn.feedback?.score || "-"} / 100`);
      doc.text(`建议：${cleanExportText(arrayOrFallback(turn.feedback?.suggestions, ["继续补充细节。"])[0])}`, { lineGap: 6 });
      doc.moveDown(0.6);
    });

    pdfSection(doc, "面试笔记");
    if (report.notes.length) {
      report.notes.forEach((note, index) => {
        ensurePdfSpace(doc, 90);
        doc.fontSize(12).fillColor("#111827").text(`笔记 ${index + 1}：${cleanExportText(note.createdAt || "")}`, { lineGap: 3 });
        doc.fontSize(10.5).fillColor("#374151").text(cleanExportText(note.text || "未记录内容"), { lineGap: 3 });
        doc.fontSize(9.5).fillColor("#64748b").text(`关联问题：${cleanExportText(note.question || "面试记录")}`, { lineGap: 6 });
        doc.moveDown(0.5);
      });
    } else {
      pdfList(doc, ["本次面试没有记录额外笔记。"]);
    }

    pdfSection(doc, "行动计划");
    Object.entries(report.actionPlan).forEach(([period, items]) => {
      ensurePdfSpace(doc, 90);
      doc.fontSize(12).fillColor("#111827").text(period);
      pdfList(doc, items);
    });

    if (fontWarning) {
      ensurePdfSpace(doc, 80);
      doc.fontSize(8).fillColor("#9ca3af").text(`Font warning: ${fontWarning}`);
    }

    doc.end();
  });
}

function pdfTitle(doc, text) {
  doc.fontSize(22).fillColor("#111827").text(cleanExportText(text), { align: "center" });
  doc.moveDown(0.6);
}

function pdfScoreBlock(doc, report) {
  doc.moveDown(0.5);
  const boxY = doc.y;
  doc.roundedRect(48, boxY, 499, 72, 8).fill("#eef6ff");
  doc.fillColor("#0f4c81").fontSize(30).text(String(report.score), 70, boxY + 14, { continued: true });
  doc.fontSize(12).text(" / 100");
  doc.fillColor("#374151").fontSize(12).text("总分", 72, boxY + 48);
  doc.y = boxY + 72;
  doc.moveDown(1);
}

function pdfSection(doc, title) {
  ensurePdfSpace(doc, 70);
  doc.moveDown(0.6);
  doc.fontSize(14).fillColor("#0f172a").text(cleanExportText(title), { lineGap: 4 });
  doc.moveTo(48, doc.y + 2).lineTo(547, doc.y + 2).strokeColor("#d9e2ec").stroke();
  doc.moveDown(0.7);
}

function pdfList(doc, items) {
  const list = Array.isArray(items) && items.length ? items : ["暂无。"];
  list.forEach((item) => {
    ensurePdfSpace(doc, 42);
    doc.fontSize(10.5).fillColor("#374151").text(`• ${cleanExportText(item)}`, {
      indent: 8,
      hangingIndent: 8,
      lineGap: 3,
    });
  });
}

function pdfText(doc, text) {
  ensurePdfSpace(doc, 36);
  doc.fontSize(10.5).fillColor("#4b5563").text(cleanExportText(text), { align: "center", lineGap: 3 });
}

function ensurePdfSpace(doc, minHeight) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function findPdfFontPath() {
  const candidates = [
    process.env.PDF_FONT_PATH,
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/arphic/uming.ttc",
  ].filter(Boolean);

  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

function normalizeExportReport(report) {
  if (!report || typeof report !== "object") return null;
  const turns = Array.isArray(report.turns) ? report.turns : [];
  if (!turns.length && !report.score) return null;
  return {
    id: String(report.id || `report-${Date.now()}`),
    createdAt: report.createdAt || new Date().toISOString(),
    role: cleanExportText(report.role || "目标岗位"),
    jobTitle: cleanExportText(report.jobTitle || report.role || "大厂实习岗位"),
    companyName: cleanExportText(report.companyName || ""),
    type: cleanExportText(report.type || "模拟面试"),
    score: clampExportScore(report.score),
    dimensions: normalizeScoreMap(report.dimensions),
    strengths: normalizeTextList(report.strengths),
    risks: normalizeTextList(report.risks),
    suggestions: normalizeTextList(report.suggestions),
    actionPlan: normalizeActionPlan(report.actionPlan),
    turns: turns.map(normalizeExportTurn),
    notes: normalizeExportNotes(report.notes),
  };
}

function normalizeExportTurn(turn) {
  const feedback = turn?.feedback && typeof turn.feedback === "object" ? turn.feedback : {};
  return {
    question: {
      text: cleanExportText(turn?.question?.text || "未记录题目"),
    },
    answer: cleanExportText(turn?.answer || "未记录回答"),
    feedback: {
      score: clampExportScore(feedback.score),
      strengths: normalizeTextList(feedback.strengths),
      suggestions: normalizeTextList(feedback.suggestions),
    },
  };
}

function normalizeScoreMap(dimensions) {
  if (!dimensions || typeof dimensions !== "object") return { 综合表现: 60 };
  return Object.fromEntries(
    Object.entries(dimensions)
      .slice(0, 12)
      .map(([name, score]) => [cleanExportText(name), clampExportScore(score)]),
  );
}

function normalizeActionPlan(actionPlan) {
  if (!actionPlan || typeof actionPlan !== "object") {
    return { "7 天": ["复盘本次面试问题，补充项目细节和量化结果。"] };
  }
  return Object.fromEntries(
    Object.entries(actionPlan)
      .slice(0, 8)
      .map(([period, items]) => [cleanExportText(period), normalizeTextList(items)]),
  );
}

function normalizeExportNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => ({
      text: cleanExportText(note?.text || note),
      question: cleanExportText(note?.question || ""),
      createdAt: cleanExportText(note?.createdAt || ""),
    }))
    .filter((note) => note.text)
    .slice(0, 50);
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanExportText).filter(Boolean).slice(0, 20);
}

function arrayOrFallback(value, fallback) {
  return Array.isArray(value) && value.length ? value.map(cleanExportText).filter(Boolean) : fallback;
}

function cleanExportText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function clampExportScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 60;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildReportFilename(report, ext) {
  const base = `${report.jobTitle || report.role || "interview"}-${formatDateForFilename(report.createdAt)}-面试报告`
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "interview-report"}.${ext}`;
}

function formatDateForFilename(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "report";
  return date.toISOString().slice(0, 10);
}

function formatDateForExport(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

function buildDeepSeekErrorMessage(status, detail) {
  if (status === 401 || status === 403) return `DeepSeek 调用失败：${status}，请检查 API Key 是否正确`;
  if (status === 429) return "DeepSeek 调用失败：429，可能是限流或额度不足，请检查账号额度";
  if (status >= 500) return `DeepSeek 调用失败：${status}，服务端异常，请稍后重试`;
  return `DeepSeek 调用失败：${status}，${String(detail || "").slice(0, 120)}`;
}

function buildAliyunNlsErrorMessage(stage, detail) {
  const text = safeDetail(detail);
  if (/401|403|Forbidden|InvalidAccessKeyId|Signature|Unauthorized/i.test(text)) {
    return `阿里云${stage}失败：鉴权失败，请检查 .env 中的 AccessKey、NLS AppKey 和服务权限。`;
  }
  if (/Throttling|Quota|429|limit/i.test(text)) {
    return `阿里云${stage}失败：可能是额度不足或限流，请检查智能语音交互服务额度。`;
  }
  if (/ENOTFOUND|ECONN|ETIMEDOUT|timeout|network/i.test(text)) {
    return `阿里云${stage}失败：网络或服务不可达，请检查服务器网络和 NLS 地址。`;
  }
  if (/appkey/i.test(text)) {
    return `阿里云${stage}失败：请检查 ALIYUN_NLS_APPKEY 是否正确。`;
  }
  return `阿里云${stage}失败：${text || "未知错误"}。`;
}

function safeDetail(detail) {
  if (!detail) return "";
  if (detail instanceof Error) return String(detail.message || detail.code || "").slice(0, 180);
  if (Buffer.isBuffer(detail)) return detail.toString("utf8").slice(0, 180);
  if (typeof detail === "string") return detail.slice(0, 180);
  try {
    return JSON.stringify(detail).slice(0, 180);
  } catch {
    return String(detail).slice(0, 180);
  }
}

function parseLooseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) {
      const error = new Error("DeepSeek returned invalid JSON");
      error.code = "DEEPSEEK_INVALID_JSON";
      error.publicMessage = "DeepSeek 返回内容不是合法 JSON，已使用本地规则兜底";
      throw error;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      const error = new Error("DeepSeek returned invalid JSON");
      error.code = "DEEPSEEK_INVALID_JSON";
      error.publicMessage = "DeepSeek 返回内容不是合法 JSON，已使用本地规则兜底";
      throw error;
    }
  }
}

function serveStatic(urlPath, req, res) {
  let safePath = decodeURIComponent(urlPath.split("?")[0]);
  if (safePath === "/") safePath = "/index.html";
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, normalized);

  if (!filePath.startsWith(rootDir)) {
    return sendJson(res, 403, { ok: false, error: "Forbidden" });
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      return sendJson(res, 404, { ok: false, error: "Not found" });
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": [".html", ".css", ".js"].includes(ext) ? "no-cache" : "public, max-age=604800",
    });

    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendDownload(res, statusCode, buffer, contentType, filename, extraHeaders = {}) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_");
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(buffer);
}

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      const key = match[1];
      if (process.env[key]) return;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  } catch {
    // Local .env is optional; production can use real environment variables.
  }
}

function readSecret(filePath) {
  if (!filePath) return "";
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return "";
    const keyValueLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (!keyValueLine) return "";
    const match = keyValueLine.match(/^(?:DEEPSEEK_API_KEY|LLM_API_KEY|API_KEY|DASHSCOPE_API_KEY|ALIYUN_API_KEY|ALIYUN_VOICE_API_KEY|ALIYUN_VOICE_APPKEY|ALIYUN_ACCESS_KEY_ID|ALIYUN_ACCESS_KEY_SECRET|ALIYUN_NLS_APPKEY)\s*=\s*(.+)$/);
    return (match ? match[1] : keyValueLine).replace(/^["']|["']$/g, "").trim();
  } catch {
    return "";
  }
}
