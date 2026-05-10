const roles = [
  {
    id: "backend",
    label: "后端开发",
    desc: "Java / 数据库 / 缓存 / 并发",
    keywords: ["Java", "Spring", "Spring Boot", "MySQL", "Redis", "HTTP", "TCP", "并发", "缓存", "数据库", "消息队列", "接口"],
  },
  {
    id: "frontend",
    label: "前端开发",
    desc: "React / 工程化 / 性能优化",
    keywords: ["JavaScript", "TypeScript", "React", "Vue", "CSS", "HTML", "Webpack", "Vite", "组件", "性能优化", "浏览器", "工程化"],
  },
  {
    id: "data",
    label: "数据分析",
    desc: "SQL / 指标 / 业务分析",
    keywords: ["SQL", "Python", "Excel", "指标", "漏斗", "留存", "A/B", "可视化", "业务", "分析", "报表", "数据清洗"],
  },
  {
    id: "algorithm",
    label: "算法",
    desc: "机器学习 / 模型 / 实验",
    keywords: ["Python", "机器学习", "深度学习", "PyTorch", "TensorFlow", "特征", "模型", "NLP", "CV", "召回", "排序", "实验"],
  },
  {
    id: "product",
    label: "产品经理",
    desc: "需求 / 指标 / 用户洞察",
    keywords: ["需求", "用户", "竞品", "原型", "PRD", "指标", "增长", "留存", "转化", "调研", "商业化", "数据分析"],
  },
  {
    id: "uncertain",
    label: "尚不确定",
    desc: "先做方向澄清",
    keywords: ["项目", "课程", "竞赛", "实习", "技能", "兴趣", "方向"],
  },
];

const state = {
  selectedRole: "backend",
  selectedLevel: "基础",
  selectedType: "全部",
  diagnosis: null,
  questionBank: [],
  selectedQuestion: null,
  practiceRecords: [],
  interview: null,
  history: [],
};

const storageKey = "mianshicang_mvp_history";
let activeRecorder = null;
let activeRecognition = null;
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  state.history = readHistory();
  renderRoleGrid();
  bindEvents();
  renderHistory();
  renderEmptyDiagnosis();
  renderQuestions();
});

function bindEvents() {
  $("#generateBtn").addEventListener("click", generateWorkspace);
  $("#fillDemoBtn").addEventListener("click", fillDemo);
  $("#resumeFile").addEventListener("change", (event) => handleFile(event, "#resumeText", "#resumeFileName"));
  $("#jdFile").addEventListener("change", (event) => handleFile(event, "#jdText", "#jdFileName"));
  $("#timelineSelect").addEventListener("change", persistLightState);
  $("#stageSelect").addEventListener("change", persistLightState);

  $$(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".segmented button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.selectedLevel = button.dataset.level;
      renderQuestions();
    });
  });

  $("#typeFilter").addEventListener("change", (event) => {
    state.selectedType = event.target.value;
    renderQuestions();
  });

  $("#hintBtn").addEventListener("click", showQuestionHint);
  $("#feedbackBtn").addEventListener("click", generatePracticeFeedback);
  $("#recordBtn").addEventListener("click", () => toggleVoiceInput("#practiceAnswer", "#recordBtn"));

  $("#startInterviewBtn").addEventListener("click", startInterview);
  $("#finishInterviewBtn").addEventListener("click", finishInterview);
  $("#submitInterviewAnswerBtn").addEventListener("click", submitInterviewAnswer);
  $("#interviewHintBtn").addEventListener("click", showInterviewHint);
  $("#interviewRecordBtn").addEventListener("click", () => toggleVoiceInput("#interviewAnswer", "#interviewRecordBtn"));
  $("#clearHistoryBtn").addEventListener("click", clearHistory);
}

function renderRoleGrid() {
  const grid = $("#roleGrid");
  grid.innerHTML = roles
    .map(
      (role) => `
        <button class="role-card ${role.id === state.selectedRole ? "active" : ""}" type="button" data-role="${role.id}">
          <strong>${role.label}</strong>
          <span>${role.desc}</span>
        </button>
      `,
    )
    .join("");

  $$(".role-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRole = button.dataset.role;
      renderRoleGrid();
      persistLightState();
    });
  });
}

function fillDemo() {
  state.selectedRole = "backend";
  renderRoleGrid();
  $("#timelineSelect").value = "一个月内";
  $("#stageSelect").value = "一面前";
  $("#jobTitle").value = "后端开发实习生";
  $("#companyName").value = "互联网电商业务";
  $("#resumeText").value =
    "计算机科学与技术专业，大三。项目经历：电商推荐系统，使用 Java、Spring Boot、MySQL、Redis 实现商品查询、推荐结果缓存和用户行为记录。我负责商品接口、Redis 缓存设计、MySQL 表结构设计，并优化了推荐接口响应时间。竞赛经历：蓝桥杯省二。熟悉 Java 基础、数据库、操作系统、计算机网络，做过课程项目和实验室项目，目前没有正式大厂实习经历。";
  $("#jdText").value =
    "岗位：后端开发实习生。要求熟悉 Java 基础、Spring Boot、MySQL、Redis，有良好的数据结构与算法基础，了解 HTTP、TCP/IP、操作系统基础。有项目开发经验，能说明技术选型、接口设计、数据库设计和性能优化。加分项：了解缓存一致性、消息队列、分布式系统基础。";
  generateWorkspace();
}

function handleFile(event, textareaSelector, labelSelector) {
  const file = event.target.files[0];
  if (!file) return;
  const label = $(labelSelector);
  label.textContent = file.name;
  const lowerName = file.name.toLowerCase();
  const isTextLike = lowerName.endsWith(".txt") || lowerName.endsWith(".md") || file.type.startsWith("text/");

  if (!isTextLike) {
    showToast("当前静态 MVP 已记录文件名。PDF、DOCX、图片 OCR 需要后端服务，建议先粘贴文本继续体验。");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    $(textareaSelector).value = String(reader.result || "");
    showToast("文件文本已读取，可继续生成诊断。");
  };
  reader.onerror = () => showToast("文件读取失败，请改用文本粘贴。");
  reader.readAsText(file, "utf-8");
}

function generateWorkspace() {
  const materials = getMaterials();
  if (!materials.resumeText.trim() && !materials.jdText.trim() && !materials.jobTitle.trim()) {
    showToast("请至少填写岗位名称、JD 或简历材料中的一项。");
    return;
  }

  state.diagnosis = analyzeMaterials(materials);
  state.questionBank = generateQuestionBank(materials, state.diagnosis);
  state.selectedQuestion = state.questionBank[0] || null;
  state.selectedLevel = "基础";
  state.selectedType = "全部";

  $$(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.level === "基础");
  });

  renderDiagnosis(state.diagnosis);
  populateTypeFilter();
  renderQuestions();
  renderSelectedQuestion();
  $("#heroQuestionCount").textContent = state.questionBank.length;
  showToast("已生成岗位匹配诊断和个性化题库。");
  location.hash = "#diagnosis";
}

function getMaterials() {
  const role = roles.find((item) => item.id === state.selectedRole) || roles[0];
  return {
    role,
    timeline: $("#timelineSelect").value,
    stage: $("#stageSelect").value,
    resumeText: $("#resumeText").value.trim(),
    jdText: $("#jdText").value.trim(),
    jobTitle: $("#jobTitle").value.trim() || role.label + "实习生",
    companyName: $("#companyName").value.trim(),
  };
}

function analyzeMaterials(materials) {
  const mergedText = `${materials.resumeText} ${materials.jdText} ${materials.jobTitle}`;
  const roleKeywords = materials.role.keywords;
  const resumeHits = findKeywordHits(materials.resumeText, roleKeywords);
  const jdHits = findKeywordHits(materials.jdText || materials.jobTitle, roleKeywords);
  const allHits = [...new Set([...resumeHits, ...jdHits])];
  const hasProject = /项目|系统|平台|工具|应用|竞赛|实验室|课程设计|负责|实现|开发/.test(materials.resumeText);
  const hasMetric = /\d+|%|提升|降低|优化|响应时间|准确率|留存|转化|QPS|耗时/.test(materials.resumeText);
  const hasInternship = /实习|公司|业务|上线|用户|生产|团队/.test(materials.resumeText);
  const hasJD = materials.jdText.length > 20;

  let score = 42;
  score += Math.min(resumeHits.length * 5, 22);
  score += Math.min(jdHits.length * 3, 16);
  if (hasProject) score += 9;
  if (hasMetric) score += 8;
  if (hasInternship) score += 6;
  if (hasJD) score += 6;
  if (materials.role.id === "uncertain") score -= 8;
  if (materials.resumeText.length < 80) score -= 10;
  score = Math.max(28, Math.min(score, 92));

  const strengths = [];
  if (allHits.length) strengths.push(`材料中出现 ${allHits.slice(0, 5).join("、")}，与${materials.role.label}方向有直接关联。`);
  if (hasProject) strengths.push("简历包含项目或实践经历，可以作为项目深挖的主线。");
  if (hasMetric) strengths.push("材料中出现数据或优化表述，具备量化表达基础。");
  if (hasJD) strengths.push("已提供 JD 文本，题库可以围绕真实岗位要求生成。");
  if (!strengths.length) strengths.push("已经完成基础岗位输入，可以先生成标准岗位画像进行练习。");

  const missingKeywords = roleKeywords.filter((keyword) => !textContains(mergedText, keyword)).slice(0, 5);
  const risks = [];
  if (materials.role.id === "uncertain") risks.push("岗位方向尚不明确，题库个性化会偏弱，建议先选择一个主攻方向。");
  if (!hasJD) risks.push("缺少完整 JD，暂时只能按标准岗位画像生成题库。");
  if (!hasProject) risks.push("简历项目线索不足，技术/业务面容易被追问个人贡献。");
  if (!hasMetric) risks.push("项目结果缺少量化指标，面试官可能追问效果如何衡量。");
  if (!hasInternship) risks.push("没有明显实习或真实业务经历，需要把课程/个人项目讲得更像工程实践。");
  if (missingKeywords.length) risks.push(`与岗位相关但材料中较少出现：${missingKeywords.join("、")}。`);

  const priorities = [
    hasProject ? "把最核心项目改写成：背景、个人职责、技术方案、结果指标、复盘。" : "先补充 1-2 个可讲项目，每个项目写清个人负责部分。",
    missingKeywords.length ? `优先补齐 ${missingKeywords.slice(0, 3).join("、")} 的高频面试问题。` : "围绕已有关键词准备更深层追问。",
    hasJD ? "按 JD 要求准备 8-12 个高频考察点，并做一次标准模拟。" : "补充目标岗位 JD，让题库从标准画像升级为岗位定制。",
    "准备 3 个行为面故事：压力、协作、失败、主动推动。",
  ];

  return {
    score,
    strengths,
    risks: risks.slice(0, 5),
    priorities,
    hits: allHits,
    missingKeywords,
    hasProject,
    hasMetric,
    hasInternship,
    hasJD,
    materials,
  };
}

function renderEmptyDiagnosis() {
  $("#strengthList").innerHTML = "<li>等待生成后展示岗位优势。</li>";
  $("#riskList").innerHTML = "<li>等待生成后展示面试风险。</li>";
  $("#priorityList").innerHTML = "<li>等待生成后展示准备优先级。</li>";
}

function renderDiagnosis(diagnosis) {
  $("#matchScore").textContent = `${diagnosis.score}/100`;
  $("#scoreBar").style.width = `${diagnosis.score}%`;
  $("#matchSummary").textContent =
    diagnosis.score >= 75
      ? "匹配度较好，下一步重点提升项目深度和追问承压。"
      : diagnosis.score >= 58
        ? "具备基础匹配度，但需要补齐项目表达、岗位关键词和量化结果。"
        : "当前材料偏弱，建议先补充简历项目和目标 JD，再进行标准模拟。";
  $("#strengthList").innerHTML = diagnosis.strengths.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
  $("#riskList").innerHTML = diagnosis.risks.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
  $("#priorityList").innerHTML = diagnosis.priorities.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
}

function generateQuestionBank(materials, diagnosis) {
  const roleLabel = materials.role.label === "尚不确定" ? "目标岗位" : materials.role.label;
  const evidence = diagnosis.hits.length ? diagnosis.hits.slice(0, 3).join("、") : materials.jobTitle;
  const base = [
    q("基础", "自我介绍", "HR面", `请用 1 分钟介绍自己，并突出你为什么适合${roleLabel}实习。`, "考察表达结构和岗位动机", evidence, ["身份背景", "关键项目", "岗位匹配点", "一句话结论"], ["流水账", "没有岗位关联"], ["你提到的项目中，哪一部分最能证明你的能力？"]),
    q("基础", "求职动机", "HR面", `你为什么选择${roleLabel}方向，而不是其他实习方向？`, "考察方向选择是否真实", roleLabel, ["兴趣来源", "能力基础", "目标岗位要求", "未来计划"], ["只说感兴趣", "没有经历证据"], ["你是怎么验证自己适合这个方向的？"]),
    q("基础", "简历深挖", "技术/业务面", "请挑一个简历中最有代表性的项目，讲清背景、你的职责和结果。", "考察项目讲述能力", "简历项目", ["项目背景", "个人职责", "技术方案", "结果指标"], ["没有个人贡献", "只讲技术名词"], ["这个项目最大的技术难点是什么？"]),
    q("基础", "项目追问", "技术/业务面", "这个项目中你做过最重要的技术决策是什么？为什么这样选？", "考察技术选择和取舍", evidence, ["候选方案", "选择原因", "权衡", "结果"], ["只有结论", "没有对比"], ["如果重新做一次，你会怎么优化？"]),
    q("基础", "行为面", "HR面", "请讲一次你在团队合作中主动推动问题解决的经历。", "考察协作和主动性", "团队经历", ["冲突或问题", "你的行动", "沟通方式", "结果"], ["没有冲突", "看不出你的贡献"], ["如果对方不配合，你会怎么处理？"]),
    q("基础", "技术基础", "技术/业务面", `你认为${roleLabel}实习生最需要具备的三项基础能力是什么？`, "考察岗位理解", roleLabel, ["岗位能力", "个人证据", "短板认知"], ["泛泛而谈", "没有例子"], ["你现在最弱的一项怎么补？"]),
    q("基础", "压力面", "压力面", "你目前没有大厂实习经历，如何证明你能胜任这个岗位？", "考察经历可信度", "经历短板", ["项目证据", "学习速度", "可迁移能力", "具体准备"], ["回避问题", "空泛保证"], ["面试官为什么应该相信你？"]),
    q("基础", "反问环节", "HR面", "如果面试结束前让你反问，你会问什么？", "考察成熟度和岗位关注点", "反问", ["业务问题", "岗位成长", "团队协作", "避免薪资优先"], ["问培训吗", "问能不能转正但无上下文"], ["这个问题如何体现你做过准备？"]),
    q("基础", "算法基础", "技术/业务面", "你最近准备过哪类算法题？请说一个题型和你的解题思路。", "考察基础准备情况", "算法", ["题型", "思路", "复杂度", "复盘"], ["只说刷过", "没有复杂度"], ["如果数据规模扩大，复杂度是否可接受？"]),
    q("基础", "阶段规划", "HR面", `距离${materials.stage}，你接下来一周会怎么准备？`, "考察准备计划", materials.stage, ["优先级", "时间安排", "材料完善", "模拟计划"], ["计划过大", "没有检验方式"], ["你怎么判断自己准备好了？"]),
  ];

  const advanced = roleAdvancedQuestions(materials.role.id, roleLabel, evidence);
  const challenge = roleChallengeQuestions(roleLabel, evidence, diagnosis);
  return [...base, ...advanced, ...challenge].map((item, index) => ({ ...item, id: `q-${index + 1}` }));
}

function q(level, type, role, text, intent, evidence, points, pitfalls, followUps) {
  return {
    level,
    type,
    role,
    text,
    intent,
    evidence,
    points,
    pitfalls,
    followUps,
    duration: level === "基础" ? "60-90 秒" : level === "进阶" ? "90-150 秒" : "120-180 秒",
  };
}

function roleAdvancedQuestions(roleId, roleLabel, evidence) {
  const shared = [
    q("进阶", "简历深挖", "技术/业务面", "你在项目里负责的模块边界是什么？哪些不是你做的？", "考察真实性和个人贡献", "简历项目", ["负责范围", "协作边界", "关键产出", "可验证细节"], ["把团队成果全说成自己做的"], ["如果我只问你负责的部分，最难的问题是什么？"]),
    q("进阶", "项目追问", "技术/业务面", "项目上线或验收后，你怎么判断它是有效的？", "考察结果意识", "项目结果", ["核心指标", "对比基线", "用户或业务影响", "不足"], ["没有衡量指标"], ["这些指标是谁定义的？"]),
    q("进阶", "行为面", "HR面", "请讲一次你遇到明显挫折或失败的经历，以及你怎么复盘。", "考察抗压和反思", "失败经历", ["失败背景", "原因", "行动", "复盘"], ["把失败包装成成功"], ["如果再来一次，你会提前做什么？"]),
    q("进阶", "岗位理解", "技术/业务面", `你理解的${roleLabel}实习生在团队里通常承担什么工作？`, "考察岗位认知", roleLabel, ["日常任务", "协作对象", "交付标准", "学习曲线"], ["不了解真实工作"], ["你最担心哪类工作？"]),
  ];

  const map = {
    backend: [
      q("进阶", "技术基础", "技术/业务面", "讲讲 MySQL 索引为什么能提升查询效率，以及什么情况下可能失效。", "考察数据库基础", "MySQL", ["B+树", "最左前缀", "回表", "索引失效场景"], ["只说加索引更快"], ["你的项目中哪个查询适合建索引？"]),
      q("进阶", "技术基础", "技术/业务面", "Redis 在你的项目中解决了什么问题？缓存一致性怎么考虑？", "考察缓存理解", "Redis", ["缓存场景", "过期策略", "一致性", "异常情况"], ["只说用了 Redis"], ["缓存穿透、击穿、雪崩怎么处理？"]),
      q("进阶", "项目追问", "技术/业务面", "如果项目 QPS 提升 10 倍，你会先看哪些瓶颈？", "考察工程思维", "性能优化", ["接口耗时", "数据库", "缓存", "限流降级"], ["直接上分布式"], ["你如何验证瓶颈确实在那里？"]),
      q("进阶", "技术基础", "技术/业务面", "HTTP 和 TCP 分别解决什么问题？一次接口请求大概经历哪些步骤？", "考察网络基础", "HTTP/TCP", ["分层", "连接", "请求响应", "异常"], ["概念混淆"], ["HTTPS 多了哪些过程？"]),
      q("进阶", "项目追问", "技术/业务面", "你的接口如何设计错误码、参数校验和异常处理？", "考察工程规范", "接口设计", ["参数校验", "错误码", "日志", "边界情况"], ["只关注正常流程"], ["线上排查问题你需要哪些日志？"]),
      q("进阶", "技术基础", "技术/业务面", "Java 中 HashMap 的基本原理是什么？并发场景下要注意什么？", "考察语言基础", "Java", ["哈希", "扩容", "链表/树", "并发风险"], ["背结论不讲原理"], ["ConcurrentHashMap 怎么解决并发问题？"]),
      q("进阶", "系统设计", "技术/业务面", "如果让你设计一个简单的用户登录模块，你会考虑哪些表、接口和安全问题？", "考察基础设计能力", "系统设计", ["表结构", "接口", "密码安全", "会话"], ["只画页面"], ["如何防止暴力破解？"]),
      q("进阶", "反问环节", "HR面", "你会如何向面试官反问后端实习生的成长路径？", "考察反问质量", "反问", ["业务场景", "技术栈", "mentor", "交付预期"], ["问很空的问题"], ["这个反问能体现你哪类准备？"]),
    ],
    frontend: [
      q("进阶", "技术基础", "技术/业务面", "React 或 Vue 的组件通信方式有哪些？你在项目中怎么用？", "考察框架基础", "组件", ["父子通信", "状态管理", "场景", "取舍"], ["只背 API"], ["状态复杂后怎么维护？"]),
      q("进阶", "技术基础", "技术/业务面", "浏览器从输入 URL 到页面展示经历哪些关键步骤？", "考察浏览器基础", "浏览器", ["DNS", "TCP/TLS", "HTTP", "渲染"], ["步骤混乱"], ["哪些环节会影响首屏速度？"]),
      q("进阶", "项目追问", "技术/业务面", "你做过哪些前端性能优化？如何证明有效？", "考察性能意识", "性能优化", ["指标", "手段", "前后对比", "监控"], ["没有量化"], ["LCP 或首屏时间怎么优化？"]),
      q("进阶", "工程化", "技术/业务面", "你理解的前端工程化包括哪些内容？项目里做过什么？", "考察工程化认知", "工程化", ["构建", "规范", "测试", "部署"], ["只说用过 Vite"], ["如何保证多人协作质量？"]),
      q("进阶", "技术基础", "技术/业务面", "CSS 布局中 Flex 和 Grid 的适用场景有什么差异？", "考察基础能力", "CSS", ["一维/二维", "场景", "兼容", "响应式"], ["只说都会用"], ["移动端适配怎么做？"]),
      q("进阶", "项目追问", "技术/业务面", "如果用户反馈页面卡顿，你会如何定位问题？", "考察排查能力", "性能问题", ["复现", "Performance", "网络", "渲染"], ["直接猜原因"], ["如何区分接口慢和渲染慢？"]),
      q("进阶", "项目追问", "技术/业务面", "你如何设计一个可复用的表单组件？", "考察抽象能力", "组件设计", ["状态", "校验", "配置", "扩展"], ["过度封装"], ["怎么兼顾灵活性和维护成本？"]),
      q("进阶", "反问环节", "HR面", "你会如何反问前端实习岗位的业务复杂度和技术成长？", "考察岗位关注点", "反问", ["业务", "协作", "代码质量", "成长"], ["只问福利"], ["为什么这个问题有价值？"]),
    ],
    data: [
      q("进阶", "技术基础", "技术/业务面", "请讲一个你熟悉的 SQL 窗口函数使用场景。", "考察 SQL 能力", "SQL", ["业务问题", "窗口函数", "分组排序", "结果解释"], ["只写语法"], ["如果数据量很大怎么优化？"]),
      q("进阶", "业务理解", "技术/业务面", "如果日活下降 10%，你会如何拆解和定位原因？", "考察分析框架", "指标", ["指标拆解", "分群", "漏斗", "假设验证"], ["直接下结论"], ["你会优先看哪三个维度？"]),
      q("进阶", "项目追问", "技术/业务面", "你的数据分析项目最后推动了什么决策？", "考察业务影响", "项目结果", ["问题", "分析", "洞察", "行动"], ["只有图表没有结论"], ["如果业务方不采纳怎么办？"]),
      q("进阶", "技术基础", "技术/业务面", "A/B 实验需要注意哪些问题？", "考察实验意识", "A/B", ["假设", "样本", "指标", "显著性"], ["只说对比两组"], ["实验结果不显著怎么解释？"]),
      q("进阶", "业务理解", "技术/业务面", "如何设计一个实习招聘产品的核心指标体系？", "考察指标体系", "指标", ["北极星指标", "过程指标", "质量指标", "反作弊"], ["堆指标"], ["哪个指标最可能被误读？"]),
      q("进阶", "技术基础", "技术/业务面", "数据清洗时你遇到过哪些脏数据？怎么处理？", "考察细节能力", "数据清洗", ["缺失", "异常", "重复", "口径"], ["泛泛说清洗"], ["处理规则如何验证？"]),
      q("进阶", "项目追问", "技术/业务面", "你如何把分析结论讲给非技术同学听？", "考察沟通能力", "表达", ["业务语言", "图表", "结论先行", "建议"], ["只讲模型"], ["对方质疑数据口径怎么办？"]),
      q("进阶", "反问环节", "HR面", "你会如何反问数据分析实习岗位的数据质量和业务参与程度？", "考察岗位成熟度", "反问", ["数据权限", "业务协作", "指标口径", "产出形式"], ["问得太泛"], ["这个反问如何帮助你判断岗位？"]),
    ],
    algorithm: [
      q("进阶", "技术基础", "技术/业务面", "请讲一个你熟悉的机器学习模型，并说明它适合什么问题。", "考察模型基础", "模型", ["问题类型", "模型原理", "优缺点", "指标"], ["只说用过"], ["如果过拟合怎么处理？"]),
      q("进阶", "项目追问", "技术/业务面", "你的算法项目中，数据集、评价指标和 baseline 分别是什么？", "考察实验设计", "实验", ["数据", "指标", "baseline", "提升"], ["没有对比"], ["为什么选这个指标？"]),
      q("进阶", "技术基础", "技术/业务面", "训练集、验证集和测试集如何划分？要避免什么问题？", "考察基础严谨性", "数据划分", ["划分策略", "泄漏", "分布", "复现"], ["只说比例"], ["线上数据分布变了怎么办？"]),
      q("进阶", "技术基础", "技术/业务面", "召回率和精确率有什么区别？什么场景更看重召回？", "考察指标理解", "指标", ["定义", "场景", "权衡", "阈值"], ["公式背诵"], ["F1 为什么有用？"]),
      q("进阶", "项目追问", "技术/业务面", "如果模型效果不好，你会从哪些方向排查？", "考察问题定位", "模型效果", ["数据", "特征", "模型", "训练策略"], ["只调参数"], ["如何判断是数据问题？"]),
      q("进阶", "技术基础", "技术/业务面", "请讲一个常见排序或推荐系统的基本链路。", "考察业务算法理解", "推荐", ["召回", "粗排", "精排", "重排"], ["只讲模型"], ["每一层优化目标是什么？"]),
      q("进阶", "算法基础", "技术/业务面", "你刷题时如何分析时间复杂度和空间复杂度？", "考察代码基础", "算法", ["输入规模", "循环", "数据结构", "优化"], ["只背答案"], ["复杂度太高时怎么改？"]),
      q("进阶", "反问环节", "HR面", "你会如何反问算法实习岗位的数据、模型和上线参与度？", "考察岗位关注点", "反问", ["数据", "实验", "上线", "mentor"], ["只问能不能发论文"], ["这个反问能判断什么？"]),
    ],
    product: [
      q("进阶", "业务理解", "技术/业务面", "请分析一个你常用产品的核心用户和核心场景。", "考察产品感", "产品分析", ["用户", "场景", "问题", "价值"], ["只评价好不好用"], ["如果你是 PM 会优化哪里？"]),
      q("进阶", "指标体系", "技术/业务面", "你会如何设计一个新功能的成功指标？", "考察指标意识", "指标", ["目标", "主指标", "护栏指标", "观测周期"], ["只看点击率"], ["指标上涨但用户投诉增加怎么办？"]),
      q("进阶", "需求分析", "技术/业务面", "面对多个需求，你如何判断优先级？", "考察决策能力", "需求", ["用户价值", "业务价值", "成本", "风险"], ["凭感觉排序"], ["如果老板意见不同怎么办？"]),
      q("进阶", "项目追问", "技术/业务面", "你做过的产品或运营项目里，如何验证用户真的需要？", "考察验证意识", "用户调研", ["访谈", "数据", "实验", "反馈"], ["只说我觉得"], ["样本有偏怎么办？"]),
      q("进阶", "业务理解", "技术/业务面", "如果一个页面转化率下降，你会如何定位问题？", "考察分析框架", "转化", ["漏斗", "分群", "版本", "外部因素"], ["直接改 UI"], ["如何设计验证方案？"]),
      q("进阶", "沟通协作", "HR面", "请讲一次你和研发、设计或运营协作推进事情的经历。", "考察协作", "项目协作", ["目标", "分歧", "推动", "结果"], ["只讲自己想法"], ["对方不认可你的方案怎么办？"]),
      q("进阶", "PRD", "技术/业务面", "你认为一份好的 PRD 应该包含哪些内容？", "考察基础方法", "PRD", ["背景", "目标", "流程", "需求", "验收"], ["罗列模板"], ["如何减少歧义？"]),
      q("进阶", "反问环节", "HR面", "你会如何反问产品实习岗位的职责边界和成长预期？", "考察岗位关注点", "反问", ["业务阶段", "需求来源", "协作方式", "产出"], ["只问是否能转正"], ["这个问题如何帮助你判断机会？"]),
    ],
    uncertain: [],
  };

  const roleSpecific = map[roleId] && map[roleId].length ? map[roleId] : map.backend.slice(0, 4).concat(map.data.slice(0, 4));
  return [...roleSpecific, ...shared].slice(0, 12);
}

function roleChallengeQuestions(roleLabel, evidence, diagnosis) {
  const risk = diagnosis.risks[0] || "材料里还有不够具体的地方";
  return [
    q("挑战", "压力面", "压力面", `你说自己适合${roleLabel}，但我看到的证据还不够强。你最有力的证明是什么？`, "考察抗压和证据意识", evidence, ["承认短板", "给出证据", "量化结果", "下一步计划"], ["情绪化辩解", "空泛保证"], ["这个证据能被怎样验证？"]),
    q("挑战", "项目追问", "压力面", `针对这个风险：${risk} 你会如何向面试官解释？`, "考察风险修复能力", "风险点", ["正面回应", "事实细节", "补救行动", "结果"], ["回避风险"], ["如果面试官继续质疑呢？"]),
    q("挑战", "简历深挖", "技术/业务面", "请只讲你个人完成的部分，不要讲团队整体成果。", "考察贡献边界", "个人贡献", ["任务边界", "关键动作", "产出", "协作"], ["贡献边界模糊"], ["哪一行代码或哪份文档最能证明？"]),
    q("挑战", "技术基础", "技术/业务面", `如果面试官围绕 ${diagnosis.missingKeywords[0] || "岗位基础"} 连续追问三层，你会怎么补足？`, "考察短板认知", "知识短板", ["当前掌握", "缺口", "学习计划", "验证方式"], ["装懂"], ["今晚你会先看哪三件事？"]),
    q("挑战", "行为面", "压力面", "如果面试官认为你的项目像课程作业，不像真实业务项目，你会怎么回应？", "考察表达转化能力", "项目可信度", ["业务化表达", "真实约束", "用户或数据", "改进计划"], ["否认质疑但没证据"], ["怎样把它改造成更像工程项目？"]),
    q("挑战", "求职动机", "HR面", "你同时投了很多方向吗？为什么我们应该相信你对这个岗位是认真的？", "考察稳定性", roleLabel, ["主线一致", "选择逻辑", "准备证据", "岗位理解"], ["说什么都能做"], ["如果拿到不同 offer 怎么选？"]),
    q("挑战", "项目追问", "技术/业务面", "你项目里最可能被线上真实流量击穿的地方在哪里？", "考察工程意识", "项目风险", ["瓶颈", "异常", "监控", "降级"], ["没有风险意识"], ["你会先加哪类监控？"]),
    q("挑战", "反问环节", "压力面", "如果这轮面试表现一般，你最后会如何通过反问挽回专业度？", "考察临场修复", "反问", ["承认不足", "问岗位核心", "连接准备", "表达成长"], ["问无关福利"], ["这个反问如何体现你能成长？"]),
  ];
}

function populateTypeFilter() {
  const types = ["全部", ...new Set(state.questionBank.map((item) => item.type))];
  $("#typeFilter").innerHTML = types.map((type) => `<option value="${type}">${type}</option>`).join("");
  $("#typeFilter").value = "全部";
}

function renderQuestions() {
  const list = $("#questionList");
  const questions = state.questionBank.filter((item) => {
    const levelOk = item.level === state.selectedLevel;
    const typeOk = state.selectedType === "全部" || item.type === state.selectedType;
    return levelOk && typeOk;
  });

  if (!state.questionBank.length) {
    list.innerHTML = emptyQuestionCards();
    renderSelectedQuestion();
    return;
  }

  list.innerHTML = questions
    .map(
      (item) => `
        <button class="question-card ${state.selectedQuestion?.id === item.id ? "active" : ""}" type="button" data-question-id="${item.id}">
          <div class="tag-row">
            <span class="tag primary">${item.level}</span>
            <span class="tag">${item.type}</span>
            <span class="tag">${item.role}</span>
          </div>
          <strong>${escapeHTML(item.text)}</strong>
          <span class="muted">考察：${escapeHTML(item.intent)}</span>
        </button>
      `,
    )
    .join("");

  $$(".question-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedQuestion = state.questionBank.find((item) => item.id === button.dataset.questionId);
      renderQuestions();
      renderSelectedQuestion();
      location.hash = "#practice";
    });
  });
}

function emptyQuestionCards() {
  return `
    <article class="question-card">
      <div class="tag-row">
        <span class="tag primary">待生成</span>
        <span class="tag">基础/进阶/挑战</span>
      </div>
      <strong>请先在上方填写简历和 JD，生成你的个性化题库。</strong>
      <span class="muted">当前静态 MVP 会基于关键词和岗位画像生成问题。</span>
    </article>
  `;
}

function renderSelectedQuestion() {
  const question = state.selectedQuestion;
  $("#hintBox").hidden = true;
  $("#practiceFeedback").hidden = true;
  $("#practiceAnswer").value = "";

  if (!question) {
    $("#currentQuestion").textContent = "生成题库后，点击任意题目开始练习。";
    $("#currentQuestionMeta").textContent = "未选择题目";
    return;
  }

  $("#currentQuestion").textContent = question.text;
  $("#currentQuestionMeta").textContent = `${question.level} / ${question.type} / ${question.duration}`;
}

function showQuestionHint() {
  const question = state.selectedQuestion;
  if (!question) {
    showToast("请先选择一道题。");
    return;
  }
  const hint = $("#hintBox");
  hint.hidden = false;
  hint.innerHTML = `
    <strong>答题要点</strong>
    <ul>${question.points.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    <strong>常见扣分点</strong>
    <ul>${question.pitfalls.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
  `;
}

function generatePracticeFeedback() {
  const question = state.selectedQuestion;
  const answer = $("#practiceAnswer").value.trim();
  if (!question) {
    showToast("请先选择一道题。");
    return;
  }
  if (!answer) {
    showToast("请先输入或录入你的回答。");
    return;
  }

  const feedback = scoreAnswer(answer, question, getMaterials().role);
  state.practiceRecords.push({ question, answer, feedback, createdAt: new Date().toISOString() });
  const box = $("#practiceFeedback");
  box.hidden = false;
  box.innerHTML = renderFeedback(feedback);
}

function scoreAnswer(answer, question, role) {
  const length = answer.length;
  const hasMetric = /\d+|%|提升|降低|优化|响应时间|准确率|转化|留存|QPS|耗时/.test(answer);
  const hasContribution = /我|本人|负责|主导|实现|设计|推进|优化|排查/.test(answer);
  const hasStructure = /首先|其次|最后|背景|目标|过程|结果|复盘|因此|所以/.test(answer);
  const hasRoleKeyword = role.keywords.some((keyword) => textContains(answer, keyword));
  const hasResult = /结果|效果|指标|上线|验证|提升|降低|完成|产出/.test(answer);

  let score = 48;
  if (length > 60) score += 10;
  if (length > 130) score += 8;
  if (hasMetric) score += 10;
  if (hasContribution) score += 9;
  if (hasStructure) score += 8;
  if (hasRoleKeyword) score += 7;
  if (hasResult) score += 8;
  if (length < 35) score -= 15;
  score = Math.max(25, Math.min(96, score));

  const strengths = [];
  if (hasContribution) strengths.push("能看到个人行动或负责范围。");
  if (hasMetric) strengths.push("包含量化信息，利于提升可信度。");
  if (hasStructure) strengths.push("回答中有一定结构，面试官更容易跟上。");
  if (hasRoleKeyword) strengths.push("回答包含目标岗位相关关键词。");
  if (!strengths.length) strengths.push("已经完成一次作答，可以继续补充细节提升质量。");

  const suggestions = [];
  if (length < 80) suggestions.push("回答偏短，建议至少补充背景、个人行动、结果三个部分。");
  if (!hasMetric) suggestions.push("缺少量化结果。可以补充响应时间、准确率、用户量、转化率、耗时等真实指标。");
  if (!hasContribution) suggestions.push("个人贡献不清晰。建议明确“我负责什么、我做了什么决策、我产出了什么”。");
  if (!hasRoleKeyword) suggestions.push(`与${role.label}岗位关联还不够强，建议加入 1-2 个岗位关键词或真实技术/业务场景。`);
  if (!hasResult) suggestions.push("缺少结果或复盘。建议说明这件事最终带来了什么变化，以及你学到了什么。");
  if (suggestions.length < 3) suggestions.push("下一次可以主动准备一个可能追问，并在回答里提前埋好证据。");

  const followUp = chooseFollowUp(question, answer, suggestions);
  return { score, strengths, suggestions: suggestions.slice(0, 5), followUp };
}

function renderFeedback(feedback) {
  return `
    <strong>单题评分：${feedback.score}/100</strong>
    <div class="report-section">
      <h4>亮点</h4>
      <ul>${feedback.strengths.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </div>
    <div class="report-section">
      <h4>建议改法</h4>
      <ul>${feedback.suggestions.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </div>
    <div class="report-section">
      <h4>可能追问</h4>
      <p>${escapeHTML(feedback.followUp)}</p>
    </div>
  `;
}

function startInterview() {
  if (!state.questionBank.length) {
    generateWorkspace();
  }
  const type = $("#interviewType").value;
  const length = $("#interviewLength").value;
  const maxQuestions = length === "quick" ? 6 : 10;
  const queue = buildInterviewQueue(type, maxQuestions);
  state.interview = {
    active: true,
    type,
    maxQuestions,
    queue,
    turns: [],
    currentQuestion: null,
    questionCount: 0,
    followUps: 0,
  };

  $("#chatTimeline").innerHTML = "";
  $("#interviewAnswer").value = "";
  $("#roomTitle").textContent = `${type}进行中`;
  addInterviewerQuestion(queue.shift() || fallbackQuestion());
  renderInterviewHeader();
  showToast("模拟面试已开始。");
}

function buildInterviewQueue(type, maxQuestions) {
  const roleMap = {
    "HR面": ["HR面"],
    "技术/业务面": ["技术/业务面"],
    "压力面": ["压力面", "技术/业务面"],
    "产品/数据面": ["技术/业务面", "HR面"],
  };
  const rolesForType = roleMap[type] || ["技术/业务面"];
  const preferred = state.questionBank.filter((item) => rolesForType.includes(item.role));
  const mixed = preferred.length >= maxQuestions ? preferred : [...preferred, ...state.questionBank];
  const unique = [];
  const seen = new Set();
  for (const question of mixed) {
    if (!seen.has(question.id)) {
      unique.push(question);
      seen.add(question.id);
    }
    if (unique.length >= maxQuestions + 4) break;
  }
  return unique;
}

function fallbackQuestion() {
  return q("基础", "自我介绍", "HR面", "请先做一个 1 分钟自我介绍，并说明你想投递的实习方向。", "建立开场上下文", "开场", ["背景", "经历", "岗位", "结论"], ["没有重点"], ["你最希望面试官记住你哪一点？"]);
}

function addInterviewerQuestion(question, isFollowUp = false) {
  state.interview.currentQuestion = { ...question, isFollowUp };
  state.interview.questionCount += 1;
  appendMessage("interviewer", isFollowUp ? "追问" : state.interview.type, question.text);
  renderInterviewHeader();
}

function appendMessage(kind, label, text) {
  const timeline = $("#chatTimeline");
  const message = document.createElement("div");
  message.className = `message ${kind}`;
  message.innerHTML = `<small>${escapeHTML(label)}</small>${escapeHTML(text)}`;
  timeline.appendChild(message);
  timeline.scrollTop = timeline.scrollHeight;
}

function submitInterviewAnswer() {
  const interview = state.interview;
  if (!interview || !interview.active || !interview.currentQuestion) {
    showToast("请先开始模拟面试。");
    return;
  }
  const answer = $("#interviewAnswer").value.trim();
  if (!answer) {
    showToast("请先输入你的回答。");
    return;
  }

  appendMessage("candidate", "你的回答", answer);
  const feedback = scoreAnswer(answer, interview.currentQuestion, getMaterials().role);
  interview.turns.push({
    question: interview.currentQuestion,
    answer,
    feedback,
    isFollowUp: interview.currentQuestion.isFollowUp,
  });
  $("#interviewAnswer").value = "";

  const needsFollowUp = shouldAskFollowUp(answer, feedback, interview);
  if (needsFollowUp) {
    const followQuestion = {
      ...interview.currentQuestion,
      text: feedback.followUp,
      level: "挑战",
      role: "压力面",
      followUps: ["请再补充一个更具体的证据。"],
    };
    interview.followUps += 1;
    addInterviewerQuestion(followQuestion, true);
    return;
  }

  if (interview.questionCount >= interview.maxQuestions || interview.queue.length === 0) {
    finishInterview();
    return;
  }

  addInterviewerQuestion(interview.queue.shift());
}

function shouldAskFollowUp(answer, feedback, interview) {
  if (interview.followUps >= 4) return false;
  if (interview.currentQuestion.isFollowUp) return false;
  if (interview.questionCount >= interview.maxQuestions) return false;
  const answerTooShort = answer.length < 90;
  const lowScore = feedback.score < 72;
  const missingMetric = feedback.suggestions.some((item) => item.includes("量化"));
  const missingContribution = feedback.suggestions.some((item) => item.includes("个人贡献"));
  return answerTooShort || lowScore || missingMetric || missingContribution;
}

function chooseFollowUp(question, answer, suggestions) {
  if (answer.length < 70) return "你刚才的回答偏短，请补充一个具体例子，包括背景、你的行动和结果。";
  if (suggestions.some((item) => item.includes("量化"))) return "你提到了结果，但没有量化。这个结果如何衡量？有没有前后对比？";
  if (suggestions.some((item) => item.includes("个人贡献"))) return "这件事里你个人负责哪一部分？哪些是你独立完成的？";
  if (question.followUps && question.followUps.length) return question.followUps[0];
  return "如果面试官继续追问，你认为这个回答里最容易被质疑的点是什么？";
}

function renderInterviewHeader() {
  const interview = state.interview;
  if (!interview) {
    $("#roomProgress").textContent = "0 / 0";
    $("#followUpCount").textContent = "追问 0 次";
    return;
  }
  $("#roomProgress").textContent = `${Math.min(interview.questionCount, interview.maxQuestions)} / ${interview.maxQuestions}`;
  $("#followUpCount").textContent = `追问 ${interview.followUps} 次`;
}

function showInterviewHint() {
  const interview = state.interview;
  if (!interview || !interview.currentQuestion) {
    showToast("请先开始模拟面试。");
    return;
  }
  appendMessage("interviewer", "轻提示", `可以按这个结构回答：${interview.currentQuestion.points.join("、")}。不要背模板，尽量使用你的真实经历。`);
}

function finishInterview() {
  const interview = state.interview;
  if (!interview || !interview.turns.length) {
    showToast("还没有可生成报告的面试记录。");
    return;
  }
  interview.active = false;
  $("#roomTitle").textContent = "模拟已结束";
  const report = buildReport(interview);
  renderReport(report);
  saveReport(report);
  showToast("报告已生成。");
  location.hash = "#report";
}

function buildReport(interview) {
  const scores = interview.turns.map((turn) => turn.feedback.score);
  const avg = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const role = getMaterials().role;
  const dimensions = {
    岗位匹配: clamp(avg + (state.diagnosis ? Math.round((state.diagnosis.score - 70) / 4) : 0)),
    项目深度: clamp(avg - missingSignalPenalty("个人贡献")),
    "技术/岗位基础": clamp(avg + (state.diagnosis?.hits.length || 0) - missingSignalPenalty("岗位关联")),
    结构表达: clamp(avg - missingSignalPenalty("回答偏短")),
    真实性: clamp(avg - missingSignalPenalty("量化")),
    追问承压: clamp(avg - interview.followUps * 2 + 8),
    行为面表现: clamp(avg - missingSignalPenalty("结果")),
  };

  const allSuggestions = interview.turns.flatMap((turn) => turn.feedback.suggestions);
  const topSuggestions = [...new Set(allSuggestions)].slice(0, 7);
  const risks = topSuggestions.filter((item) => /缺少|不清晰|偏短|不够/.test(item)).slice(0, 5);
  const strengths = [...new Set(interview.turns.flatMap((turn) => turn.feedback.strengths))].slice(0, 5);
  const materials = getMaterials();
  const createdAt = new Date().toISOString();

  return {
    id: `r-${Date.now()}`,
    createdAt,
    role: role.label,
    jobTitle: materials.jobTitle,
    companyName: materials.companyName,
    type: interview.type,
    score: avg,
    dimensions,
    strengths,
    risks,
    suggestions: topSuggestions,
    actionPlan: buildActionPlan(role, topSuggestions),
    turns: interview.turns,
  };
}

function missingSignalPenalty(keyword) {
  const interview = state.interview;
  if (!interview) return 0;
  const count = interview.turns.flatMap((turn) => turn.feedback.suggestions).filter((item) => item.includes(keyword)).length;
  return Math.min(count * 4, 16);
}

function clamp(value) {
  return Math.max(35, Math.min(96, Math.round(value)));
}

function buildActionPlan(role, suggestions) {
  const keyword = role.id === "backend" ? "MySQL/Redis/Java" : role.id === "frontend" ? "浏览器/组件/性能" : role.id === "data" ? "SQL/指标/业务分析" : role.id === "algorithm" ? "模型/实验/算法题" : "需求/指标/用户分析";
  const needsMetric = suggestions.some((item) => item.includes("量化"));
  const needsContribution = suggestions.some((item) => item.includes("个人贡献"));
  return {
    "7 天": [
      needsContribution ? "重写核心项目经历，明确个人负责模块、关键动作和产出。" : "整理 1 个最能代表岗位能力的核心项目。",
      needsMetric ? "为项目补充真实可验证的量化指标或前后对比。" : "准备 3 个项目追问的证据细节。",
      `补齐 ${keyword} 高频问题 20 道，并整理错题。`,
    ],
    "14 天": [
      "完成 2 次项目专项模拟和 1 次 HR 面模拟。",
      "准备 3 个行为面故事：协作、压力、失败复盘。",
      "将简历中的技术关键词和 JD 要求逐项对齐。",
    ],
    "30 天": [
      "完成 3 次不同面试官类型的标准模拟。",
      "形成一版可稳定复述的自我介绍和项目讲述稿。",
      "针对目标公司补充业务理解和反问清单。",
    ],
  };
}

function renderReport(report) {
  const card = $("#reportCard");
  card.innerHTML = `
    <div class="report-summary">
      <div class="big-score">
        <div>
          <strong>${report.score}</strong>
          <span>总分 / 100</span>
        </div>
      </div>
      <div>
        <h3>${escapeHTML(report.type)}报告</h3>
        <p class="muted">${escapeHTML(report.jobTitle)} · ${escapeHTML(report.companyName || report.role)} · ${formatDate(report.createdAt)}</p>
        <div class="score-list">
          ${Object.entries(report.dimensions)
            .map(
              ([name, score]) => `
                <div class="score-item">
                  <span>${escapeHTML(name)}</span>
                  <div class="mini-track"><span style="--width: ${score}%"></span></div>
                  <strong>${score}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
    <div class="report-section">
      <h4>关键亮点</h4>
      <ul>${report.strengths.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </div>
    <div class="report-section">
      <h4>高风险问题</h4>
      <ul>${(report.risks.length ? report.risks : report.suggestions.slice(0, 3)).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
    </div>
    <div class="report-section">
      <h4>逐题复盘</h4>
      ${report.turns
        .map(
          (turn, index) => `
            <div class="turn-card">
              <strong>Q${index + 1}：${escapeHTML(turn.question.text)}</strong>
              <p><b>你的回答：</b>${escapeHTML(turn.answer)}</p>
              <p><b>单题评分：</b>${turn.feedback.score}/100</p>
              <p><b>建议：</b>${escapeHTML(turn.feedback.suggestions[0] || "继续补充细节。")}</p>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="report-section">
      <h4>行动计划</h4>
      ${Object.entries(report.actionPlan)
        .map(([period, items]) => `<strong>${period}</strong><ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`)
        .join("")}
    </div>
  `;
}

function saveReport(report) {
  state.history.unshift(report);
  state.history = state.history.slice(0, 8);
  localStorage.setItem(storageKey, JSON.stringify(state.history));
  renderHistory();
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const list = $("#historyList");
  if (!state.history.length) {
    list.innerHTML = `<p class="muted">完成模拟后会保存最近 8 份报告。</p>`;
    return;
  }
  list.innerHTML = state.history
    .map(
      (report) => `
        <button class="history-item" type="button" data-report-id="${report.id}">
          <strong>${escapeHTML(report.type)} · ${report.score}/100</strong>
          <span>${escapeHTML(report.jobTitle || report.role)} · ${formatDate(report.createdAt)}</span>
        </button>
      `,
    )
    .join("");

  $$(".history-item").forEach((item) => {
    item.addEventListener("click", () => {
      const report = state.history.find((entry) => entry.id === item.dataset.reportId);
      if (report) renderReport(report);
    });
  });
}

function clearHistory() {
  state.history = [];
  localStorage.removeItem(storageKey);
  renderHistory();
  showToast("历史记录已清空。");
}

async function toggleVoiceInput(textareaSelector, buttonSelector) {
  const button = $(buttonSelector);
  if (activeRecorder) {
    activeRecorder.stop();
    activeRecorder = null;
    if (activeRecognition) {
      activeRecognition.stop();
      activeRecognition = null;
    }
    button.textContent = "语音作答";
    showToast("录音已停止。若浏览器支持语音识别，转写会自动填入回答框。");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("当前浏览器不支持录音，请使用文字作答。");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    activeRecorder = new MediaRecorder(stream);
    activeRecorder.start();
    button.textContent = "停止录音";
    showToast("正在录音。");
    startSpeechRecognition(textareaSelector);
    activeRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
    };
  } catch {
    showToast("无法获取麦克风权限，请检查浏览器设置或改用文字作答。");
  }
}

function startSpeechRecognition(textareaSelector) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("当前浏览器不支持实时语音转写，已仅开启录音占位。");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let text = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      text += event.results[index][0].transcript;
    }
    const textarea = $(textareaSelector);
    textarea.value = `${textarea.value.replace(/\s*$/, "")}${text}`.trim();
  };
  recognition.onerror = () => showToast("语音转写失败，可继续使用文字输入。");
  recognition.start();
  activeRecognition = recognition;
}

function persistLightState() {
  // Reserved for future server sync. The static MVP keeps primary data in form fields and report history.
}

function findKeywordHits(text, keywords) {
  return keywords.filter((keyword) => textContains(text, keyword));
}

function textContains(text, keyword) {
  return String(text || "").toLowerCase().includes(String(keyword).toLowerCase());
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
