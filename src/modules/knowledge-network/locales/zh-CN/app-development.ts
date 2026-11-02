/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const appDevelopmentPart = {
  appDevelopment: {
    nav: "应用开发",
    title: "应用开发",
    description: "用这个知识网络开发应用。下面的示例按当前网络的真实结构生成，设置令牌后即可运行。",
    loading: "正在读取网络结构…",
    loadFailed: "读取网络结构失败：{{message}}",
    copy: "复制",
    copied: "已复制",
    copyFailed: "复制失败",
    tryIt: "去试运行",
    apiDocs: "接口文档",
    tabs: { rest: "REST", python: "Python", typescript: "TypeScript" },
    guide: {
      title: "{{name}} 应用开发指南",
      meta: "知识网络 ID：{{knId}} · 平台：{{origin}}",
      download: "下载 Markdown",
      view: "以网页查看",
      scenarioItem: "{{title}}：{{description}}",
    },
    start: {
      title: "起步",
      token: "拿到令牌。示例都从环境变量 BKN_TOKEN 读令牌，页面上不显示令牌。",
      authDocs: "认证说明",
      apiKeyTab: "API Key",
      oauthTab: "OAuth 登录",
      apiKey:
        "长期有效，适合脚本、定时任务和服务端应用，以签发人的身份和权限调用：查对象、运行 Cypher、语义搜索、指标和 BKN Agent 问答。执行行动、调用函数建议用 OAuth 登录的令牌。",
      apiKeyLink: "去创建 API Key",
      oauth:
        "以登录用户的身份调用，可用于全部接口，令牌 1 小时过期。自己开发调试时用命令行登录；给别人用的应用见下方「让用户登录你的应用」。",
      pythonTools: { venv: "venv + pip", uv: "uv" },
      pythonSetup: {
        python: "需要 Python 3.10 及以上；python3 版本更低时换成具体版本，如 python3.12",
        activate: "Windows 上用 .venv\\Scripts\\activate；新开终端要重新激活",
        uv: "uv 会自己准备合适的 Python",
      },
      install: "安装 SDK",
      python: "bkn-osdk 不在 PyPI，按 bkn-sdk 的一个提交从 GitHub 安装。",
      typescript: "需要 Node 22.19 及以上，示例按 ES 模块写（.mjs 文件）。",
      cli: "命令行工具 openbkn 也在这个包里，加 -g 全局安装即可使用。",
      typescriptVersion: "SDK 版本必须与平台版本一致，当前平台是 {{version}}。",
      typescriptDevBuild:
        "当前平台是开发版（{{version}}），下面的命令装同一版本号的预发布版（如 rc）；正式版发布后，同一条命令会装到正式版。",
      typescriptUnknown: "没有读到平台版本。SDK 版本必须与平台版本一致。",
    },
    osdk: {
      title: "本体 SDK",
      description:
        "按这个网络的结构生成一个 Python 包（OSDK）：每个对象类一个类，属性带类型，关系可以直接走。适合在 Python 应用和数据分析里读取数据。",
      generate:
        "生成。在起步里建好的项目目录（my-app）里运行，已有项目就在项目里运行。平台地址和令牌按起步里的设置读取；--out 指定包的目录，不存在会自动创建，Python 按目录名导入（--out ./supply 就是 import supply）。生成后的目录结构：",
      layoutNote: {
        venv: "运行：python main.py（新开终端先 source .venv/bin/activate）。代码和 bkn/ 不在同一层时会报 No module named 'bkn'，这时把 my-app 加进 PYTHONPATH。",
        uv: "运行：uv run main.py。代码和 bkn/ 不在同一层时会报 No module named 'bkn'，这时把 my-app 加进 PYTHONPATH。",
      },
      layout: {
        venvEnv: "虚拟环境（安装 SDK 时建的）",
        uvEnv: "uv 建的虚拟环境",
        pyproject: "项目和依赖（uv add 写进来的）",
        lock: "锁定的依赖版本",
        mainUv: "你的代码（uv init 建的 main.py，换成示例代码），和 bkn/ 放在同一层",
        project: "你的项目目录（起步里建的，或已有项目）",
        package: "bkn-osdk generate 生成的包（--out ./bkn）",
        init: "import bkn：KN_ID、search、search_instances",
        objectTypes: "每个对象类一个类：from bkn.object_types import …",
        relationTypes: "关系类",
        metrics: "指标",
        main: "你的代码，和 bkn/ 放在同一层",
      },
      use: "使用。下面的类名、属性名和关系名就是为这个网络生成的名字。",
      check:
        "把生成的包提交到代码库，在 CI 里运行 bkn-osdk check：网络结构变化时会报出来，并区分新增和不兼容的变化。",
      scope: "本体 SDK 只用于读取。执行行动、调用函数用下面「能力」里的写法。",
      moreExamples: "更多示例",
      examples: {
        query: {
          title: "查对象",
          note: "条件支持 ==、!=、>、>=、<、<=、is_in、not_in、exists、not_exists，用 &（并且）、|（或者）、~（取反）组合。判断空值用 exists / not_exists，不能写 == None。",
        },
        relations: {
          title: "沿关系",
          note: "一跳按关系的关联属性查目标对象类，结果和普通查询一样能接着过滤、排序、分页。多跳由平台沿路径查，返回最后一跳的对象，路径上每个对象类都要绑定数据。",
        },
        search: {
          title: "从问题开始",
          note: "还不知道网络里的名字时从这里开始：search 找出问题涉及的对象类，search_instances 召回具体对象，只有建了索引的属性参与。知道名字后改用类型化查询。",
        },
        cypher: {
          title: "运行 Cypher",
          note: "跨多个对象类过滤、聚合，或一次取多个对象类的属性时用 Cypher。结果按列返回，不转成生成的类；语句写法见下方「能力」里的「运行 Cypher」。",
        },
      },
      comments: {
        get: "按主键取一个对象",
        where: "按条件查：属性带类型，写错属性名或类型会直接报错",
        combine: "~ 取反；& 并且，| 或者",
        page: "排序、只取部分属性、分页并带总数",
        iterate: "逐页读完整个对象类",
        count: "统计数量",
        hop: "沿「{{relation}}」取{{target}}",
        multiHop: "再沿「{{relation}}」走到{{target}}，返回最后一跳的对象",
        searchTypes: "这个问题涉及哪些对象类",
        searchInstances: "召回相关的对象",
      },
      unavailable:
        "对象类「{{name}}」的 ID 不能作为 Python 类名，生成时会报错，需要先改对象类 ID。",
      empty: "网络里没有绑定了数据的对象类，暂时没有可演示的用法。",
    },
    capabilitiesTitle: "能力",
    queryObjects: {
      title: "查对象",
      description: "按条件读取一个对象类的实例。",
      sampled: "过滤条件取自对象类「{{name}}」的一条样例数据。",
      unsampled: "没有读到对象类「{{name}}」的样例数据，示例不带过滤条件。",
      empty: "网络里没有绑定了数据的对象类。",
      emptyLink: "去看对象类",
    },
    cypher: {
      title: "运行 Cypher",
      description: "用 Cypher 查询这个网络，例如从一个对象出发，沿关系取相关对象的属性。",
      relation: "示例沿关系「{{name}}」，起点取自一条样例数据。",
      unanchored: "示例沿关系「{{name}}」。没有读到起点的样例数据，示例不限定起点。",
      empty: "网络里没有两端都绑定了数据的关系。",
      emptyLink: "去看关系类",
      try: "在这里运行",
      query: "语句",
      parameters: "参数（JSON）",
      parametersInvalid: "参数不是合法的 JSON 对象",
      run: "运行",
      rows: "{{count}} 行",
      truncated: "只显示前 {{count}} 行",
      noRows: "没有结果",
      failed: "运行失败：{{message}}",
    },
    search: {
      title: "语义搜索",
      description: "用自然语言或关键词搜索实例。",
      objectType: "示例用对象类「{{name}}」的名称作查询词。",
      empty: "网络里没有索引可用的对象类，语义搜索查不到实例。",
      emptyLink: "去对象类建索引",
      placeholder: "输入查询词，直接在这里试",
      run: "搜索",
      noHits: "没有搜到实例",
      hits: "搜到 {{count}} 条",
      failed: "搜索失败：{{message}}",
    },
    metric: {
      title: "指标",
      description: "读取已发布的对象指标，按指标自身的口径计算。",
      name: "示例读取指标「{{name}}」的第 {{version}} 版。",
      empty: "网络里还没有已发布的指标。",
      emptyLink: "去看指标",
    },
    action: {
      title: "执行行动",
      description: "对指定的对象执行一个行动。本页只给出写法，不执行。",
      name: "示例执行行动「{{name}}」。",
      restNote:
        "建议用 Python 或 TypeScript 执行行动，SDK 会自动处理会话。这里只列出 REST 请求，没给可直接运行的 curl：平台开启「Trace 与证据采集」后，执行行动前要先开一个会话（平台用它把这次调用记进 Trace），否则返回 400 conversation_required；而会话只能通过 MCP 开启，REST 开不了。没开采集的平台可以直接发这个请求。",
      placeholdersCreate: "替换 < > 中的占位值后再执行。",
      placeholders:
        "替换 < > 中的占位值后再执行。目标对象必须写明：留空会对所有符合行动条件的对象执行。",
      empty: "网络里还没有行动类。",
      emptyLink: "去看行动类",
    },
    function: {
      title: "调用函数",
      description: "调用挂载到这个网络的函数。",
      name: "示例调用函数「{{name}}」。替换 arguments 中的占位值后再执行。",
      result: "函数自身出错时接口也返回 200，要看返回体里的 exit_code 和 stderr。",
      empty: "网络里还没有挂载函数。",
      emptyLink: "去挂载函数",
    },
    check: {
      mismatch: "示例待更新：与平台公布的工具参数不一致（{{detail}}）。",
      unchecked: "无法与平台核对参数定义，示例可能已过期。",
      missing: "缺少 {{fields}}",
      undeclared: "多出 {{fields}}",
      unknownTool: "平台没有提供 {{tool}}",
    },
    login: {
      title: "让用户登录你的应用",
      description:
        "应用要以登录用户的身份调用平台时，用 OAuth 登录拿令牌。两种方式都是用户用自己的平台账号登录，应用拿到代表该用户的令牌、按他的权限访问，区别在令牌怎么回到应用。令牌 1 小时过期，用 refresh_token 续期；每次续期都会换一个新的 refresh_token，要保存最新的。",
      deviceTitle: "方式一：设备授权（不用注册客户端）",
      codeTitle: "方式二：授权码登录（先注册客户端）",
      device:
        "不用注册客户端，直接用平台内置的公共客户端 openbkn-sdk。适合命令行工具、桌面程序和后台任务：把登录链接发给用户，用户在浏览器里确认后，应用拿到令牌。",
      deviceComments: {
        start: "1. 发起登录，把返回的 verification_uri_complete 发给用户在浏览器里打开",
        poll: "2. 用 device_code 换令牌；用户确认前返回 authorization_pending，按 interval 秒重试",
        refresh: "3. 令牌过期后续期",
      },
      code: "适合有自己界面的应用：用户点「用平台账号登录」，在浏览器里登录后跳回你的应用。需要先注册一个客户端。",
      codeComments: {
        register: "1. 注册客户端（不需要登录），记下返回的 client_id",
        authorize: "2. 让用户在浏览器打开授权地址；code_challenge 由应用按 PKCE 生成",
        exchange: "3. 回调收到 code 后换令牌",
      },
      sdk: {
        python: "bkn-osdk 负责登录和续期：令牌快过期或失效时自动续期，并把新令牌交给 save。",
        typescript:
          "SDK 负责登录和续期：令牌快过期或失效时自动续期，并把新令牌交给 save。存成 .mjs 文件运行。",
        typescriptUnavailable:
          "TypeScript SDK 从 0.2.1 起提供登录接口，SDK 版本又必须与平台一致，所以这个平台请用 REST 或 Python。",
      },
      sdkComments: {
        clientId: "注册时返回的 client_id",
        redirectUri: "注册时填的回调地址",
        save: "每次续期都会换新的 refresh_token、旧的随即作废，所以每拿到一次新令牌都要存下来。",
        saveWhere: "这里存成只有自己能读的本机文件；代多个用户调用的服务，按用户存进数据库。",
        reuse: "登录过就接着用存下的令牌（续期也失败时，删掉这个文件重新登录）；没有才让用户登录",
        deviceLogin: "打印登录链接和确认码，等用户在浏览器里确认",
        codeLogin: "打开浏览器让用户登录，在回调地址上等授权码并换取令牌",
        call: "以这个用户的身份调用平台",
        deviceClient: "设备授权的令牌属于内置客户端 openbkn-sdk，续期不用传 client_id",
        promptOpen: "在浏览器里打开：",
        promptCode: "确认码：",
      },
      codeRules:
        "只能注册公共客户端：不发密钥，必须用 PKCE。回调地址只能是本机地址（127.0.0.1、localhost、[::1]，端口不限）；网页应用要用自己的域名回调，需要运维在 bkn-safe 配置里放行这个域名。用户可以在「已连接客户端」里查看和断开。",
      connectedClients: "已连接客户端",
      codeUnavailable: "这个平台没有开放客户端注册，请用设备授权。",
      registerTitle: "注册新客户端",
      registerNote:
        "注册不需要登录，会在平台上创建一个公共客户端；也可以用下面 REST 写法第 1 步的 curl 注册。",
      clientName: "应用名称",
      redirectUri: "回调地址",
      register: "注册",
      registered: "已注册。记下 client_id，在授权地址和换令牌时使用。",
      registerFailed: "注册失败：{{message}}",
    },
    agent: {
      title: "在应用里用平台的 Agent",
      description:
        "BKN Agent 理解业务问题，自己查这个网络里的数据后回答。应用只要把问题交给执行接口，不用自己拼查询。",
      scenariosTitle: "可以这样用",
      scenarios: {
        ask: {
          title: "业务系统里的问答框",
          description: "在系统里放一个输入框，用户直接用业务语言提问。",
          example: "{{name}}一共有多少个？",
        },
        explain: {
          title: "详情页上的「帮我分析」",
          description: "在一条记录的页面上加一个按钮，把这条记录交给 Agent 分析。",
          example: "分析一下{{name}}「{{value}}」的情况",
        },
        digest: {
          title: "定时生成摘要",
          description: "定时任务调用执行接口，把回答推送到群聊或邮件。",
          example: "汇总一下{{name}}目前的整体情况",
        },
        bot: {
          title: "聊天机器人",
          description: "飞书、企业微信机器人收到消息后转给执行接口，再把答案发回去。",
        },
      },
      exampleQuestion: "例：{{question}}",
      request: "示例用工作区「智能问答」的预置 Agent studio_smart_qa，问题取自第一个场景。",
      response:
        "返回事件流：token 事件逐段给出回答，result 事件里的 content.answer 是最终答案，terminal 表示结束。",
      ownAgent:
        "要用自己配置的 Agent，把 agent_id 换成它的 ID。client_request_id 每次请求取不同的值，示例用 uuidgen 生成。",
    },
    sampleApp: {
      title: "完整示例：问答网页",
      description:
        "一个 FastAPI 网页：侧栏列出这个网络的对象类，点开看前 10 个对象；下方和平台的问答 Agent 多轮对话（回答边生成边显示，显示查了哪些工具，Markdown 渲染）。身份两种：OAuth 登录版让用户用自己的平台账号登录、各按自己的权限取数；API Key 版不用登录，所有访问者共用应用的 API Key 和它的权限。读对象也有两种写法，见下方切换。",
      oauthTab: "OAuth 登录版",
      apiKeyTab: "API Key 版",
      modes: {
        generated: "用生成的本体 SDK",
        runtime: "不生成代码",
      },
      modeNotes: {
        generated:
          "先用 bkn-osdk generate 生成本体 SDK，代码通过生成的类读对象，属性带类型。生成的类里只有 ID，侧栏的名称运行时从平台取；网络结构变了要重新生成。",
        runtime:
          "不生成代码：运行时从平台读对象类列表和属性定义，再查对象。网络结构变了不用改代码，代价是属性没有类型提示。",
      },
      runtimeGuide:
        "不生成代码时只有读对象这段不同（也不用生成本体 SDK），换成下面的代码；完整代码见附录「{{appendix}}」。",
      apiKey: {
        create: "创建一个 API Key：网页以它的签发人身份和权限提问。",
        install: "建项目并安装依赖。",
        generate: "用这个 API Key 生成本体 SDK（网页列出对象时用）。",
        save: "下载 app.py，放进 qa-app 目录。",
        saveGuide: "把附录「{{appendix}}」的代码存成 qa-app/app.py。",
        start: "设置 API Key 后在 qa-app 里启动，然后在浏览器打开 {{url}}。",
        limits:
          "所有访问者都以 API Key 签发人的身份和权限提问，适合团队内部工具；要按人区分权限，用 OAuth 登录版。API Key 只放在服务端，不要写进网页或发给浏览器。",
      },
      register:
        "注册客户端：在上面「方式二」里注册新客户端，回调地址用默认的 {{redirectUri}}，记下返回的 client_id。",
      install: "建项目并安装依赖。",
      generate: "生成本体 SDK（用你自己的令牌，见起步）。网页运行时按登录用户的权限读数据。",
      save: "下载 app.py，放进 qa-app 目录，把 CLIENT_ID 换成你的 client_id。",
      saveGuide:
        "把附录「{{appendix}}」的代码存成 qa-app/app.py，把 CLIENT_ID 换成你的 client_id。",
      download: "下载 app.py",
      keyCode: "关键代码",
      keyCodeNote: "app.py 里和平台打交道的几段，都取自下载的文件；其余是网页（HTML 和脚本）。",
      showFullCode: "展开完整代码（{{count}} 行）",
      hideFullCode: "收起完整代码",
      excerptLine: "{{title}}：{{description}}",
      excerpts: {
        objects: {
          generated: {
            title: "读对象",
            description:
              "两个接口：对象类列表（名称从平台取），某个对象类的前 10 行和总数（用生成的类读）。",
          },
          runtime: {
            title: "读对象",
            description: "两个接口：从平台读对象类列表，查某个对象类的前 10 行和总数。",
          },
        },
        agent: {
          title: "调用问答 Agent",
          description: "开启一轮对话（带 thread_id 接着上一轮），把 Agent 的事件流原样转给网页。",
        },
        signIn: {
          title: "登录与续期",
          description:
            "跳到平台登录，回调里用授权码换令牌，快过期时在锁内续期；读数据时用这个用户的令牌。",
        },
      },
      appendix: "附录：完整代码",
      layout: {
        check: "启动前确认 qa-app 的目录结构，下面的命令都在 qa-app 里运行。",
        project: "示例项目，在这里启动",
        app: "下载的 app.py",
        uvMain: "uv init 建的，用不到，可以删",
      },
      start: "在 qa-app 里启动，然后在浏览器打开 {{url}}。",
      limits:
        "示例把会话和令牌放在内存里，重启要重新登录。正式部署时换成数据库或 Redis；用自己的域名做回调时，需要运维在 bkn-safe 里放行这个域名。",
      unavailable: "这个平台没有开放客户端注册，网页应用没法让用户直接登录。",
      code: {
        title:
          "用平台账号登录的问答网页：登录后在侧栏浏览对象类、查看对象，再和平台的问答 Agent 多轮对话。",
        run: "运行：",
        open: "然后在浏览器打开 {{url}}（要用这个地址：回调地址就是它，登录用的 cookie 才对得上）。",
        apiKeyTitle: "用 API Key 的问答网页：不用登录，所有访问者共用应用的 API Key 和它的权限。",
        apiKeyOpen: "然后在浏览器打开 {{url}}。",
        apiKeyComment: "API Key 只放在服务端，不要写进网页或发给浏览器",
        agent: "平台预置的问答 Agent",
        generatedTypes:
          "生成的类里只有 ID：名称从平台的对象类列表取，只留本体 SDK 里有类、有数据源的。",
        generatedTable:
          "用生成的类读前 10 个对象和总数：属性带类型，值已按类型转换（数值、日期等）。",
        listTypes: "运行时从平台读对象类列表（不用生成代码），只留有数据源、能查到对象的。",
        runtimeTable: "查前 10 个对象和总数，原样交给网页。",
        thread: "带上 thread_id 就接着上一轮聊（多轮对话）",
        forward:
          "把 Agent 的事件流原样转给网页（meta、tool_started、token、result、terminal 等事件），读完关掉连接。",
        page: "网页：样式用 Tailwind（CDN，示例用；正式使用请按 Tailwind 的方式构建 CSS），回答是 Markdown，用 marked 渲染、DOMPurify 过滤后再显示；那条样式让带 hidden 的元素始终隐藏，否则会被 Tailwind 的 grid 等类盖掉",
        clientId: "注册时返回的 client_id",
        redirectUri: "注册时填的回调地址",
        memory: "会话放在内存里，重启就要重新登录；多实例部署时换成 Redis 或数据库",
        pending: "登录中：浏览器 cookie → 这次登录的授权请求（含 PKCE）",
        sessions: "已登录：浏览器 cookie → 这个用户的令牌",
        lock: "同一时间只续期一次：同一个 refresh_token 用两次，平台会作废这个用户的整串令牌",
        refresh: "快过期就续期，换下旧的令牌（每次续期都会换新的 refresh_token）",
        login: "生成 PKCE 和 state，记在这个浏览器上，再把它送去平台登录",
        callback: "校验 state，用授权码换这个用户的令牌",
        asUser: "以这个用户的身份读数据：各人看到的按各自权限过滤。",
        signedIn:
          "这个浏览器登录后的令牌，快过期时先续期。没登录（或令牌已失效）就返回 401，网页据此显示登录按钮。",
        pageTitle: "知识网络问答",
        chatTitle: "问答",
        objectTypes: "对象类",
        readFailed: "读取失败：",
        signInHint: "用你的平台账号登录后，就能查看数据、向 Agent 提问。",
        signIn: "用 OpenBKN 账号登录",
        signOut: "退出",
        newChat: "新对话",
        submit: "提问",
        thinking: "思考中…",
        using: "查询：",
        failed: "请求失败：",
        notSignedIn: "登录没有完成：",
        retry: "重新登录",
        noAnswer: "没有得到回答。",
      },
    },
    mcp: {
      title: "让外部 Agent 使用这个网络",
      description:
        "Claude Code、Cursor 等 Agent 通过 MCP 接入：在 Agent 里添加下面这个 MCP 地址，第一次使用时会打开浏览器登录。",
      network: "连上后，告诉 Agent 使用知识网络 {{knId}}。",
      link: "其他客户端的接入方法",
    },
  },
} as const;
