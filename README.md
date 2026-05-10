# 面试舱 AI - 大厂实习版 MVP

这是一个面向本科生大厂实习面试准备的 Web/H5 MVP，依据 `prd_bigtech_internship_mvp.md` 制作。

当前版本是静态可部署网站，不依赖前端构建工具或 npm 包。它已经包含完整体验闭环：

- 岗位方向选择；
- 简历文本/文件输入；
- JD 文本/文件输入；
- 岗位匹配诊断；
- 基础/进阶/挑战三层题库；
- 自主练习与单题反馈；
- 模拟面试与动态追问；
- 面试报告；
- 本地历史记录。

## 本地运行

在项目目录执行：

```bash
python3 -m http.server 5173
```

然后访问：

```text
http://localhost:5173
```

## 文件说明

- `index.html`：页面结构；
- `styles.css`：界面样式；
- `app.js`：本地 MVP 交互逻辑；
- `prd_bigtech_internship_mvp.md`：大厂实习 MVP PRD；
- `DEPLOY_ALIYUN.md`：阿里云/Nginx 部署说明。

## 当前边界

当前版本先用本地规则模拟 AI 能力，方便快速验证主流程。真实上线时建议继续接入：

- 大模型服务；
- 简历 PDF/DOCX 解析；
- JD 图片 OCR；
- 云端 ASR；
- 用户登录与支付；
- 后端数据库与对象存储。
