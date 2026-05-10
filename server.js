const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  BASE_SYSTEM_PROMPT,
  buildDiagnoseAndQuestionsPrompt,
  buildFeedbackPrompt,
  buildInterviewNextQuestionPrompt,
  buildReportPrompt,
} = require("./prompts");

const rootDir = __dirname;
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
const aliyunApiKey =
  process.env.DASHSCOPE_API_KEY ||
  process.env.ALIYUN_API_KEY ||
  process.env.ALIYUN_VOICE_API_KEY ||
  readSecret(process.env.ALIYUN_API_KEY_FILE || path.join(secretRoot, "ali-key")) ||
  readSecret(process.env.ALIYUN_VOICE_API_KEY_FILE || path.join(secretRoot, "ali-key")) ||
  readSecret(process.env.ALIYUN_VOICE_APPKEY_FILE || path.join(secretRoot, "aliyun_voice_appkey")) ||
  "";
const aliyunTtsBaseUrl = (process.env.ALIYUN_TTS_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
const aliyunTtsModel = process.env.ALIYUN_TTS_MODEL || "qwen3-tts-flash";
const aliyunTtsVoice = process.env.ALIYUN_TTS_VOICE || "Cherry";

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
        voiceConfigured: Boolean(aliyunApiKey),
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

    if (req.method === "GET" && url.pathname === "/api/voice/config") {
      return sendJson(res, 200, {
        ok: true,
        provider: aliyunApiKey ? "aliyun-dashscope" : "browser-speech-synthesis",
        configured: Boolean(aliyunApiKey),
        model: aliyunTtsModel,
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

server.listen(port, "0.0.0.0", () => {
  console.log(`Mianshicang MVP server is running at http://0.0.0.0:${port}`);
  console.log(`LLM model: ${llmModel}; configured: ${Boolean(llmApiKey)}`);
  console.log(`Voice provider configured: ${Boolean(aliyunApiKey)}`);
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
  if (!aliyunApiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: "阿里云语音失败：未读取到 /Users/lyric/key/ali-key",
      code: "ALIYUN_KEY_MISSING",
    });
  }

  try {
    const audio = await callAliyunTts(text, body.voice || aliyunTtsVoice);
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
      provider: "aliyun-dashscope",
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
  const response = await fetch(`${aliyunTtsBaseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aliyunApiKey}`,
    },
    body: JSON.stringify({
      model: aliyunTtsModel,
      input: text,
      voice,
      response_format: "mp3",
    }),
  });

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Aliyun TTS request failed: ${response.status} ${detail.slice(0, 500)}`);
    error.code = `ALIYUN_HTTP_${response.status}`;
    error.publicMessage = buildAliyunErrorMessage(response.status, detail);
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: contentType.includes("audio") ? contentType : "audio/mpeg",
    base64: buffer.toString("base64"),
  };
}

function buildDeepSeekErrorMessage(status, detail) {
  if (status === 401 || status === 403) return `DeepSeek 调用失败：${status}，请检查 API Key 是否正确`;
  if (status === 429) return "DeepSeek 调用失败：429，可能是限流或额度不足，请检查账号额度";
  if (status >= 500) return `DeepSeek 调用失败：${status}，服务端异常，请稍后重试`;
  return `DeepSeek 调用失败：${status}，${String(detail || "").slice(0, 120)}`;
}

function buildAliyunErrorMessage(status, detail) {
  if (status === 401 || status === 403) return `阿里云语音失败：${status}，请检查 ali-key 是否为 DashScope API Key`;
  if (status === 429) return "阿里云语音失败：429，可能是限流或额度不足，已切换浏览器语音";
  if (status >= 500) return `阿里云语音失败：${status}，阿里云服务异常，已切换浏览器语音`;
  return `阿里云语音失败：${status}，${String(detail || "").slice(0, 120)}`;
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
    const match = keyValueLine.match(/^(?:DEEPSEEK_API_KEY|LLM_API_KEY|API_KEY|DASHSCOPE_API_KEY|ALIYUN_API_KEY|ALIYUN_VOICE_API_KEY|ALIYUN_VOICE_APPKEY)\s*=\s*(.+)$/);
    return (match ? match[1] : keyValueLine).replace(/^["']|["']$/g, "").trim();
  } catch {
    return "";
  }
}
