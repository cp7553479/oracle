# Oracle 验收检查清单（行为 → 期望结果）

执行日期：2026-09-26。结果：**全部通过**（过程中发现并修复 3 个缺陷：未知旗标值泄漏、未知模型折叠为 retired 报错、attach 意图被引擎门拦截）。所有浏览器用例在 fork 默认策略下运行（manual-login 持久 profile、单槽排队、Latest+Instant 默认）。

## A. 模型选择行为（ChatGPT 浏览器）

| # | 输入行为 | 期望结果 | 实测 |
|---|---|---|---|
| A1 | 不填 `-m`（默认运行） | 模型=Latest，effort=Instant(light)；正常返回回答；浏览器完成后退出 | ✅ A1_OK；dry-run: gpt-6-astra+light |
| A2 | `-m latest`（显式别名） | 模型解析为 Latest；显式模型不注入默认档位（SPEC 现行语义） | ✅ model=gpt-6-astra（thinkingTime 未注入，沿用页面档） |
| A3 | `-m gpt-5.6-sol`（菜单现存模型） | 模型选择器切换到 GPT-5.6 Sol；正常回答 | ✅ A3_OK |
| A4 | `-m gpt-5.2`（网页已下线的旧模型） | fail-fast 明确报错 retired（带替代建议） | ✅ 报错含替代建议，浏览器未残留 |
| A5 | `-m gpt-99-turbo`（不存在的模型） | no-stall：静默沿用页面当前模型继续运行并返回回答 | ✅ 修复后 A5_OK（原实现折叠为 gpt-5.2 误报 retired，已改为 pass-through） |
| A6 | thinking-time 显式档位（high） | effort 切换到对应档位并经证据验证 | ✅ Thinking time: 高（中文标签），A6_OK |

## B. Gemini web 流程

| # | 输入行为 | 期望结果 | 实测 |
|---|---|---|---|
| B1 | `-m gemini-3.6-flash` 生文 | Gemini web 执行并捕获回答 | ✅ GEM_OK（模型选择证据 unavailable=正常回退记录） |
| B2 | Gemini `--generate-image <file>` | 图片生成并保存到指定文件 | ✅ 1408×768 JPEG 落盘，回答含 googleusercontent 链接 |

## C. 旗标行为（root 白名单）

| # | 输入行为 | 期望结果 | 实测 |
|---|---|---|---|
| C1 | 白名单外旗标（含未注册/不存在的旗标） | 静默连同值丢弃：不报错、不影响默认值、运行照常 | ✅ 修复值泄漏后通过（原实现把未知旗标的值漏成位置参数导致 too many arguments；已删 KNOWN_FLAG_SHAPES，改为丢弃旗标并吞掉其后所有非旗标 token） |
| C2 | legacy profile/cookie 旗标 | 静默连同值丢弃；值不泄漏 | ✅ composerText 干净，默认值不变 |
| C3 | ChatGPT `--generate-image <file>` + `-p` | 图片文件落盘，回答含保存路径 | ✅ 1254×1254 PNG |

## D. 通用不变量

| # | 行为 | 期望结果 | 实测 |
|---|---|---|---|
| D1 | 每次运行结束（成功/失败） | oracle 拥有的 Chrome 实例退出，profile 空闲 | ✅ 全部用例均验证退出 |
| D2 | 完成判定 | 三条件结构化；不读回答文案 | ✅ 代码级+单测；实测 TRIPLE_RULE_OK2 134s |
