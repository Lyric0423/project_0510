const BASE_SYSTEM_PROMPT = `
你是“面试舱 AI - 大厂实习版”的资深模拟面试官与求职教练。
你的用户是准备互联网大厂实习面试的本科生，主要方向包括后端、前端、数据分析、算法、产品经理。

你必须遵守：
1. 核心围绕大厂实习面试。
2. 必须结合用户简历、岗位 JD、岗位方向提问和反馈，不要只给通用建议。
3. 不编造用户经历、公司、奖项、论文、指标；缺少信息时提示用户补充真实材料。
4. 模拟面试中不给完整可背诵答案，只给结构、要点、风险和追问。
5. 反馈必须具体、可执行，尽量指出“哪类表达缺少个人贡献、量化结果、岗位关联或知识深度”。
6. 不承诺 offer、通过率或录用概率。
7. 输出必须是合法 JSON，不要输出 Markdown。
`;

function buildDiagnoseAndQuestionsPrompt(payload) {
  return `
请根据以下材料，输出岗位匹配诊断和面试题库。

材料：
${JSON.stringify(payload.materials, null, 2)}

输出 JSON 结构：
{
  "diagnosis": {
    "score": 0-100,
    "strengths": ["3-5条优势，每条必须引用简历或JD信息"],
    "risks": ["3-5条风险，每条给出会被追问的原因"],
    "priorities": ["3-5条准备优先级，每条必须可执行"]
  },
  "questionBank": [
    {
      "level": "基础|进阶|挑战",
      "type": "自我介绍|求职动机|简历深挖|项目追问|技术基础|算法/数据结构|业务理解|行为面|压力面|反问环节",
      "role": "HR面|技术/业务面|压力面|产品/数据面",
      "text": "题目正文",
      "intent": "考察意图",
      "evidence": "关联的简历或JD证据",
      "points": ["答题要点，不是完整答案"],
      "pitfalls": ["常见扣分点"],
      "followUps": ["可能追问"],
      "duration": "推荐作答时长"
    }
  ]
}

要求：
- 至少 30 道题：基础 10，进阶 12，挑战 8。
- 至少 40% 题目必须引用简历或 JD 的具体信息。
- 挑战题要压到用户短板，不要只是把基础题换个说法。
- 只输出 JSON。
`;
}

function buildFeedbackPrompt(payload) {
  return `
请对用户单题回答做面试官反馈。

材料：
${JSON.stringify(payload.materials, null, 2)}

题目：
${JSON.stringify(payload.question, null, 2)}

用户回答：
${payload.answer}

输出 JSON：
{
  "feedback": {
    "score": 0-100,
    "strengths": ["2-4条亮点"],
    "suggestions": ["3-6条具体改进建议"],
    "followUp": "基于该回答最应该继续追问的一个问题"
  }
}

要求：
- 建议必须具体到内容、表达、知识或项目证据。
- 不要给完整标准答案。
- 不要编造用户没说过的经历。
- 只输出 JSON。
`;
}

function buildInterviewNextQuestionPrompt(payload) {
  return `
请作为正在视频面试中的面试官，基于候选人材料、当前面试状态和上一轮回答，生成下一道面试问题。

材料：
${JSON.stringify(payload.materials, null, 2)}

面试状态：
${JSON.stringify(payload.interview, null, 2)}

上一轮回答：
${payload.previousAnswer || "暂无，这是开场问题。"}

输出 JSON：
{
  "question": {
    "level": "基础|进阶|挑战",
    "type": "自我介绍|求职动机|简历深挖|项目追问|技术基础|算法/数据结构|业务理解|行为面|压力面|反问环节",
    "role": "HR面|技术/业务面|压力面|产品/数据面",
    "text": "下一道问题正文",
    "intent": "考察意图",
    "evidence": "关联的简历、JD或上一轮回答证据",
    "points": ["答题要点，不是完整答案"],
    "pitfalls": ["常见扣分点"],
    "followUps": ["可能追问"],
    "duration": "推荐作答时长"
  }
}

要求：
- 问题必须贴合用户简历、JD、面试类型和上一轮回答，不要泛泛提问。
- 如果上一轮回答短、虚、缺少指标或个人贡献，要优先追问证据。
- 不要连续重复同一类问题。
- 只输出 JSON。
`;
}

function buildReportPrompt(payload) {
  return `
请基于一次模拟面试记录，生成更专业的报告补充。

材料：
${JSON.stringify(payload.materials, null, 2)}

本地报告草稿：
${JSON.stringify(payload.localReport, null, 2)}

输出 JSON：
{
  "report": {
    "score": 0-100,
    "strengths": ["3-6条关键亮点"],
    "risks": ["3-6条高风险问题"],
    "suggestions": ["5-8条具体建议"],
    "actionPlan": {
      "7 天": ["3条行动"],
      "14 天": ["3条行动"],
      "30 天": ["3条行动"]
    }
  }
}

要求：
- 报告必须引用用户真实回答中暴露的问题。
- 行动计划要适合大厂实习面试准备。
- 不要承诺录用概率。
- 只输出 JSON。
`;
}

module.exports = {
  BASE_SYSTEM_PROMPT,
  buildDiagnoseAndQuestionsPrompt,
  buildFeedbackPrompt,
  buildInterviewNextQuestionPrompt,
  buildReportPrompt,
};
