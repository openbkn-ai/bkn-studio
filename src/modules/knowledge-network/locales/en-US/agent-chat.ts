/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const agentChatPart = {
  agentChat: {
    fallbackSuggestions: {
      overview: "What data is available? Give me an overview first.",
      changes: "What recent changes should I pay attention to?",
      priorityRecords: "Help me find the records that need the most attention.",
    },
    knContext: {
      name: "Name: {{name}} ({{id}})",
      description: "Description: {{description}}",
      scale: "Scale: {{objectTypes}} object types and {{relations}} relation types",
      objectTypes: "Object types: {{names}}",
      objectTypesMore: "Object types: {{names}} and {{count}} total",
    },
    templateSuggestions: {
      firstObject: "What data does {{name}} have? Show a few records first.",
      group: "What is happening around {{name}}?",
      relation: "What is happening with {{name}}?",
      secondObject: "What should I pay attention to in {{name}}?",
      firstObjectRecent: "What has changed recently for {{name}}?",
    },
    suggestPrompt:
      "You are writing recommended questions for the empty chat page of an intelligent data-questioning product. The user is a non-technical business user.\n" +
      "Below is a JSON structure definition for a business domain. name/comment describe business meaning, object_types are business entities, and relation_types are business relationships.\n" +
      "Write 3 questions that a real business user in this domain would ask. Requirements:\n" +
      "1. Only use business terms that appear in the JSON. Do not invent entities or concepts that are not present, because invented questions will not find data.\n" +
      "2. Do not mention technical terms such as object type, relation type, knowledge network, graph, schema, table, or field. Do not mention English JSON field names. Write like a business user.\n" +
      "3. Each question must be one sentence, no more than 25 Chinese characters or a similarly short English sentence, and answerable with data by querying, counting, or comparing. Do not ask open-ended subjective questions.\n" +
      "4. The 3 questions must cover different angles and must not be synonyms.\n" +
      'Only output a JSON array, for example ["question1","question2","question3"]. Do not output any other text or code fences.',
    profiles: {
      soloEmptyTitle: "Start Validation",
      baseTitle: "Base Data",
      baseEmptyTitle: "Query Data Directly",
      ptcTitle: "PTC · Code Mode",
      ptcEmptyTitle: "Answer by writing a script",
      knTitle: "Business Knowledge Network",
      knEmptyTitle: "Answer with the Knowledge Network",
    },
    // Participants vary (any pair, or all three), so judgeSides supplies each identity
    // from the actual line-up.
    judgeSides: {
      base: "Base Data, which can only query the database directly with SQL/table tools",
      kn: "Business Knowledge Network, which can use all knowledge-network retrieval tools, including semantic schema, instances, subgraphs, and logical attributes",
      ptc: "PTC · Code Mode, which has run_code as its only tool: it writes Python that runs in a sandbox, calls the same knowledge-network capabilities over MCP inside the script, keeps intermediate results in the sandbox, and returns only what it prints",
    },
    judgeRosterLine: "{{letter}}: {{side}}",
    judgePrompt:
      "You are a comparison reviewer. The same question is answered by {{count}} agents, possibly across multiple rounds. Their capabilities are:\n" +
      "{{roster}}\n" +
      "Compare the answers and metrics from these dimensions: 1. correctness and completeness, 2. whether the evidence is sufficient and reliable, 3. efficiency, including tool calls, tokens, and latency, and 4. which side is more useful for business users and why.\n" +
      "Pay special attention to the result status of each round. If a side is marked no valid answer, stopped by user, or execution error, treat that round as a negative result because the task was not completed. It should be judged worse than a side with an effective answer. The more negative rounds a side has, the more the overall review should reflect unreliability.\n" +
      "Output Markdown in the current language: start with one overall verdict that ranks the sides from best to worst with reasons, then compare each round briefly in 2-3 sentences and call out negative results, then summarize in bullets. Be concise and do not restate the full answers.",
    outcome: {
      answered: "Answered",
      stopped: "Stopped by user (negative)",
      error: "Execution error (negative)",
      empty: "No valid answer (negative)",
    },
    answer: {
      notParticipated: "(Not included in this round)",
      empty: "(No answer)",
    },
    calls: {
      zero: "0 calls",
      errorName: "{{name}}(failed)",
      summary: "{{count}} calls ({{ok}} succeeded{{errorPart}}): {{names}}",
      errorPart: " / {{err}} failed",
    },
    errors: {
      modelBusy: "The model service is busy. Try again later.",
      modelUnavailableSwitch: "The model service is busy. The upstream service suggests switching models temporarily.",
      modelRateLimited: "The model service is rate limited. Try again later.",
      modelServerError: "The model service returned an internal error. Try again later.",
      modelReturnedError: "The model service returned an error",
      authExpired: "Your login session has expired. Refresh the page and sign in again.",
      modelNotFound: "The model does not exist or is not online. Check the model configuration in Model Factory.",
      modelTemporaryUnavailable: "The model service is temporarily unavailable. Try again later.",
      requestFailedWithStatus: "Model service request failed (HTTP {{status}})",
      requestFailed: "Model service request failed",
      unparseableResponse: "The model service returned a response that could not be parsed. Try again later or contact an administrator.",
      connectionInterrupted: "The connection to the model service was interrupted. Try again.",
      chatFailed: "Chat execution failed",
    },
    report: {
      title: "Agent Chat Comparison Report · {{knLabel}}",
      generatedAt: "Generated at: {{generatedAt}}",
      modelLine: "{{label}} model: {{model}}",
      overview: "Session Overview",
      metricHeader: "Metric",
      totalTokens: "Total tokens",
      totalDuration: "Total duration",
      rounds: "Rounds",
      totalToolCalls: "Total tool calls",
      invalidRounds: "Invalid rounds (empty/stopped/error)",
      roundTitle: "Round {{round}}",
      questionPerSide: "{{label}}: {{question}}",
      duration: "Duration",
      toolCalls: "Tool calls",
      result: "Result",
      answerTitle: "{{label}} · Answer",
      aiSummary: "AI Summary",
      paneBriefTitle: "{{label}} (model {{model}}; session total {{tokens}} tokens · {{duration}})",
      paneBriefRound:
        "Round {{round}} question: {{question}}\nResult status: {{outcome}}\nMetrics: token {{tokens}}, duration {{duration}}, tools {{toolCount}} calls ({{tools}})\nAnswer: {{answer}}",
      truncated: "{{answer}}...[truncated]",
      none: "none",
      copyMarkdown: "Copy Markdown",
      exportMarkdown: "Export .md",
      copySuccess: "Report Markdown copied",
      copyFailed: "Copy failed",
      downloadName: "comparison-report-{{knId}}-{{stamp}}.md",
      emptyDialog: "No side has a conversation yet. Send a question with All Sides first, then view the report.",
      overviewRounds: "Session overview ({{rounds}} rounds)",
      model: "Model",
      averagePerRound: "Average per round",
      success: "succeeded",
      failed: "failed",
      answerToggle: "Answer (click to expand/collapse)",
      generateSummary: "Generate Summary",
      regenerateSummary: "Regenerate",
      generating: "Generating...",
      thinking: "Reviewer model is thinking...",
      summaryHint: "Use the most capable side's model to review correctness, evidence, and efficiency across all rounds.",
    },
    managedTurns: {
      loadSummary: "Load knowledge network summary",
    },
    placeholders: {
      noLlm: "Connect an LLM in Model Factory before chatting.",
      askAgent: "Ask Agent, for example: {{suggestion}}",
      all: "Ask all {{count}} sides the same question and compare the answers.",
      side: "Send to {{label}}",
    },
    composer: {
      sendTo: "Send to",
      all: "All Sides",
      sides: "Participants",
      reportTitle: "Compare the latest answers and metrics from every side, with an AI summary.",
      report: "Comparison Report",
      stop: "Stop",
      send: "Send",
      compareMode: "Compare Mode",
      ptcMode: "PTC Mode",
      settings: "Chat Settings",
      clear: "Clear",
    },
    chatPane: {
      defaultPrompt:
        "You are the BKN business knowledge network retrieval assistant. Answer user questions based on object types, relation types, and logical attributes in the current knowledge network.\n" +
        "Call the provided retrieval tools when data is needed, such as search_schema, query_object_instance, query_instance_subgraph, and run_sql. Do not fabricate answers.\n" +
        "kn_id is locked to the current network. You do not need to change it and must not change it.\n" +
        "Query efficiently: push aggregation, sorting, and counting to SQL where possible, use LIMIT and precise filters, return only needed fields, avoid loading entire tables or oversized results, and do not repeat queries for information already obtained.",
      ptcPrompt:
        "You are a BKN knowledge-network retrieval assistant. You have a single tool, run_code: " +
        "write Python that the sandbox executes. BKN capabilities are already in scope as functions, " +
        "and kn_id is locked to the current network.\n" +
        "Only what you print comes back; intermediate results stay in the sandbox, so filter, aggregate, " +
        "and join inside the script and print just the conclusion.\n" +
        "\n" +
        "**Solve the whole question in one script.** Every run_code is a round trip; if you run once to " +
        "inspect the structure, again to fetch, and again to aggregate, that is exactly one-tool-at-a-time " +
        "calling and the point of code mode is lost. Chain discovery and answering through variables: feed " +
        "the fields from get_kn_detail / get_object_types straight into the query, the query result straight " +
        "into the aggregation, then print the answer.\n" +
        "The sandbox is a full Python 3.11 with pandas, numpy, scipy, requests, httpx, sqlite3 and the whole " +
        "standard library. Do grouping, joining, and statistics with pandas or collections rather than " +
        "spending another round trip on them.\n" +
        "Handle uncertainty in code, not in the conversation: match field names against the schema you just " +
        "fetched, read values with .get(), wrap fragile branches in try/except, and print the key " +
        "intermediate facts so a single run yields both the answer and the clues to debug it.\n" +
        "Issue a second run_code only when the script fails or the information is genuinely insufficient; " +
        "read the server message first — it names the real field or calling convention.",
      basePrompt:
        "You are a data query assistant. You can only answer user questions by directly querying underlying data tables with three tools:\n" +
        "list_resources lists accessible data tables, describe_resource inspects table columns, and run_sql executes SQL.\n" +
        "Workflow: first use list_resources to find relevant tables, then use describe_resource to confirm columns, then write SQL queries.\n" +
        "Table names in SQL must use template placeholders like {{.<resource_id>}}, where resource_id comes from list_resources entries[].resource_id. Do not write raw table names and do not join across catalogs.\n" +
        "Query efficiently: push aggregation, sorting, and counting to SQL, use LIMIT and precise filters, and return only needed fields.",
      evidenceHint: {
        kn: "which tool was called, what filter conditions were used, or the key SQL points",
        base: "which tables were used and the key SQL points",
      },
      fallbackSuggestions: {
        relations: "What object types and relations are in this knowledge network?",
        customers: "Find recently active high-value customers.",
        links: "How are the object types related?",
      },
      configFields: {
        maxSteps: { label: "Tool Step Limit", hint: "Maximum tool steps per round to prevent runaway calls" },
        keepToolResults: { label: "Retained Tool Results", hint: "Keep only the latest N full tool results between steps. 0 means no eviction" },
        dataToolCap: { label: "Data Result Limit (chars)", hint: "Character limit for run_sql / query_* results. 0 means no truncation" },
        schemaToolCap: { label: "Schema Result Limit (chars)", hint: "Character limit for get_kn_detail / search_schema and similar tools. 0 means no truncation" },
        maxHistoryMessages: { label: "History Messages", hint: "Only keep the latest N messages across rounds" },
        maxTurnChars: { label: "Per-Turn Text Limit (chars)", hint: "Maximum text length for each history message" },
        maxOutputTokens: { label: "Max Output Tokens", hint: "Maximum output per step including reasoning. Increase for reasoning models such as deepseek. 0 means model default" },
      },
      reasoning: {
        live: "Thinking",
        done: "Reasoning",
      },
      toolCall: {
        running: "Calling...",
        failed: "Failed",
        clientBlocked: "Blocked by client",
        clientBlockedRequest: "Model input; request blocked by client -> {{name}}",
        clientBlockedReason: "Block reason",
        request: "Request · tools/call → {{name}}",
        error: "Error",
        response: "Response",
      },
      error: {
        retry: "Retry Round",
        detail: "Details",
      },
      messages: {
        settingsSaved: "Settings saved",
        promptReset: "System prompt reset to default",
        configReset: "Parameters reset to default",
        noModel: "No LLM is available. Configure a default model in Model Factory first.",
      },
      system: {
        contextSection: "## Current Knowledge Network Summary (loaded automatically; call tools for full structure and instances as needed)\n{{context}}",
        historyTruncated: "{{content}}\n...[history truncated]",
      },
      model: {
        defaultSuffix: "{{modelName}} · Default",
      },
      settings: {
        promptPlaceholder: "System prompt. After saving, it will be sent with the conversation.",
        toolScopeTitle: "Tool Scope",
        toolScopeDescription: "Limit which tools this Agent side can call. Unselected tools are not sent to the model.",
        resetDefault: "Reset Default",
        availableTools: "Available Tools",
        selectTool: "Select tools",
        loadingTools: "Loading tools",
        allTools: "All · {{count}}",
        selectedTools: "Selected {{count}}{{total}}",
        loadedSummary: "Network summary loaded · {{objectTypes}} object types / {{relations}} relation types",
        configTitle: "Chat Settings",
        clearTitle: "Clear conversation",
        clear: "Clear",
        cancel: "Cancel",
        confirm: "Confirm",
        modelConfigTitle: "Model Settings",
        modelConfigDescription: "Choose the model used for this chat.",
        modelLabel: "Model",
        selectModel: "Select model",
        promptTitle: "System Prompt",
        promptDescription: "Control the Agent identity, tool strategy, and response style.",
        paramsTitle: "Parameters",
        paramsDescription: "Limit tool steps, retained history, and output size to keep answers focused and bounded.",
      },
      empty: {
        noLlmTitle: "No LLM Available",
        noLlmDescription: "Agent chat needs an LLM. Connect one in Model Factory, set it as default, and come back.",
        goModelFactory: "Connect an LLM in Model Factory",
        start: "Start Validation",
        baseIntro: "Ask in natural language. The Agent can only answer by directly querying tables with base data tools: list_resources, describe_resource, and run_sql. It does not use knowledge-network semantics.",
        knIntro: "Ask the Agent in natural language. It will use retrieval tools and answer based on knowledge network {{knId}}{{networkName}}. {{summary}}",
        networkName: " ({{networkName}})",
        summary: "The network summary has been loaded automatically ({{objectTypes}} object types / {{relations}} relation types), so you do not need to browse first.",
      },
      message: {
        user: "Me",
        agent: "Agent",
      },
    },
  },
} as const;
