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
| `WELIGHT_MODEL_API_KEY` | Welight AI / 一键排版 / 标题推荐使用的模型 |
| `WELIGHT_TYPESAFE_KEY` | TypeSafe System One 判断层（排版自动档、语义复核、标题评分） |
| `WELIGHT_ZHUQUE_KEY` | 腾讯 EdgeOne / 朱雀 AIGC 检测 |
| `WELIGHT_WECHAT_APP_ID` / `WELIGHT_WECHAT_APP_SECRET` | 微信公众号 |

> CLI 不提供官方微信 API 代理。发布相关命令直连 `api.weixin.qq.com`，需要你把当前网络出口 IP 加入公众号后台的 IP 白名单（报错 `40164` 即为未加白名单）。CI 环境出口 IP 不稳定，请自行准备固定出口。

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
