const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  BASE_SYSTEM_PROMPT,
  buildDiagnoseAndQuestionsPrompt,
  buildFeedbackPrompt,
  buildReportPrompt,
} = require("./prompts");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5173);
const llmApiKey = process.env.LLM_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || "";
const llmBaseUrl = (process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
const llmModel = process.env.LLM_MODEL || "qwen-plus";

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
        model: llmModel,
        baseUrl: llmBaseUrl,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/ai/task") {
      return handleAiTask(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/asr/transcribe") {
      return sendJson(res, 501, {
        ok: false,
        error: "ASR endpoint is reserved. Use browser Web Speech in MVP, or connect Aliyun NLS/FunASR later.",
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
});

async function handleAiTask(req, res) {
  const body = await readJson(req);
  const task = body.task;
  const payload = body.payload || {};

  if (!llmApiKey) {
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      error: "LLM_API_KEY is not configured. Frontend will use local fallback.",
    });
  }

  const prompt = buildTaskPrompt(task, payload);
  if (!prompt) {
    return sendJson(res, 400, { ok: false, error: "Unknown AI task" });
  }

  const data = await callLLM(prompt);
  return sendJson(res, 200, { ok: true, data });
}

function buildTaskPrompt(task, payload) {
  if (task === "diagnoseAndQuestions") return buildDiagnoseAndQuestionsPrompt(payload);
  if (task === "feedback") return buildFeedbackPrompt(payload);
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
    throw new Error(`LLM request failed: ${response.status} ${text.slice(0, 500)}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  return parseLooseJson(content);
}

function parseLooseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
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
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800",
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
