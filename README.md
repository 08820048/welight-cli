# Welight CLI

微信公众号 Markdown 排版与发布命令行工具。免费、开源、**全部 BYOK（自带密钥）**。

Welight CLI 复用 [Welight 桌面端](https://welight.fyi) 的渲染与主题内核，去掉了图形编辑器与官方托管服务，面向习惯命令行、需要脚本化/自动化，或希望完全掌控自己密钥与出口 IP 的用户。

## 与桌面端的关系

| | 桌面端（收费） | CLI（免费开源） |
| --- | --- | --- |
| 编辑器 / 实时预览 | ✅ | ❌ |
| 一键排版 / 主题库 | ✅ 全部主题 | ✅ 仅前 45%（13 套） |
| CSS 主题编辑 | ✅ | ❌ |
| 复制到公众号 / 发布草稿 | ✅ | ✅ |
| 公众号图床 | ✅ | ✅ |
| 朱雀 AIGC 检测 | ✅ 内置额度 | ✅ 仅自配 Key |
| 规则检查 / 标题推荐 / Welight AI | ✅ | ✅ 仅自配 Key |
| 微信 API 代理 | ✅ 官方固定出口 | ❌ 需自行解决出口 IP |
| 其他图床（GitHub/OSS/COS/R2 等） | ✅ | ❌ |

CLI 不内置任何官方服务，所有模型与云服务均使用你自己的密钥。

## 安装

```bash
# 全局安装
npm install -g welight

# 或免安装运行
npx welight --help
pnpm dlx welight --help
```

要求 Node.js `>=22.16.0`。

## 快速开始

```bash
# 生成配置模板
welight init

# 列出可用的免费主题
welight themes

# 渲染 Markdown 为带主题样式的 HTML
welight render post.md --theme w011 --out out.html

# 生成公众号内联 HTML 并复制到剪贴板（到公众号后台直接粘贴）
welight copy post.md --theme w011

# 发布到公众号草稿箱（直连微信，需先加 IP 白名单）
WELIGHT_WECHAT_APP_ID=xxx WELIGHT_WECHAT_APP_SECRET=yyy welight publish post.md --cover ./cover.png

# 规则检查（CI 门禁：命中高危时退出码 1）
welight lint post.md --fail-on high

# 朱雀 AIGC 检测（自配 EdgeOne Key）
WELIGHT_ZHUQUE_KEY=xxx welight detect post.md --max-ai 40

# 生成候选标题（BYOK OpenAI 兼容模型）
WELIGHT_MODEL_API_KEY=xxx WELIGHT_MODEL_BASE_URL=https://api.deepseek.com/v1 WELIGHT_MODEL=deepseek-chat \
  welight title post.md --count 5

# Welight AI：带文章上下文的写作助手（可调用规则扫描/朱雀检测工具）
WELIGHT_MODEL_API_KEY=xxx WELIGHT_MODEL_BASE_URL=... WELIGHT_MODEL=... \
  welight ai "这篇文章有没有平台规则风险？" --file post.md

# 从管道读取，输出到 stdout
cat post.md | welight render - > out.html

# 环境自检（依赖、配置、密钥状态）
welight doctor
```

## 免费主题（13 套）

CLI 只提供全部主题的前 45%：`w001 玉兰`、`w002 牡丹`、`w003 雏菊`、`w004 向日葵`、`w005 罂粟`、`w006 白百合`、`w007 蓝鸢尾`、`w009 黑玫瑰`、`w010 铃兰`、`w011 白茶`、`w012 绣球`、`w013 梅花`、`w014 勿忘我`。

其余主题请使用 Welight 桌面端。

## 配置与密钥（BYOK）

配置文件 `welight.config.json`（由 `welight init` 生成）：

```json
{
  "theme": "w001",
  "primaryColor": "#4876b8",
  "fontFamily": "-apple-system, ...",
  "fontSize": "16px",
  "customCSS": ""
}
```

密钥只从环境变量读取，不写入配置文件：

| 变量 | 用途 |
| --- | --- |
| `WELIGHT_MODEL_API_KEY` | 模型 API Key（Welight AI / 标题推荐） |
| `WELIGHT_MODEL_BASE_URL` | OpenAI 兼容接口地址，如 `https://api.deepseek.com/v1` |
| `WELIGHT_MODEL` | 模型名，如 `deepseek-chat` |
| `WELIGHT_TYPESAFE_KEY` | TypeSafe System One 判断层（排版自动档、语义复核、标题评分） |
| `WELIGHT_ZHUQUE_KEY` | 腾讯 EdgeOne / 朱雀 AIGC 检测 |
| `WELIGHT_WECHAT_APP_ID` / `WELIGHT_WECHAT_APP_SECRET` | 微信公众号 |

> CLI 不提供官方微信 API 代理。发布相关命令直连 `api.weixin.qq.com`，需要你把当前网络出口 IP 加入公众号后台的 IP 白名单（报错 `40164` 即为未加白名单）。CI 环境出口 IP 不稳定，请自行准备固定出口。

## 命令

| 命令 | 说明 |
| --- | --- |
| `welight render <file>` | 渲染为带主题样式的独立 HTML，可 `--out` 写文件或输出到 stdout |
| `welight copy <file>` | 生成公众号内联 HTML 并写入系统剪贴板，到公众号后台粘贴 |
| `welight publish <file>` | 渲染并直连微信接口创建公众号草稿（不做正式发布） |
| `welight lint <file>` | 扫描公众号平台规则命中，可用 `--json`/`--fail-on` 接入 CI |
| `welight detect <file>` | 腾讯朱雀 AIGC 检测，可用 `--json`/`--max-ai` 接入 CI |
| `welight title <file>` | 生成候选标题（BYOK 模型），也可用 `--topic` 直接给主题 |
| `welight ai <prompt>` | 写作助手对话，带文章上下文，可按需调用规则扫描 / 朱雀检测工具 |
| `welight themes` | 列出可用的免费主题 |
| `welight doctor` | 检查运行环境、配置与密钥状态 |
| `welight init` | 生成 `welight.config.json` 配置模板 |

文件参数传 `-` 表示从 stdin 读取。`copy` 默认使用 `github-dark` 代码高亮主题，可用 `--code-theme` 指定或传 `none` 关闭。

`publish` 相关说明：

- AppID / AppSecret 从 `WELIGHT_WECHAT_APP_ID` / `WELIGHT_WECHAT_APP_SECRET` 读取，也可用 `--app-id` / `--app-secret` 临时传入。
- 默认直连 `api.weixin.qq.com`，**不使用官方代理**；使用前请把当前网络出口 IP 加入公众号后台「开发 → 基本配置 → IP 白名单」，否则会返回 `40164`。
- 需要 `--cover` 指定封面，或正文包含一张可读取的图片作为封面；正文里的本地/远程图片会自动上传并替换。
- 其他选项：`--title`、`--author`、`--digest`、`--source-url`、`--open-comment`、`--fans-comment-only`、`--no-watermark`、`--preview`、`--proxy`。

> 发布默认会在文末追加 `welight.fyi` 水印，可用 `--no-watermark` 关闭。

`lint` 使用内置规则库离线扫描，命中是风险线索而非违规结论：

- `--json` 输出完整扫描报告；`--fail-on none|low|medium|high` 控制退出码（默认 `high`）。
- 供 CI 使用：`welight lint post.md --fail-on high || exit 1`。

`detect` 使用自配 EdgeOne Key 直连腾讯网关（`WELIGHT_ZHUQUE_KEY` 或 `--api-key`），不做官方代理：

- 自动剥离 Markdown 语法并按 2 万字上限截断；`--json` 输出完整报告，`--max-ai <百分比>` 在 AI + 疑似占比超阈时退出码 1。

`title` 复用桌面端「爆款标题」提示词，调用你自己配置的 OpenAI 兼容模型：

- 必需：`WELIGHT_MODEL_API_KEY`、`WELIGHT_MODEL_BASE_URL`、`WELIGHT_MODEL`（可用同名 CLI 参数覆盖）。
- `--topic` 直接指定主题；`--count` 控制数量（默认 5）；`--json` 输出 `{ titles }`。

`ai` 是 CLI 自建的轻量 Agent（不依赖桌面端运行时）：

- `welight ai "指令" --file post.md`，结果可 `--out` 写回文件、`--json` 输出；
- 模型可按需调用 `check_wechat_rules`（本地规则扫描）与 `detect_ai_text`（朱雀检测，需 `WELIGHT_ZHUQUE_KEY`）；
- 工具进度输出到 stderr，正文结果走 stdout，便于管道组合。

## 开发

```bash
npm install
npm run build       # 构建到 dist/
npm run dev -- render post.md   # 源码直跑
npm run type-check
npm test
```

## 源码同步说明

`src/engine/` 下的文件由 Welight 桌面端仓库自动导出，文件头带 `synced from wlight@<sha>` 标记，**请勿手动修改**。需要更新渲染内核时，在桌面端仓库运行导出脚本后提交本仓库。

## 许可

[MIT](./LICENSE)
