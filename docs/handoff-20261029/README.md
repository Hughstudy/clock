> Archived handoff reference supplied by the user. Paths and commands below describe the original export package; use the repository README for the current integrated app. This is not a live task board.

# 番茄钟：PRD与最新代码

打包日期：2026-10-29（America/Los_Angeles）。这是截至本次核对的本地已提交开发快照，尚未发布上线。

## 包内内容

- `01_文档/番茄钟_产品PRD_v3.md`：当前完整PRD v3，文件修订7。
- `01_文档/番茄钟_开发协作.md`：当前协作与交接记录，文件修订9。
- `02_源码/clock/`：完整已跟踪源码、资源、锁文件、测试、构建配置、项目说明与验证文档。
- `版本清单.json`：提交版本与逐文件SHA-256，用于核对完整性。

## 代码版本与当前状态

分支：`codex/t30-companion`。

完整提交：`57ca8697cfa3a694f5e319e00d8dc4ee38b4c907`。

该提交包含F1计时核心提交`4e7c9d50261af0b81a880716a36a691ede3b004f`，以及更早的负面反馈清理提交`7d8469bf147d91fb076a5743ed8ac1c851c04420`。

已接入应用：提前结束记录真实时长、独立参与数、主动休息、保存状态/重试、重开恢复与负面反馈清理。

T30已包含在源码中：136句文案资源、事实筛选、轮换降噪、错误优先和可替换角色展示模块；目前尚未挂到正式页面。它的接口与接线边界见`02_源码/clock/src/logic/feedback.md`。

完整F2/F3、收藏与奖励持久化、备份恢复界面、最终角色与物理互动仍待后续完成。PRD是目标设计，不能把全文当成当前代码已实现的功能清单。

## 本地运行

安装兼容项目依赖的Node.js和npm后，进入`02_源码/clock/`，执行：

```bash
npm ci
npm run dev
```

检查与生产构建：

```bash
npm run check
npm run build
```

按项目既有GitHub Pages路径构建时，macOS/Linux可使用`BASE_PATH=/clock/ npm run build`。完整项目说明见源码目录内的`README.md`。

依赖会按`package-lock.json`安装；ZIP未放入可重新安装的node_modules、Git历史或临时构建输出。

## 验证情况

此提交此前已通过严格类型检查、166项测试（14个测试文件）及生产构建；F1生产流程和T30独立组件均有Chromium浏览器验证。T30已检查320/375/430宽度、200%文字、键盘操作及减少动态，但尚未完成正式页面集成与真实手机验收。

本次仅导出不可变提交与当前文档，并校验ZIP和文件内容，没有修改应用代码或重复声称完成产品验收。
