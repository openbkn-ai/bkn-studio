/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const appDevelopmentPart = {
  appDevelopment: {
    nav: "App development",
    title: "App development",
    description:
      "Build apps on this knowledge network. The examples below are generated from its actual structure and run once a token is set.",
    loading: "Reading the network structure…",
    loadFailed: "Could not read the network structure: {{message}}",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    tryIt: "Try it",
    apiDocs: "API reference",
    tabs: { rest: "REST", python: "Python", typescript: "TypeScript" },
    guide: {
      title: "App development guide for {{name}}",
      meta: "Knowledge network ID: {{knId}} · Platform: {{origin}}",
      download: "Download Markdown",
      view: "View as web page",
      scenarioItem: "{{title}}: {{description}}",
    },
    start: {
      title: "Get started",
      token:
        "Get a token. Every example reads it from the BKN_TOKEN environment variable; the page never shows it.",
      authDocs: "Authentication",
      apiKeyTab: "API key",
      oauthTab: "OAuth sign-in",
      apiKey:
        "Long-lived, for scripts, scheduled jobs and server-side apps; it calls as its issuer, with the issuer's permissions: querying objects, running Cypher, semantic search, metrics and BKN Agent Q&A. For running actions and calling functions, use a token from OAuth sign-in.",
      apiKeyLink: "Create an API key",
      oauth:
        "Calls as the signed-in user and works with every API; the token expires after an hour. Sign in with the CLI while you develop; for an app other people use, see “Sign users in to your app” below.",
      pythonTools: { venv: "venv + pip", uv: "uv" },
      pythonSetup: {
        python:
          "Needs Python 3.10 or later; if python3 is older, name a version such as python3.12",
        activate: "On Windows, .venv\\Scripts\\activate; activate again in a new terminal.",
        uv: "uv picks a suitable Python itself",
      },
      install: "Install the SDK",
      python: "bkn-osdk is not on PyPI; install it from a bkn-sdk commit on GitHub.",
      typescript: "Requires Node 22.19 or later; the examples are ES modules (.mjs files).",
      cli: "The openbkn CLI ships in the same package; install it with -g to use it.",
      typescriptVersion: "The SDK version must match the platform version, which is {{version}}.",
      typescriptDevBuild:
        "This platform is a development build ({{version}}). The command below installs a prerelease of the same version (an rc, say); once the release is out, the same command installs it.",
      typescriptUnknown:
        "The platform version could not be read. The SDK version must match the platform version.",
    },
    osdk: {
      title: "Ontology SDK",
      description:
        "Generate a Python package (OSDK) from this network's structure: one class per object type, typed properties, and relations you can follow. Use it to read data in Python apps and analysis.",
      generate:
        "Generate. Run it in the project directory from Get started (my-app), or in your existing project. The platform address and token come from the setup in Get started; --out names the package directory, created if missing, and Python imports it by that name (--out ./supply means import supply). The result looks like this:",
      layoutNote: {
        venv: "Run python main.py (in a new terminal, source .venv/bin/activate first). If your code is not next to bkn/, the import fails with No module named 'bkn'; then add my-app to PYTHONPATH.",
        uv: "Run uv run main.py. If your code is not next to bkn/, the import fails with No module named 'bkn'; then add my-app to PYTHONPATH.",
      },
      layout: {
        venvEnv: "Virtual environment (made when installing the SDK)",
        uvEnv: "Virtual environment uv made",
        pyproject: "The project and its dependencies (written by uv add)",
        lock: "Locked dependency versions",
        mainUv: "Your code (the main.py uv init made, replaced by the example), next to bkn/",
        project: "Your project directory (new, or one you have)",
        package: "The package bkn-osdk generate writes (--out ./bkn)",
        init: "import bkn: KN_ID, search, search_instances",
        objectTypes: "One class per object type: from bkn.object_types import …",
        relationTypes: "Relation types",
        metrics: "Metrics",
        main: "Your code, next to bkn/",
      },
      use: "Use. The class, property and relation names below are the ones generated for this network.",
      check:
        "Commit the generated package and run bkn-osdk check in CI: it reports changes to the network's structure and tells additive changes from breaking ones.",
      scope:
        "The Ontology SDK only reads. To run actions or call functions, use the examples under Capabilities.",
      moreExamples: "More examples",
      examples: {
        query: {
          title: "Query objects",
          note: "Conditions support ==, !=, >, >=, <, <=, is_in, not_in, exists and not_exists, combined with & (and), | (or) and ~ (not). Test for a missing value with exists / not_exists, not == None.",
        },
        relations: {
          title: "Follow relations",
          note: "One hop queries the target object type by the relation's join properties, so the result filters, sorts and pages like any query. Several hops are walked by the platform and return the objects at the last hop; every object type on the path must be bound to data.",
        },
        search: {
          title: "Start from a question",
          note: "Start here when you do not know the network's names yet: search finds the object types a question is about, and search_instances recalls objects, from indexed properties only. Once you know the names, switch to typed queries.",
        },
        cypher: {
          title: "Run Cypher",
          note: "Use Cypher to filter across object types, aggregate, or read properties of several object types at once. Results come back as columns, not generated classes; for the statement syntax, see Run Cypher under Capabilities.",
        },
      },
      comments: {
        get: "Get one object by its primary key",
        where: "Query by condition: properties are typed, so a wrong name or type fails at once",
        combine: "~ negates; & is and, | is or",
        page: "Sort, pick properties, and page with a total",
        iterate: "Read the whole object type page by page",
        count: "Count them",
        hop: "Follow “{{relation}}” to {{target}}",
        multiHop: "Then follow “{{relation}}” to {{target}}; returns the objects at the last hop",
        searchTypes: "Which object types the question is about",
        searchInstances: "Recall related objects",
      },
      unavailable:
        "The id of the object type “{{name}}” is not a valid Python class name, so generation would fail; rename the object type first.",
      empty: "No object type in this network is bound to data, so there is nothing to show yet.",
    },
    capabilitiesTitle: "Capabilities",
    queryObjects: {
      title: "Query objects",
      description: "Read the instances of an object type that match a condition.",
      sampled: "The filter comes from a sample instance of the object type “{{name}}”.",
      unsampled: "No sample instance of “{{name}}” was found, so the example has no filter.",
      empty: "No object type in this network is bound to data.",
      emptyLink: "View object types",
    },
    cypher: {
      title: "Run Cypher",
      description:
        "Query this network with Cypher, for example from one object along relations to the properties of related objects.",
      relation: "The example follows the relation “{{name}}” from a sample instance.",
      unanchored:
        "The example follows the relation “{{name}}”. No sample start instance was found, so the start is not pinned.",
      empty: "No relation in this network has data bound on both ends.",
      emptyLink: "View relation types",
      try: "Run it here",
      query: "Statement",
      parameters: "Parameters (JSON)",
      parametersInvalid: "Parameters must be a JSON object",
      run: "Run",
      rows: "{{count}} rows",
      rows_one: "{{count}} row",
      rows_other: "{{count}} rows",
      truncated: "Showing the first {{count}} rows",
      truncated_one: "Showing the first {{count}} row",
      truncated_other: "Showing the first {{count}} rows",
      noRows: "No results",
      failed: "Run failed: {{message}}",
    },
    search: {
      title: "Semantic search",
      description: "Search instances with natural language or keywords.",
      objectType: "The example searches for the name of the object type “{{name}}”.",
      empty: "No object type in this network has a usable index, so semantic search finds nothing.",
      emptyLink: "Build an index",
      placeholder: "Type a query to try it here",
      run: "Search",
      noHits: "No instances found",
      hits: "{{count}} found",
      failed: "Search failed: {{message}}",
    },
    metric: {
      title: "Metrics",
      description: "Read a published object metric, computed the way the metric defines.",
      name: "The example reads version {{version}} of the metric “{{name}}”.",
      empty: "This network has no published metric yet.",
      emptyLink: "View metrics",
    },
    action: {
      title: "Run actions",
      description: "Run an action on chosen objects. This page shows how; it runs nothing.",
      name: "The example runs the action “{{name}}”.",
      restNote:
        "Use Python or TypeScript to run actions: the SDK handles the session for you. Only the REST request is listed here, not a curl command to run. With Trace and evidence capture on, an action needs a session first (the platform uses it to record the call in Trace), or the request returns 400 conversation_required, and only MCP can open a session. On a platform with capture off, you can send this request as is.",
      placeholdersCreate: "Replace the values in < > before running.",
      placeholders:
        "Replace the values in < > before running. Always name the target objects: left empty, the action runs on every object its condition matches.",
      empty: "This network has no action type yet.",
      emptyLink: "View action types",
    },
    function: {
      title: "Call functions",
      description: "Call a function mounted on this network.",
      name: "The example calls the function “{{name}}”. Replace the placeholders in arguments before running.",
      result:
        "A function that fails still returns HTTP 200; check exit_code and stderr in the response.",
      empty: "No function is mounted on this network yet.",
      emptyLink: "Mount a function",
    },
    check: {
      mismatch:
        "This example needs an update: it does not match the platform's tool parameters ({{detail}}).",
      unchecked:
        "The tool parameters could not be checked against the platform; the example may be out of date.",
      missing: "missing {{fields}}",
      undeclared: "unexpected {{fields}}",
      unknownTool: "the platform has no {{tool}}",
    },
    login: {
      title: "Sign users in to your app",
      description:
        "When your app calls the platform as the signed-in user, get the token through OAuth. Either way, users sign in with their own platform account and the app gets a token that acts as them, with their permissions; the two differ in how the token gets back to the app. It expires after an hour; renew it with refresh_token, which changes on every renewal, so keep the latest one.",
      deviceTitle: "Option 1: device authorization (no client to register)",
      codeTitle: "Option 2: authorization code (register a client first)",
      device:
        "No client to register: use the platform's built-in public client openbkn-sdk. Suits CLIs, desktop programs and background jobs: send the user a sign-in link, and once they confirm in the browser, the app gets the token.",
      deviceComments: {
        start: "1. Start sign-in and send the returned verification_uri_complete to the user",
        poll: "2. Exchange device_code for tokens; until the user confirms this returns authorization_pending, so retry every interval seconds",
        refresh: "3. Renew the token when it expires",
      },
      code: "For an app with its own interface: the user clicks “Sign in with your platform account”, signs in in the browser, and returns to your app. Register a client first.",
      codeComments: {
        register: "1. Register a client (no sign-in needed) and keep the returned client_id",
        authorize:
          "2. Open the authorization URL in the user's browser; the app generates code_challenge with PKCE",
        exchange: "3. Exchange the code your callback receives for tokens",
      },
      sdk: {
        python:
          "bkn-osdk handles sign-in and renewal: it renews the token before it expires or once it is rejected, and hands each new set to save.",
        typescript:
          "The SDK handles sign-in and renewal: it renews the token before it expires or once it is rejected, and hands each new set to save. Save it as an .mjs file.",
        typescriptUnavailable:
          "The TypeScript SDK signs users in from 0.2.1, and its version must match the platform's, so use REST or Python on this platform.",
      },
      sdkComments: {
        clientId: "The client_id returned when you registered",
        redirectUri: "The callback URL you registered",
        save: "Every renewal issues a new refresh_token and retires the old one, so save each new set.",
        saveWhere:
          "This example keeps them in a file only you can read; a service acting for many users keeps them per user in a database.",
        reuse:
          "Reuse saved tokens if the user signed in before (delete the file to sign in again if renewal fails too); otherwise sign the user in",
        deviceLogin:
          "Print the sign-in link and code, and wait for the user to confirm in a browser",
        codeLogin:
          "Open the browser for the user to sign in, then take the code on the callback and exchange it",
        call: "Call the platform as this user",
        deviceClient:
          "Device tokens belong to the built-in client openbkn-sdk, so renewal needs no client_id",
        promptOpen: "Open in a browser:",
        promptCode: "Code:",
      },
      codeRules:
        "Only public clients can register: no secret, and PKCE is required. Callbacks must be on this machine (127.0.0.1, localhost or [::1], any port); for a web app with its own domain, an operator has to allow that domain in the bkn-safe configuration. Users see and disconnect these apps under connected clients.",
      connectedClients: "Connected clients",
      codeUnavailable:
        "This platform does not let clients register themselves; use device authorization.",
      deviceUnavailable:
        "This platform does not publish a device authorization endpoint, so there is no device sign-in example.",
      registerTitle: "Register a new client",
      registerNote:
        "Registering needs no sign-in and creates a public client on the platform; you can also register with the curl in step 1 of the REST version below.",
      clientName: "App name",
      redirectUri: "Callback URL",
      register: "Register",
      registered:
        "Registered. Keep the client_id for the authorization URL and the token exchange.",
      registerFailed: "Registration failed: {{message}}",
    },
    agent: {
      title: "Use the platform's agent in your app",
      description:
        "BKN Agent understands business questions and answers them by reading this network's data itself. Your app hands it the question; it builds no query.",
      scenariosTitle: "What you can build",
      scenarios: {
        ask: {
          title: "A question box in a business system",
          description: "Add an input where people ask in their own business terms.",
          example: "How many {{name}} are there?",
        },
        explain: {
          title: "An “analyze this” button on a detail page",
          description: "Add a button to a record's page that hands the record to the agent.",
          example: "Analyze {{name}} “{{value}}”",
        },
        digest: {
          title: "A scheduled digest",
          description:
            "A scheduled job calls the execution endpoint and posts the answer to a chat or by email.",
          example: "Summarize where {{name}} stand now",
        },
        bot: {
          title: "A chat bot",
          description:
            "A Feishu or WeCom bot forwards each message to the execution endpoint and posts the answer back.",
        },
      },
      exampleQuestion: "For example: {{question}}",
      request:
        "The example uses studio_smart_qa, the preset agent behind the workspace's smart Q&A, with the first scenario's question.",
      response:
        "It streams events: token events carry the answer piece by piece, content.answer in the result event is the final answer, and terminal ends the stream.",
      ownAgent:
        "To use an agent you configured, set agent_id to its id. Give each request its own client_request_id; the example generates one with uuidgen.",
    },
    sampleApp: {
      title: "Full example: a Q&A page",
      description:
        "A FastAPI page with the network's object types in a side list, the first 10 objects of the one you pick, and a chat with the platform's Q&A Agent (answers shown as they are written, the tools it used, Markdown rendered). Two identities: with OAuth sign-in, users sign in with their own platform account and each reads with their own permissions; with an API key, nobody signs in and every visitor shares the app's key and its permissions. Objects can be read two ways too; switch below.",
      oauthTab: "OAuth sign-in",
      apiKeyTab: "API key",
      modes: {
        generated: "Generated SDK",
        runtime: "No generated code",
      },
      modeNotes: {
        generated:
          "Generate the Ontology SDK with bkn-osdk generate first; the code reads objects through the generated classes, with typed properties. The classes carry ids only, so the side list's names come from the platform at run time; when the network changes, generate again.",
        runtime:
          "No generated code: at run time the page reads the object types and their property definitions from the platform, then the objects. The code keeps working when the network changes, at the cost of untyped properties.",
      },
      runtimeGuide:
        "With no generated code, only the reading differs (and there is no Ontology SDK to generate): use the code below instead. The full code is in the appendix “{{appendix}}”.",
      apiKey: {
        create: "Create an API key: the page asks as its issuer, with the issuer's permissions.",
        install: "Create the project and install the dependencies.",
        generate:
          "Generate the Ontology SDK with this API key (the page lists objects through it).",
        save: "Download app.py into qa-app.",
        saveGuide: "Save the code in the appendix “{{appendix}}” as qa-app/app.py.",
        start: "Set the API key and start it in qa-app, then open {{url}} in a browser.",
        limits:
          "Every visitor asks as the API key's issuer, with the issuer's permissions, which suits a team's internal tool; to tell people apart, use the OAuth version. Keep the API key on the server, never in the page or the browser.",
      },
      register:
        "Register a client: under Option 2 above, register a new client with the default callback {{redirectUri}}, and keep the client_id it returns.",
      install: "Create the project and install the dependencies.",
      generate:
        "Generate the Ontology SDK (with your own token, see Get started). When the page runs, it reads data with the signed-in user's permissions.",
      save: "Download app.py into qa-app and put your client_id in CLIENT_ID.",
      saveGuide:
        "Save the code in the appendix “{{appendix}}” as qa-app/app.py and put your client_id in CLIENT_ID.",
      download: "Download app.py",
      keyCode: "Key code",
      keyCodeNote:
        "The parts of app.py that deal with the platform, taken from the file you download; the rest is the page (HTML and script).",
      showFullCode: "Show the full code ({{count}} lines)",
      hideFullCode: "Hide the full code",
      excerptLine: "{{title}}: {{description}}",
      excerpts: {
        objects: {
          generated: {
            title: "Reading objects",
            description:
              "Two routes: the object types (named from the platform) and one type's first 10 rows and total, read through the generated classes.",
          },
          runtime: {
            title: "Reading objects",
            description:
              "Two routes: the object types read from the platform, and one type's first 10 rows and total.",
          },
        },
        agent: {
          title: "Calling the Q&A agent",
          description:
            "Start a turn (with thread_id to continue the last one) and hand the agent's event stream to the page untouched.",
        },
        signIn: {
          title: "Sign-in and renewal",
          description:
            "Send the user to the platform to sign in, exchange the code in the callback, and renew under a lock before the token expires; reads use this user's token.",
        },
      },
      appendix: "Appendix: full code",
      layout: {
        check: "Before starting, check qa-app's layout; the commands below run in qa-app.",
        project: "The sample's project; start it here",
        app: "The app.py you downloaded",
        uvMain: "Made by uv init and not needed; delete it if you like",
      },
      start: "Start it in qa-app, then open {{url}} in a browser.",
      limits:
        "The example keeps sessions and tokens in memory, so a restart signs everyone out. In production, use a database or Redis; a callback on your own domain needs an operator to allow that domain in bkn-safe.",
      unavailable:
        "This platform does not let clients register themselves, so a web app cannot sign users in.",
      code: {
        title:
          "A Q&A page that signs users in with their platform account, lets them browse the object types and their objects, and chats with the platform's Q&A Agent over several turns.",
        run: "Run:",
        open: "Then open {{url}} in a browser (this exact address: it is the callback's, so the sign-in cookie matches).",
        apiKeyTitle:
          "A Q&A page with an API key: nobody signs in, and every visitor shares the app's key and its permissions.",
        apiKeyOpen: "Then open {{url}} in a browser.",
        apiKeyComment: "Keep the API key on the server, never in the page or the browser",
        agent: "The platform's preset Q&A agent",
        generatedTypes:
          "The generated classes carry ids only: names come from the platform's listing, keeping the types the package has a class for and that have data behind them.",
        generatedTable:
          "The first 10 objects and the total, read through the generated class: typed properties, with values already converted (numbers, dates and so on).",
        listTypes:
          "Read the object types from the platform at run time (no generated code), keeping the ones with data behind them.",
        runtimeTable: "The first 10 objects and the total, handed to the page as they come.",
        thread: "Passing thread_id continues the previous turn (multi-turn chat)",
        forward:
          "Hand the Agent's event stream to the page untouched (meta, tool_started, token, result, terminal and so on), and close the connection when it ends.",
        page: "The page: Tailwind from a CDN for styling (fine for a sample; build the CSS the Tailwind way in production); answers are Markdown, rendered with marked and sanitized with DOMPurify; the one style rule keeps hidden elements hidden, where Tailwind classes such as grid would show them",
        clientId: "The client_id returned when you registered",
        redirectUri: "The callback URL you registered",
        memory:
          "Sessions live in memory, so a restart signs everyone out; with several instances, use Redis or a database",
        pending: "Signing in: browser cookie → this sign-in's request (with PKCE)",
        sessions: "Signed in: browser cookie → this user's tokens",
        lock: "One renewal at a time: a refresh_token used twice makes the platform revoke the user's whole token chain",
        refresh:
          "Renew when about to expire and replace the old set (every renewal issues a new refresh_token)",
        login:
          "Make PKCE and state, remember them for this browser, then send it to the platform to sign in",
        callback: "Check state and exchange the code for this user's tokens",
        asUser: "Read data as this user: each person sees what their permissions allow.",
        signedIn:
          "This browser's tokens, renewed first when they are about to expire. Signed out (or the token no longer works), it answers 401, and the page shows the sign-in button.",
        pageTitle: "Knowledge network Q&A",
        chatTitle: "Q&A",
        objectTypes: "Object types",
        readFailed: "Could not read: ",
        signInHint: "Sign in with your platform account to see the data and ask the Agent.",
        signIn: "Sign in with OpenBKN",
        signOut: "Sign out",
        newChat: "New chat",
        submit: "Ask",
        thinking: "Thinking…",
        using: "Looked up: ",
        failed: "Request failed: ",
        notSignedIn: "Sign-in did not finish: ",
        retry: "Sign in again",
        noAnswer: "No answer. ",
      },
    },
    mcp: {
      title: "Let external agents use this network",
      description:
        "Agents such as Claude Code and Cursor connect over MCP: add the MCP address below to the agent, and it opens a browser sign-in on first use.",
      network: "Once connected, tell the agent to use the knowledge network {{knId}}.",
      link: "How to connect other clients",
    },
  },
} as const;
