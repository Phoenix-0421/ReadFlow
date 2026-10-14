# Open Library API 访问故障排查报告

| 项目 | 内容 |
| --- | --- |
| 报告日期 | 2026-10-14 |
| 项目路径 | `D:\项目\ReadFlow` |
| 排查范围 | 仅诊断 Open Library 搜索接口无法访问的问题，**未修改任何代码、未安装依赖、未更换 API** |
| 本次唯一新增文件 | `docs/openlibrary-debug-report.md`（即本报告） |
| 结论 | **接口失败的根因是本机网络对 `openlibrary.org` 的 DNS 污染 + TLS(SNI) 阻断，不是代码问题** |

---

## 一、实际请求 URL 与请求参数

### 1. 代码里构造出来的真实 URL

来自 `src/lib/openLibrary.ts` 第 3、5、39-44 行：

```
const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json'   // 第 3 行
const SEARCH_LIMIT = 20                                          // 第 5 行

const url =
  SEARCH_ENDPOINT +
  '?q=' +
  encodeURIComponent(trimmed) +
  '&limit=' +
  String(SEARCH_LIMIT)
```

因此实际发出的请求是：

```
https://openlibrary.org/search.json?q=<URL 编码后的关键词>&limit=20
```

以搜索 `harry potter` 为例，实际 URL 是：

```
https://openlibrary.org/search.json?q=harry%20potter&limit=20
```

### 2. 请求参数清单

| 参数 | 是否发送 | 说明 |
| --- | --- | --- |
| `q` | 发送 | 关键词，经 `encodeURIComponent` 编码（中文、空格都能正确处理） |
| `limit` | 发送 | 固定为 20，用于限制返回条数 |
| `fields` | **未发送** | **重要：当前代码没有指定 fields 参数** |
| 其他参数 | 未发送 | 没有 offset / page / language / sort 等 |

### 3. 关于 `fields` 参数（对应排查要求第 2 条）

**结论：当前代码没有在请求里指定 `fields`。** 接口会返回它默认的全字段集合（每条结果几十个字段）。

你提到的五个字段是在**响应处理阶段按名字读取**的，不是在请求阶段指定的：

| 字段 | 读取位置 | 读取方式 |
| --- | --- | --- |
| `key` | openLibrary.ts 第 86 行 | 用 `parseId()` 读取，再用正则校验格式 |
| `title` | 第 89-90 行 | 必须是字符串且非空，否则整条丢弃 |
| `author_name` | 第 92-97 行 | 期望是字符串数组；缺失则为空数组 |
| `cover_i` | 第 99 行 → 第 120-130 行 | 期望正整数（也兼容数字字符串）；缺失则不生成封面地址 |
| `first_publish_year` | 第 100-103 行 | 必须是整数；缺失则不显示该行 |

代码里用来校验图书标识的正则写在 `src/lib/openLibrary.ts` 第 11 行，匹配形如 `/works/OL45804W` 或 `/books/OL7353617M` 的字符串。

**这解释了一件事**：字段名是否与真实响应一致，**目前无法在本机验证**（接口完全连不上，见第三节）。若字段名有出入，表现会是「结果能拿到但某些字段为空」，而不是「完全没结果」。

**附带发现（不是本次故障原因）**：因为没有传 `fields`，每次搜索都会下载全部字段，响应体明显偏大。你的测试 URL 里带了 `fields` 参数，这个写法更省流量 —— 但**它不是本次访问失败的原因**（两者都在第一步就连接失败，见第三节）。

---

## 二、涉及的代码文件与关键位置

| 文件 | 关键位置 | 作用 |
| --- | --- | --- |
| `src/lib/openLibrary.ts` | 第 3 行 | `SEARCH_ENDPOINT` 常量：搜索接口地址 |
| | 第 4 行 | `COVER_ENDPOINT` 常量：封面图地址（同样是 Open Library 域名，同样受影响） |
| | 第 32-68 行 | `searchBooks()` 主流程 |
| | 第 39-44 行 | 拼接 URL |
| | 第 46-52 行 | `fetch()` 调用 + 网络异常处理 |
| | 第 54-56 行 | HTTP 非 2xx 处理 |
| | 第 58-63 行 | 响应 JSON 解析异常处理 |
| | 第 65-67 行 | 映射 + 过滤 |
| | 第 71-75 行 | `extractDocs()`：取 docs 数组 |
| | 第 82-112 行 | `toBookMetadata()`：单条数据映射 |
| `src/pages/SearchPage.tsx` | 第 9-13 行 | 四态联合类型：idle / loading / success / error |
| | 第 35-68 行 | `runSearch()`：请求序号 + AbortController |
| | 第 55-67 行 | try / catch：区分「主动取消」与「真实错误」 |
| | 第 119-170 行左右 | 四种状态的界面渲染 |

---

## 三、已执行的测试与真实结果

> 以下全部为实际执行并记录的结果，没有推测。

### 测试 A：请求你指定的测试 URL（PowerShell）

请求的 URL：

```
https://openlibrary.org/search.json?q=harry%20potter&fields=key,title,author_name,first_publish_year,cover_i&limit=5
```

执行命令：`Invoke-WebRequest -Uri <上面的 URL> -TimeoutSec 15`

**实际结果**：

```
失败，耗时 15.0s
异常类型: System.Threading.Tasks.TaskCanceledException
异常消息: The request was canceled due to the configured HttpClient.Timeout of 15 seconds elapsing.
是否拿到 HTTP 响应: 否（请求根本没有得到响应）
```

**注意：没有拿到任何 HTTP 状态码** —— 请求在建立连接阶段就卡住了，连 HTTP 层都没到。

### 测试 B：系统 DNS 解析

```
openlibrary.org                → 31.13.94.7    （第一次查询）
openlibrary.org                → 31.13.75.12   （第二次查询，同一个域名返回了不同 IP）
covers.openlibrary.org         → 108.160.162.98 / 202.160.128.16 / 168.143.171.186
registry.npmmirror.com（对照）  → 117.68.127.5    TCP 443 成功
www.baidu.com（对照）           → 183.2.172.177   TCP 443 成功
```

**判定依据**：

- 31.13.x.x 是 **Meta / Facebook 的 IP 段**，108.160.x.x、202.160.x.x 也都不是 Open Library 的地址；
- **同一个域名两次查询返回不同 IP** —— 这是 DNS 劫持的典型特征；
- 对照组两个域名解析正确且能连通，**说明本机网络本身是正常的**。

### 测试 C：TCP 443 连通性

| 目标 | 结果 |
| --- | --- |
| openlibrary.org（解析到的污染 IP） | 失败（超时） |
| covers.openlibrary.org | 失败（超时） |
| 31.13.94.7:443（污染 IP 直连） | 失败（超时） |
| 1.1.1.1:443（Cloudflare） | 失败（超时） |
| 117.68.127.5:443（npmmirror，对照） | **成功** |

### 测试 D：用加密 DNS(DoH) 绕开本地 DNS，查真实 IP

| DoH 服务 | 查询结果 |
| --- | --- |
| Cloudflare（cloudflare-dns.com） | 查询失败（SSL 连接无法建立） |
| Google（dns.google） | 查询超时 |
| AliDNS（223.5.5.5） | 返回 31.13.75.12（仍是污染 IP） |
| **DNSPod（doh.pub）** | **返回 207.241.234.205** |

207.241.234.205 属于 **Internet Archive**（Open Library 的运营方）的 IP 段，判断这很可能是真实 IP。

### 测试 E：直连真实 IP（关键对照）

```
[1] TCP 443 到 207.241.234.205                      结果: 成功
[2] curl --resolve openlibrary.org:443:207.241.234.205
        请求 https://openlibrary.org/search.json?q=harry%20potter&limit=2
    结果: 状态码=000  耗时=0.29s  错误=Recv failure: Connection was reset   curl 退出码=35
[3] curl 使用系统 DNS（污染 IP）
    结果: 状态码=000  耗时=12.0s  错误=Connection timed out after 12002 ms   curl 退出码=28
```

**这三个结果合起来说明了根因**：

- 用真实 IP 时，**TCP 三次握手能成功**（说明 IP 本身没被封）；
- 但紧接着的 **TLS 握手被强制重置**（Connection was reset，curl 退出码 35 = SSL connect error）—— 这是**基于 SNI（域名）的阻断**特征；
- 用系统 DNS 给的污染 IP 时，**连 TCP 都建不起来**，直接超时。

### 测试 F：浏览器内的实际表现

在项目开发服务器（http://localhost:5175/search）里真实输入 harry potter 并提交：

| 观察项 | 结果 |
| --- | --- |
| 提交后前约 24 秒 | 按钮显示「搜索中…」，请求一直挂着，没有立刻失败 |
| 约 20–25 秒后 | 出现错误面板：「网络请求失败，请检查网络连接后重试。」 |
| 是否白屏 | 否，页面结构完整 |
| 是否有重试按钮 | 有 |
| 按钮是否恢复可点 | 恢复为「搜索」 |
| 控制台 console.error / console.warn 条数 | **0 条** |

**关于「约 20–25 秒」**：这是 Chrome 对「TCP 连接无响应」的默认等待时间。也就是说，用户点搜索后会干等 20 多秒才看到错误提示 —— 这是本次故障暴露出来的一个**真实体验问题**（见第六节建议）。

### 测试 G：代理配置检查

```
netsh winhttp show proxy             → Direct access (no proxy server)
HKCU Internet Settings ProxyEnable   → 0
ProxyServer / AutoConfigURL          → 为空
HTTP_PROXY / HTTPS_PROXY / ALL_PROXY → 均未设置
```

**结论：本机当前没有配置任何代理，走的是直连。**

---

## 四、错误信息与 HTTP 状态码汇总

| 场景 | 是否拿到 HTTP 状态码 | 实际错误 |
| --- | --- | --- |
| 你给的测试 URL | **否** | TaskCanceledException：15 秒超时，请求未得到响应 |
| 应用内 fetch（浏览器） | **否** | 界面提示「网络请求失败，请检查网络连接后重试。」；控制台无 console.error |
| 真实 IP + TLS | **否** | Connection was reset（curl 退出码 35） |
| 污染 IP 直连 | **否** | Connection timed out（curl 退出码 28） |

**关于你提到的 CORS / 403 / 429 / 500：本次全部没有出现。**

理由很直接：这些都属于 HTTP 层的响应。而本次的请求**根本没有拿到任何 HTTP 响应**（状态码一片空白），失败发生在更底层的 DNS 解析和 TCP / TLS 连接阶段。所以：

- 不是 CORS 问题（CORS 报错的前提是请求已经到达服务器并返回了响应头）；
- 不是 403 / 429 / 500（这些都需要服务器返回状态码）；
- 不是请求地址写错（同一个 URL 在能连通的环境下就是官方地址；而且 curl 用真实 IP 时 TCP 是通的，说明地址与端口没问题）。

---

## 五、已确认的原因 / 尚未确认的原因

### 已确认（有直接证据）

1. **DNS 被污染**：openlibrary.org 在系统 DNS 下解析到 Meta 的 IP 段，且两次查询结果不同。
2. **TCP 到污染 IP 必然超时**：这是应用界面 20 多秒后报错、以及 PowerShell / curl 超时的直接原因。
3. **即使绕过 DNS 用真实 IP，TLS 握手也会被重置**：说明存在基于 SNI 的阻断，因此**改 hosts 文件解决不了**。
4. **本机网络本身是好的**：npmmirror、baidu 均可正常连通。
5. **本机没有任何代理配置**：排除了「有代理但没生效」这种可能。
6. **不是代码问题**：代码构造的 URL 格式正确、编码正确、异常处理正确；同一条代码路径在上一阶段用本地模拟接口跑通过完整流程。
7. **不是 CORS / 403 / 429 / 500**：请求未到达 HTTP 层。

### 尚未确认

1. **207.241.234.205 是否 100% 是 openlibrary.org 当前的官方 IP**：它来自 DNSPod 的 DoH 结果，IP 归属 Internet Archive，可能性很高，但没有第二个独立来源交叉验证（本机能用的 DoH 只有 doh.pub 可用）。
2. **真实字段名是否与代码一致**：因为连不通，五个字段（key / title / author_name / cover_i / first_publish_year）的真实响应结构**没有验证过**。
3. **limit 参数是否被接口接受**：同样无法验证。
4. **TLS 重置的具体拦截装置**：只能确认现象（SNI 触发连接重置），无法进一步定位是哪一层设备或策略所致。
5. **是否所有网络环境都如此**：只测了这一台机器 + 这一条网络。换个网络（例如手机热点、公司网络、开代理）结果可能不同。

---

## 六、建议的修复方案及依据

> 本节只给建议，**本次未实施任何修改**。

### 方案 1（推荐，能根治）：使用可用的代理 / VPN

**依据**：测试 E 证明阻断发生在 TLS 层（基于域名）。这种阻断**无法靠修改 DNS 或 hosts 绕过**，必须让请求走一条不被阻断的通道。

**做法**：在系统或浏览器层面配置代理（本项目实测为「无代理直连」）。配置后重开浏览器，再打开你给的测试 URL 验证。

**注意**：

- 只给 PowerShell 配代理是不够的 —— **前端代码是在浏览器里发请求的**，需要浏览器 / 系统层面能走代理；
- 封面图走的是 covers.openlibrary.org，同样是 Open Library 域名，同一个代理会一起解决。

### 方案 2（不推荐，但值得说明为什么不行）：改 hosts 文件或换 DNS

**依据**：测试 E 第 [2] 条。真实 IP 的 TCP 是通的，但**一发起 TLS 就被重置**。所以在 hosts 里写死 207.241.234.205 也连不上。

**结论：此方案无效，不要尝试。** 把它写出来是为了避免走弯路。

### 方案 3（体验优化，与网络问题无关，建议在下一阶段一并处理）

以下是本次排查中**发现的代码可改进点**，都不是故障原因，但值得修：

| 问题 | 现状 | 建议 | 依据 |
| --- | --- | --- | --- |
| 等待时间过长 | 点搜索后要干等 20–25 秒才报错 | 给 fetch 加超时（例如用 AbortSignal.timeout(10000)，或自己用 setTimeout 调 abort），10 秒内给出明确错误 | 测试 F 实测：24 秒时仍在 loading，20–25 秒后才出错误面板 |
| 把「结构异常」当成「没有结果」 | extractDocs()（第 71-75 行）在 docs 不是数组时返回空数组，最终会渲染成「没有找到相关书籍」 | 让它与「真的是空结果」区分开：结构异常应走错误状态 | 阅读第 65-75 行与 SearchPage 第 58 行：success 且 results 为空数组时被当作空结果渲染 |
| 请求体偏大 | 未传 fields，拉取全部字段 | 加 fields 参数只取需要的五个字段 | 你给的测试 URL 就是这么写的；但需在联网后实测确认字段名再改 |
| 封面域名同样不可达 | covers.openlibrary.org 解析同样是污染 IP | **无需修改** —— 已有 onError 兜底显示 CSS 占位 | 测试 B：该子域解析到无关 IP；CoverImage 组件有失败回退，实测占位正常显示 |

**关于第 2 条要补充说明**：从代码看，SearchPage **已经正确区分**了「网络失败」「HTTP 非 2xx」「真的没有结果」三种情况（分别对应 SearchPage 第 51 行、第 55 行、第 58 行这三条路径），这一点没有问题。**唯一的漏洞**是：HTTP 200 但响应结构不符合预期时，会被降级成「没有找到相关书籍」，与真实空结果无法区分。

### 方案 4（保底，需你先决定）

如果短期内无法使用代理，可以考虑在**不改业务需求**的前提下换个数据来源，或让搜索功能在无网络时给出更明确的操作提示。**但这属于方案变更，需要你先决定，本次不擅自实施。**

---

## 七、我无法检查的部分（如实说明）

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 浏览器 **Network 面板** | **未能检查** | 我可用的浏览器工具只能读取 DOM、无障碍树和控制台 console 日志，**没有访问 Network 面板的能力**。因此拿不到「请求头、响应头、精确的失败阶段 net::ERR_ 代码、请求是否真的发出去了」这些一手信息。第三、四节的结论是用**等价的外部命令**（PowerShell、curl、TCP 探测、DNS 查询）交叉验证得出的，**不是**从 Network 面板读到的。 |
| 浏览器控制台里的网络错误提示 | 部分 | 我只能读到通过 console.error / console.warn 输出的内容（本次 0 条）。Chrome 在控制台里以「网络请求」形式展示的 net::ERR_xxx 提示**不属于** console 调用，我读不到。 |
| 真实接口的响应内容 | **未能检查** | 因为连不通 |
| 开启代理后是否恢复 | **未测试** | 本机无代理配置 |

### 如果你愿意提供以下信息，可以进一步确认

1. 在浏览器里打开 **Network 面板 → 点搜索 → 看那条 search.json 请求的 Status 列**，告诉我显示的是 (failed) net::ERR_CONNECTION_TIMED_OUT 还是别的（例如 (blocked)、403、429）。
2. 你是否能在浏览器 / 系统层开启代理或 VPN；开启后再打开你给的测试 URL，把结果告诉我。
3. 如果换一个网络（手机热点等）能打开，请告知 —— 这能进一步确认是当前网络环境所致。

---

## 八、一句话总结

**代码没问题，问题在网络。**

openlibrary.org 在本机被 DNS 污染 + TLS(SNI) 阻断：系统 DNS 返回 Meta 的假 IP，TCP 直接超时；即便用真实 IP（207.241.234.205）绕过 DNS，TLS 握手也会被重置。

因此 **改 hosts / 换 DNS 都无效，必须走代理或 VPN**。

当前代码在连不上时的表现是「约 20 秒后给出明确错误提示 + 重试按钮，不白屏」，符合预期要求；唯一可以优化的是把等待时间从 20 多秒缩短到 10 秒以内。

---

*本报告只记录实际执行与观测到的结果，未执行或无法检查的项目均已明确标注。本次未修改任何项目代码。*
