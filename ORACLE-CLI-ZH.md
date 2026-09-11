# Oracle 全部命令与参数（中文）

✅ 适用：本机 `/Users/vincent/oracle` fork，`oracle 0.20.0`（已合并上游 `67253e7b`）；核对日期：2026-09-11。范围为 `oracle` 可执行程序的全部命令、注册参数和隐藏别名，不包含环境变量全集、配置文件字段或独立脚本。

依据：本机 `oracle --help`、`oracle --debug-help`、各子命令帮助、`bin/oracle-cli.ts`、`src/browser/config.ts` 和 `SPEC.md`。上游 [CLI 项目](https://github.com/steipete/oracle) 和 [浏览器文档](https://github.com/steipete/oracle/blob/main/docs/browser-mode.md) 用于交叉核对；上游与本机不同处以本机为准。

## 先理解这个 fork

- ⚠️ 单模型根命令强制 `browser + manual-login`；单独传 `--engine api` 也不会切到 API。但当前 `--models` 路径随后又切到 API，存在违反 SPEC 的实现例外：列表中 GPT/Gemini 目标可能发起真实 API 请求；Claude 等非浏览器目标会先被拦截。不能将“规范要求全走浏览器”理解为所有实际路径都不会调用 API。
- Oracle 自己启动浏览器时固定使用 `~/.oracle/browser-profile`。CLI 的 profile 选择参数直接报 unknown option；环境变量、配置文件、MCP 和历史会话中的 profile 覆盖均被忽略。**不传参数即使用默认 `--manual-login` 行为**。
- ❌ 没有 `oracle login`；没有 `--no-manual-login`；`--copy-profile` 已移除。需要更换登录账号时，在默认 Oracle 浏览器窗口内操作。
- ChatGPT 主执行路径和 Project Sources 均强制单任务槽，后续任务无限期排队；并发配置不能提高上限。启动锁等待与任务排队是不同机制。远程服务另有接入队列：默认忙碌时返回 HTTP 409，可显式开启有限长度的请求队列。
- `--help --verbose` 在当前安装版仍隐藏一些参数；本表同时核对了代码。标记 **隐藏** 表示参数可解析，但普通帮助不展示；不等于已废弃。
- 模型名称和网页实际可用项取决于账号。常规模型选择失败时，这个 fork 使用页面当前模型继续；指定 Pro 思考等级还可能有额外验证。

已移除的 profile 参数：`--copy-profile`、`--browser-chrome-profile`、`--browser-cookie-path`、`--browser-manual-login-profile-dir`、serve 的 `--manual-login-profile-dir`、bridge 的 `--browser-profile-dir`。`--参数=值` 写法同样被拒绝。

## 语法和常用示例

```bash
oracle [根参数] [prompt]
oracle <子命令> [子命令参数]

oracle --help
oracle --debug-help
oracle session --help
oracle project-sources add --help

oracle -p "检查实现中的风险" -f "src/**" -f "!**/*.test.ts"
oracle --dry-run full -p "检查实现" -f "src/**"
oracle --render --copy -p "检查实现" -f "src/**"
oracle -m gemini-3.1-pro -p "解释这个模块" -f src/index.ts
oracle status --hours 72 --limit 50
oracle session <会话ID> --render
```

`<参数>` 表示该 flag 必须带值；`[参数]` 表示可选；`...` 表示多个值。所有命令支持 `-h, --help`。路径通配符建议加引号；用 `!` 排除文件。根位置参数 `prompt` 是 `--prompt` 的简写。帮助建议提供 prompt 和文件，但纯文本提问不必硬塞无关文件。

## 根参数：输入、模型与输出

| 参数                                                                                    | 中文解释                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-h, --help`                                                                            | 显示帮助并退出。                                                                                                                                                       |
| `-V, --version`                                                                         | 显示版本并退出。                                                                                                                                                       |
| `--debug-help`                                                                          | 显示高级参数摘要并退出；也不是完整清单。                                                                                                                               |
| `-p, --prompt <text>`                                                                   | 提交给模型的问题。                                                                                                                                                     |
| `--message <text>`                                                                      | **隐藏**：`--prompt` 别名。                                                                                                                                            |
| `-f, --file <paths...>`                                                                 | 附加文件、目录、glob；可重复，`!pattern` 排除。                                                                                                                        |
| `--include <paths...>`、`--files <paths...>`、`--path <paths...>`、`--paths <paths...>` | **隐藏**：根命令的 `--file` 别名。注意 `session --path` 含义不同。                                                                                                     |
| `--max-file-size-bytes <bytes>`                                                         | 单文件大小上限，默认 1 MB，可受环境/配置覆盖。                                                                                                                         |
| `--files-report`                                                                        | 显示每个附件的 token 用量。                                                                                                                                            |
| `-s, --slug <words>`                                                                    | 自定义易读会话名，建议 3–5 个词。                                                                                                                                      |
| `-m, --model <model>`                                                                   | 选择模型，帮助默认 `gpt-5.5-pro`；可指定 Gemini 等模型。通用旧 Pro 别名可能映射 GPT-5.6 Sol，显式 `gpt-5.5-pro` 用于固定 5.5；`gpt-6-pro` 是浏览器 Latest + Pro 别名。 |
| `--models <models>`                                                                     | 逗号分隔的多模型列表。当前兼容目标列表会切 API 并行执行，属于偏离 SPEC 的例外；不能与 `--followup` 或 `--remote-host` 合用。                                           |
| `-e, --engine <api\|browser>`                                                           | 引擎选项；单模型根执行强制 browser，多模型存在上述例外。                                                                                                               |
| `--mode <api\|browser>`                                                                 | **隐藏**：`--engine` 别名，同样受强制策略约束。                                                                                                                        |
| `--browser`                                                                             | **隐藏、废弃**：旧的浏览器模式开关。                                                                                                                                   |
| `--followup <sessionId\|responseId>`                                                    | 当前可继续保存的 ChatGPT 浏览器会话；纯 API responseId/API 会话因根命令强制 browser 会报需要 API 引擎，不能靠此参数继续。                                              |
| `--followup-model <model>`                                                              | 多模型 API 会话继续时，选择其中一个模型。                                                                                                                              |
| `--dry-run [summary\|json\|full]`                                                       | 只预览请求，不调用模型；仅传开关时为 `summary`。                                                                                                                       |
| `--preview [summary\|json\|full]`                                                       | **隐藏、废弃**：`--dry-run` 别名。                                                                                                                                     |
| `--render-markdown`、`--render`                                                         | 打印组装好的 prompt 与附件 Markdown 后退出。                                                                                                                           |
| `--copy-markdown`、`--copy`                                                             | 复制组装的 Markdown 到剪贴板；`--copy` 为隐藏别名，可配 `--render`。                                                                                                   |
| `--render-plain`                                                                        | 使用无 ANSI 颜色/高亮的纯文本显示。                                                                                                                                    |
| `--write-output <path>`                                                                 | 将最终回答写入文件，覆盖已有内容；多模型在扩展名前加模型名。                                                                                                           |
| `--write-artifacts`                                                                     | 配合 `--write-output` 导出浏览器捕获的文件，保存到回答文件旁且不覆盖已有文件；默认关闭。                                                                               |
| `--verbose-render`                                                                      | 输出会话回放的终端/渲染诊断信息。                                                                                                                                      |
| `--allow-partial`                                                                       | 多模型至少一个成功即以退出码 0 结束。                                                                                                                                  |
| `--partial <fail\|ok>`                                                                  | 多模型失败策略；`ok` 允许部分成功，`fail` 不允许。                                                                                                                     |

## 根参数：会话、等待与诊断

| 参数                                  | 中文解释                                                            |
| ------------------------------------- | ------------------------------------------------------------------- |
| `-v, --verbose`                       | 详细日志。                                                          |
| `--notify`、`--no-notify`             | 开/关完成时的桌面通知；通常默认开，CI/SSH 下例外。                  |
| `--notify-sound`、`--no-notify-sound` | 开/关完成提示音，默认关。                                           |
| `--heartbeat <seconds>`               | 进度日志间隔，默认 30 秒；0 关闭。                                  |
| `--wait`                              | 保持连接等待会话结束。                                              |
| `--no-wait`                           | **隐藏**：不保持前台等待；不要与 API 的 `--background` 混淆。       |
| `--force`                             | 即使相同 prompt 已在运行也创建新会话；不会绕开 profile 的串行队列。 |
| `--retain-hours <hours>`              | 执行前清理超过指定小时的本地会话；0 禁用清理。                      |
| `--zombie-timeout <duration>`         | 判定过期运行会话的阈值，默认 60 分钟。                              |
| `--zombie-last-activity`              | 按最后日志活动时间，而非启动时间判断会话过期。                      |
| `--perf-trace`                        | 写入 CLI 性能计时 JSON。                                            |
| `--perf-trace-path <path>`            | 指定性能计时文件路径。                                              |
| `--status`                            | **隐藏**：列出保存的会话，相当于 `oracle status`。                  |
| `--session <id>`                      | **隐藏**：连接已有会话，相当于会话查看入口。                        |
| `--exec-session <id>`                 | **隐藏、内部用**：执行已经保存的会话任务；通常由后台 worker 使用。  |

## 根参数：API 兼容选项

⚠️ 这些参数保留在解析器中。`--route`、`--preflight`、`doctor` 可作诊断；单模型根执行仍为 browser，`--reasoning-effort` / `--reasoning-mode` 会报需要 API，`--base-url` 不会成为浏览器代理。当前 `--models` 的 API 例外路径可能使 API 参数生效。

| 参数                                                       | 中文解释                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `--reasoning-effort <none\|low\|medium\|high\|xhigh\|max>` | GPT-6 Astra / GPT-5.6 API 推理强度；Astra 至少为 low。                                       |
| `--reasoning-mode <standard\|pro>`                         | GPT-6 Astra / GPT-5.6 Responses API 标准或 Pro 执行模式。                                    |
| `--search <on\|off>`                                       | **隐藏**：服务端搜索开关，默认开。                                                           |
| `--max-input <tokens>`                                     | **隐藏**：覆盖模型输入 token 预算。                                                          |
| `--max-output <tokens>`                                    | **隐藏**：覆盖模型输出 token 上限。                                                          |
| `--timeout <seconds\|duration\|auto>`                      | API 整体超时；默认 auto，Pro 为 60 分钟，其他为 120 秒。浏览器答复使用 `--browser-timeout`。 |
| `--http-timeout <duration>`                                | API HTTP 请求超时，默认 20 分钟。                                                            |
| `--background`、`--no-background`                          | 开/关 Responses API 后台任务模式，区别于 CLI 是否保持连接。                                  |
| `--route`                                                  | 打印 API provider 路由计划后退出。                                                           |
| `--preflight`                                              | 检查请求模型所需 provider 是否就绪后退出。                                                   |
| `--base-url <url>`                                         | OpenAI 兼容 API 的基础地址，例如代理服务。                                                   |
| `--provider <auto\|openai\|azure>`                         | provider 路由，默认 auto。                                                                   |
| `--no-azure`                                               | 禁用 Azure 路由，等价于 `--provider openai`。                                                |
| `--azure-endpoint <url>`                                   | Azure OpenAI 服务地址。                                                                      |
| `--azure-deployment <name>`                                | Azure 部署名称。                                                                             |
| `--azure-api-version <version>`                            | Azure API 版本。                                                                             |

## 根参数：浏览器与登录

| 参数                                                                 | 中文解释                                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--chatgpt-url <url>`                                                | ChatGPT 页面或 Project URL，默认 `https://chatgpt.com/`。                                                                                      |
| `--browser-url <url>`                                                | **隐藏**：`--chatgpt-url` 别名，不是通用浏览器登录命令。                                                                                       |
| `--browser-chrome-path <path>`                                       | **隐藏**：指定 Chrome/Chromium 可执行文件。                                                                                                    |
| `--browser-manual-login`、`--manual-login`、`--manual-browser-login` | **隐藏**：持久浏览器登录模式及其别名；本 fork 已强制开启，无需显式传。                                                                         |
| `--browser-cookie-sync`                                              | 显式请求同步主 Chrome 的 cookies；实际还取决于手动登录模式配置。                                                                               |
| `--browser-no-cookie-sync`                                           | **隐藏**：跳过 cookie 拷贝。                                                                                                                   |
| `--browser-cookie-names <names>`                                     | **隐藏**：逗号分隔的 cookie 同步白名单。                                                                                                       |
| `--browser-inline-cookies <jsonOrBase64>`                            | **隐藏**：直接传 cookie JSON 数组或其 base64。                                                                                                 |
| `--browser-inline-cookies-file <path>`                               | **隐藏**：从 JSON/base64 文件读取 cookies。                                                                                                    |
| `--browser-allow-cookie-errors`                                      | **隐藏**：cookie 同步失败时仍继续。                                                                                                            |
| `--browser-headless`                                                 | **隐藏**：无界面启动浏览器，不适合首次手动登录。                                                                                               |
| `--browser-hide-window`                                              | **隐藏**：macOS 有界面浏览器启动后隐藏窗口。                                                                                                   |
| `--browser-keep-browser`                                             | **隐藏**：请求运行后保留浏览器。SPEC 要求清理已完成任务的自有标签页；但 Gemini 的 session manager 在此开关开启时直接保留标签页，存在实现差异。 |
| `--browser-port <port>`                                              | 固定 Chrome DevTools 端口。                                                                                                                    |
| `--browser-debug-port <port>`                                        | **隐藏**：`--browser-port` 别名。                                                                                                              |
| `--browser-attach-running`                                           | 连接已运行的本地浏览器，默认 `127.0.0.1:9222`；浏览器需支持/启用远程调试。                                                                     |
| `--remote-chrome <host:port>`                                        | 连接 Chrome CDP；配合 `--browser-attach-running` 时可指定本地连接地址。                                                                        |
| `--browser-tab <ref>`                                                | 复用现有 ChatGPT 标签页；ref 为 `current`、target ID、完整 URL 或标题片段。                                                                    |
| `--remote-host <host:port>`                                          | 将浏览器任务交给 `oracle serve` 服务。                                                                                                         |
| `--remote-token <token>`                                             | 远端 Oracle 服务的访问 token。                                                                                                                 |

cookie 同步和 inline cookies 只影响登录数据，不提供 profile 目录选择；Oracle 启动的浏览器仍使用固定默认目录。

## 根参数：浏览器模型、附件与等待

时长建议显式写单位，如 `60s`、`20m`；浏览器时长参数的裸数字通常按毫秒解释。这里列的是默认值，配置/特定执行模式可能调整它们。

| 参数                                                 | 中文解释                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--browser-model-strategy <select\|current\|ignore>` | 默认 select 尝试切模型；current 保留当前模型；ignore 跳过选择器。                                                        |
| `--browser-thinking-time <level>`                    | **隐藏**：light、standard、extended、extra-high、pro、heavy 或支持的 UI 别名；pro 指当前模型的 Pro 等级，不是 API 参数。 |
| `--browser-research <off\|search\|deep>`             | 默认 off；search 启用 Web Search，deep 启用 Deep Research。                                                              |
| `--browser-archive <auto\|always\|never>`            | 完成并保存本地产物后是否归档网页对话；auto 默认只归档成功的非 Project 单轮会话。                                         |
| `--browser-follow-up <prompt>`                       | 初次回答后，在同一个 ChatGPT 对话继续提问；可重复多次。                                                                  |
| `--browser-attachments <auto\|never\|always>`        | auto 默认：约 6 万字符以内可直接粘贴，再大上传；never 仅允许可内联文本；always 上传。                                    |
| `--browser-inline-files`                             | `--browser-attachments never` 别名。                                                                                     |
| `--browser-bundle-files`                             | 强制使用一个上传包；多个文本/源码文件默认已自动合并。                                                                    |
| `--browser-bundle-format <auto\|text\|zip>`          | 合并包格式，默认 auto：纯文本合并为文本，包含原始文件时使用 ZIP。                                                        |
| `--browser-timeout <duration>`                       | **隐藏**：等待模型回答，默认 20 分钟。                                                                                   |
| `--browser-input-timeout <duration>`                 | **隐藏**：等待输入框，默认 60 秒。                                                                                       |
| `--browser-approval-wait <duration>`                 | 每次等待 Chrome 远程调试批准的时间，默认 20 秒；可由 `ORACLE_BROWSER_APPROVAL_WAIT` 设置。                               |
| `--browser-attachment-timeout <duration>`            | **隐藏**：发送前等待附件就绪，默认 45 秒。                                                                               |
| `--browser-recheck-delay <duration>`                 | **隐藏**：回答超时后延迟多久重访对话抓取结果，默认 0。                                                                   |
| `--browser-recheck-timeout <duration>`               | **隐藏**：延迟重查的时间预算，默认 120 秒。                                                                              |
| `--browser-reuse-wait <duration>`                    | **隐藏**：启动前等待共享 Chrome 出现，默认 10 秒。                                                                       |
| `--browser-profile-lock-timeout <duration>`          | **隐藏**：共享 profile 启动锁等待，配置默认 5 分钟；不是无限期任务队列的超时开关。                                       |
| `--browser-max-concurrent-tabs <n>`                  | **隐藏**：保留的并发参数；帮助仍写默认 3，但本 fork 实际强制 1，不能提高。                                               |
| `--browser-auto-reattach-delay <duration>`           | **隐藏**：超时后开始自动重连的延迟，默认 0。                                                                             |
| `--browser-auto-reattach-interval <duration>`        | **隐藏**：自动重连间隔，默认 0，表示关闭。                                                                               |
| `--browser-auto-reattach-timeout <duration>`         | **隐藏**：每次自动重连时间预算，默认 120 秒。                                                                            |
| `--browser-cookie-wait <duration>`                   | **隐藏**：cookie 为空或锁定时重试前等待，默认 0。                                                                        |

## 根参数：Gemini 与图像

| 参数                      | 中文解释                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `--youtube <url>`         | Gemini web/cookie 模式分析 YouTube 视频。                                             |
| `--generate-image <file>` | 生成图片并指定保存位置；Gemini 支持，ChatGPT 浏览器会在出现可下载图片时保存图片产物。 |
| `--edit-image <file>`     | Gemini 的源图片；ChatGPT 改图使用 `--file` 附图并配 `--generate-image`。              |
| `--output <file>`         | 图像操作的输出路径；普通文本回答使用 `--write-output`。                               |
| `--aspect <ratio>`        | Gemini 生成图片比例：16:9、1:1、4:3、3:4。                                            |
| `--gemini-show-thoughts`  | 显示 Gemini 返回的思考内容；仅 Gemini web/cookie 模式。                               |
| `--no-gemini-fallback`    | 请求的 Gemini web 模型不可用时失败，不自动退回 Flash-Lite。                           |

## 全部子命令

| 命令                          | 用途                                       |
| ----------------------------- | ------------------------------------------ |
| `oracle serve`                | 启动远程浏览器服务。                       |
| `oracle project-sources list` | 列出 ChatGPT Project Sources。             |
| `oracle project-sources add`  | 将文件上传到 Project Sources。             |
| `oracle bridge host`          | 启动桥接服务，可维护 SSH 反向隧道。        |
| `oracle bridge client`        | 配置客户端连接远程 Oracle。                |
| `oracle bridge doctor`        | 诊断桥接连接及浏览器条件。                 |
| `oracle bridge codex-config`  | 输出 Codex MCP 配置片段。                  |
| `oracle bridge claude-config` | 输出 Claude Code MCP 配置片段。            |
| `oracle tui`                  | 交互式终端界面；没有专属业务 flag。        |
| `oracle doctor`               | 检查 API provider 与路由。                 |
| `oracle docs check`           | 检查文档 flag 与 CLI 元数据是否一致。      |
| `oracle session [id]`         | 有 ID 则连接会话，无 ID 则列会话。         |
| `oracle status [id]`          | 有 ID 则连接会话，无 ID 则列状态。         |
| `oracle restart <id>`         | 使用旧会话选项创建新任务并重跑，不是重连。 |

`project-sources`、`bridge`、`docs` 是命令分组，另有自动生成的 `help [command]`。每个子命令的 `-h, --help` 不在以下表格重复列出。不要假设同名根参数在子命令下含义相同。

### `serve`

| 参数                            | 中文解释                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `--host <address>`              | 监听接口，默认 `0.0.0.0`。                                                      |
| `--port <number>`               | 监听端口，默认随机。                                                            |
| `--token <value>`               | 客户端访问 token，默认随机生成。                                                |
| `--max-concurrent-runs <count>` | 开启服务接入队列；实际并发被本 fork 限制为 1。省略时忙碌请求返回 HTTP 409。     |
| `--max-queued-runs <count>`     | 接入队列等待容量，默认 8；0 禁止等待，需配合上一参数。                          |
| `--manual-login`                | 手动登录模式；虽然命令元数据默认 false，本 fork 浏览器配置仍强制 manual-login。 |
| `--browser-cookie-sync`         | 请求同步本地 Chrome cookies，默认未开启。                                       |

`serve` 还会读取根参数 `--browser-attach-running`、`--remote-chrome` 和 `--browser-approval-wait`，用于宿主浏览器连接。它们不改变默认 profile 目录。

### `project-sources list` 与 `project-sources add`

以下是两者共用的全部 flag；浏览器项的行为见根参数说明。固定使用默认持久 profile，任务槽为 1，排队等待无超时。

| 参数                                        | 中文解释                                         |
| ------------------------------------------- | ------------------------------------------------ |
| `--chatgpt-url <url>`                       | 以 `/project` 结尾的 Project URL，也可来自配置。 |
| `--browser-manual-login`                    | 复用持久登录。                                   |
| `--browser-timeout <duration>`              | 总浏览器超时。                                   |
| `--browser-input-timeout <duration>`        | 等待 Sources 界面的超时。                        |
| `--browser-profile-lock-timeout <duration>` | 等待 profile 启动锁的超时。                      |
| `--browser-reuse-wait <duration>`           | 等待共享 Chrome 出现。                           |
| `--browser-max-concurrent-tabs <n>`         | 保留的兼容参数；实际强制为 1，不能提高并发数。   |
| `--browser-cookie-wait <duration>`          | 重试 cookie 同步前等待。                         |
| `--browser-chrome-path <path>`              | Chrome 可执行文件。                              |
| `--browser-inline-cookies <json>`           | 直接传 ChatGPT cookies。                         |
| `--browser-inline-cookies-file <path>`      | cookies 文件。                                   |
| `--browser-cookie-sync`                     | 显式启用 cookie 拷贝。                           |
| `--browser-no-cookie-sync`                  | 跳过 cookie 拷贝。                               |
| `--browser-keep-browser`                    | 请求保留 Chrome 进程，默认 false。               |
| `--browser-hide-window`                     | macOS 启动后隐藏窗口，默认 false。               |
| `--browser-allow-cookie-errors`             | cookie 同步失败仍继续，默认 false。              |
| `--max-file-size-bytes <bytes>`             | 上传文件大小上限。                               |
| `--json`                                    | 输出结构化 JSON。                                |
| `-v, --verbose`                             | 详细浏览器日志。                                 |

仅 `add` 另有：

| 参数                    | 中文解释                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| `-f, --file <paths...>` | 要上传的文件、目录或 glob，允许重复/多值，默认空列表。                        |
| `--dry-run`             | 仅验证与显示上传计划，不操作浏览器；这里不接受根命令的 summary/json/full 值。 |

### `bridge host`

| 参数                        | 中文解释                                                   |
| --------------------------- | ---------------------------------------------------------- |
| `--bind <host:port>`        | 服务绑定地址，默认 `127.0.0.1:9473`。                      |
| `--token <token\|auto>`     | 访问 token，默认 auto 自动生成。                           |
| `--write-connection <path>` | 连接信息 JSON，默认 `~/.oracle/bridge-connection.json`。   |
| `--ssh <user@host>`         | 维护到目标 Linux 主机的 SSH 反向隧道。                     |
| `--ssh-remote-port <port>`  | 远端监听端口，默认与 bind 端口相同。                       |
| `--ssh-identity <path>`     | SSH 密钥文件，对应 `ssh -i`。                              |
| `--ssh-extra-args <args>`   | 传给 SSH 的额外参数，多个参数应作为一个引用字符串传入。    |
| `--background`              | 后台运行，写 pid/log；与根命令的 API background 含义不同。 |
| `--foreground`              | 前台运行，也是默认运行方式。                               |
| `--print`                   | 输出含 token 的客户端连接串。                              |
| `--print-token`             | 仅输出 token。                                             |

### `bridge client`

| 参数                     | 中文解释                                         |
| ------------------------ | ------------------------------------------------ |
| `--connect <connection>` | **必填**：连接串或 bridge-connection.json 路径。 |
| `--config <path>`        | 要写入的配置文件，默认 `~/.oracle/config.json`。 |
| `--no-write-config`      | 只验证，不写配置。                               |
| `--no-test`              | 跳过远端 `/health` 检查。                        |
| `--print-env`            | 输出包含 token 的环境变量导出命令。              |

### `bridge doctor`、`bridge codex-config`、`bridge claude-config`

| 命令                   | 参数                       | 中文解释                               |
| ---------------------- | -------------------------- | -------------------------------------- |
| `bridge doctor`        | `--verbose`                | 额外诊断。                             |
| `bridge codex-config`  | `--print-token`            | 在配置片段加入 `ORACLE_REMOTE_TOKEN`。 |
| `bridge claude-config` | `--print-token`            | 在配置片段加入 token。                 |
| `bridge claude-config` | `--local-browser`          | 生成使用本地已登录 Chrome 的配置。     |
| `bridge claude-config` | `--oracle-home-dir <path>` | 在片段覆盖 `ORACLE_HOME_DIR`。         |

### `doctor`

| 参数                               | 中文解释                           |
| ---------------------------------- | ---------------------------------- |
| `--providers`                      | 检查 provider key 是否就绪及路由。 |
| `--models <models>`                | 逗号分隔的待检查模型。             |
| `-m, --model <model>`              | 检查单个模型。                     |
| `--provider <auto\|openai\|azure>` | 路由，默认 auto。                  |
| `--no-azure`                       | 本次检查禁用 Azure。               |
| `--azure-endpoint <url>`           | Azure 服务地址。                   |
| `--azure-deployment <name>`        | Azure 部署名称。                   |
| `--azure-api-version <version>`    | Azure API 版本。                   |
| `--base-url <url>`                 | OpenAI 兼容服务地址。              |
| `--json`                           | 输出结构化 JSON。                  |

### `docs check`

| 参数                    | 中文解释                                       |
| ----------------------- | ---------------------------------------------- |
| `--docs-path <file...>` | 要检查的 Markdown 文件，默认检查随附核心文档。 |
| `--json`                | 输出结构化 JSON。                              |

### `session [id]` 与 `status [id]`

两者共用的全部 flag：

| 参数                            | 中文解释                                                  |
| ------------------------------- | --------------------------------------------------------- |
| `--hours <hours>`               | 回溯小时数，默认 24。                                     |
| `--limit <count>`               | 列表条数，默认 100，最多 1000。                           |
| `--all`                         | 不限制会话年龄。                                          |
| `--clear`                       | **删除**早于时间窗口的本地会话，默认窗口 24 小时。        |
| `--clean`                       | **隐藏、废弃**：`--clear` 别名，也会删除。                |
| `--hide-prompt`                 | 显示会话时隐藏原 prompt。                                 |
| `--render`、`--render-markdown` | 渲染已完成回答的 Markdown；与根命令打印输入 bundle 不同。 |
| `--model <name>`                | 按模型筛选会话/输出。                                     |

仅 `session` 另有：

| 参数                    | 中文解释                                           |
| ----------------------- | -------------------------------------------------- |
| `--path`                | 只打印会话存储路径，不连接；这里不接路径值。       |
| `--harvest`             | 重读关联浏览器标签，打印并保存最新助手输出。       |
| `--live`                | 持续读取浏览器标签直到完成、停滞或脱离。           |
| `--write-output <path>` | 保存 harvest/live 读取的输出。                     |
| `--browser-tab <ref>`   | 指定读取标签：current、target ID、URL 或标题片段。 |
| `--no-recover`          | 找不到标签时，不启动 Chrome 恢复会话。             |

仅 `status` 另有 `--browser-tabs`：列出仍存活的 ChatGPT 标签及其 Oracle 会话关联。

### `restart <id>`

| 参数                        | 中文解释               |
| --------------------------- | ---------------------- |
| `--wait`                    | 等待新任务完成。       |
| `--no-wait`                 | **隐藏**：不保持等待。 |
| `--remote-host <host:port>` | 指定远程 Oracle 服务。 |
| `--remote-token <token>`    | 远端访问 token。       |

## 容易混淆的对应关系

| 目的                              | 应使用                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 只看将发送什么                    | 根 `--dry-run` 或 `--render`。                                                                                   |
| 保存文本回答                      | 根 `--write-output`。                                                                                            |
| 保存图像                          | `--generate-image` / `--output`。                                                                                |
| 查看旧结果或重连                  | `oracle session <id>`。                                                                                          |
| 同一对话追问                      | `--followup <id>`；初次运行预排追问用 `--browser-follow-up`。                                                    |
| 用旧参数再跑一次                  | `oracle restart <id>`，会创建新任务。                                                                            |
| 接已有 Chrome                     | `--browser-attach-running` / `--remote-chrome`，需要 CDP 条件。                                                  |
| 调用另一台机器的 Oracle           | `--remote-host`，对端运行 `oracle serve`。                                                                       |
| 在 Oracle 默认浏览器中登录 Gemini | `oracle --manual-login -m gemini-3-pro --browser-keep-browser -p "你好"`；首次运行在弹出的 Oracle 浏览器内登录。 |
