# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.0.2] - 2026-09-21

- 启用 npm Trusted Publishing（OIDC）自动发布：`release.yml` 使用 Node 24（npm ≥ 11.5.1），打 tag 即自动发布并生成 provenance
- 完善发布前检查与 README 安装/兼容性说明

## [0.0.1] - 2026-09-21

首个公开版本（免费开源，全部 BYOK）。

### 命令

- `render`：选主题渲染 HTML，自动写文件并在浏览器打开；`--stdout` 输出原始 HTML
- `layout`：一键排版，档位 `auto | minimal | standard | rich`
- `copy`：生成公众号内联 HTML 并写入剪贴板（不与文件系统交互）
- `publish`：直连微信创建公众号草稿（不使用官方代理，需自行处理出口 IP）
- `lint`：公众号平台规则扫描，`--json` / `--fail-on` 可作 CI 门禁
- `checkup`：文章体检（12 项量化检查，需 TypeSafe Key）
- `detect`：腾讯朱雀 AIGC 检测（自配 EdgeOne Key）
- `title`：标题生成（BYOK 模型，可选 TypeSafe 评分）
- `ai` / `chat`：Welight AI 写作与配置助手（实时流式 + Markdown 渲染，支持发布草稿）
- `setup` / `model` / `auth` / `config`：模型与各类密钥的配置向导与命令式配置
- `themes` / `doctor` / `init` / `completion`

### 特性

- 全部 BYOK：模型 / TypeSafe / 朱雀 / 公众号凭据均由用户自备，密钥保存在本地凭据文件（0600），不经过模型
- 内置模型提供商预设（DeepSeek / OpenAI / 通义千问 / 智谱 AI / Kimi / MiniMax / 自定义）
- 主题记忆：`render` 记住文章主题，`publish` / `copy` 默认复用（预览什么发什么）
- 配置选型使用可搜索选择列表
- Shell 补全：`wl completion bash|zsh|fish`，支持行内联想
- 全部交互基于 `@clack/prompts`，非交互 / 管道场景自动退化为纯文本输出

### 说明

- 微信公众号 API 为直连，发布前需把出口 IP 加入公众号后台白名单（报错 `40164`）
- CLI 仅提供全部主题的前 45%，完整主题库请使用 Welight 桌面端
