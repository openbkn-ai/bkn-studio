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
      objectTypesMore_one: "Object type: {{names}} ({{count}} total)",
      objectTypesMore_other: "Object types: {{names}} ({{count}} total)",
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
      "Below is a JSON structure definition for a business model. name/comment describe business meaning, object_types are business entities, and relation_types are business relationships.\n" +
      "Write 3 questions that a real business user in this domain would ask. Requirements:\n" +
      "1. Only use business terms that appear in the JSON. Do not invent entities or concepts that are not present, because invented questions will not find data.\n" +
      "2. Do not mention technical terms such as object type, relation type, knowledge network, graph, schema, table, or field. Do not mention English JSON field names. Write like a business user.\n" +
      "3. Each question must be one sentence, no more than 25 Chinese characters or a similarly short English sentence, and answerable with data by querying, counting, or comparing. Do not ask open-ended subjective questions.\n" +
      "4. The 3 questions must cover different angles and must not be synonyms.\n" +
      'Only output a JSON array, for example ["question1","question2","question3"]. Do not output any other text or code fences.',
    profiles: {
      soloEmptyTitle: "Start Validation",
      knTitle: "Business Knowledge Network",
    },
    errors: {
      modelBusy: "The model service is busy. Try again later.",
      modelUnavailableSwitch:
        "The model service is busy. The upstream service suggests switching models temporarily.",
      modelRateLimited: "The model service is rate limited. Try again later.",
      modelServerError: "The model service returned an internal error. Try again later.",
      modelReturnedError: "The model service returned an error",
      authExpired: "Your login session has expired. Refresh the page and sign in again.",
      modelNotFound:
        "The model does not exist or is not online. Check the model configuration in Model Factory.",
      modelTemporaryUnavailable: "The model service is temporarily unavailable. Try again later.",
      requestFailedWithStatus: "Model service request failed (HTTP {{status}})",
      requestFailed: "Model service request failed",
      unparseableResponse:
        "The model service returned a response that could not be parsed. Try again later or contact an administrator.",
      connectionInterrupted: "The connection to the model service was interrupted. Try again.",
      chatFailed: "Chat execution failed",
    },
    managedTurns: {
      loadSummary: "Load knowledge network summary",
    },
    placeholders: {
      noLlm: "Connect an LLM in Model Factory before chatting.",
      askAgent: "Ask Agent, for example: {{suggestion}}",
    },
    composer: {
      stop: "Stop",
      send: "Send",
      settings: "Chat Settings",
      clear: "Clear",
    },
    chatPane: {
      defaultPrompt:
        "You are the BKN business knowledge network retrieval assistant. Answer user questions based on object types, relation types, and logical attributes in the current knowledge network.\n" +
        "Use the tools when you need data; do not fabricate answers. Establish the structure before fetching: when you are unsure which object types exist or what a field is called, look first with search_schema, " +
        "then filter on the field names it returns — guessing a field name by meaning tends to yield an empty result, and an empty result raises no error.\n" +
        "kn_id is locked to the current network. You do not need to change it and must not change it.\n" +
        "The retrieval tools are the main path. For what they cannot answer there are three supplements: run_sql for aggregation, sorting, and counting, so the database returns only the result; " +
        "run_code for a Python script that calls the tools above by name, suited to chaining several tools, branching on an intermediate result, or keeping bulk data in the sandbox when you only need a conclusion; " +
        "and run_shell for a shell command to inspect files in the sandbox. All three share one workspace scoped to the conversation, and files written there survive between executions, so a later script can pick up where an earlier one left off.\n" +
        "Query efficiently: use LIMIT and precise filters, return only needed fields, avoid loading entire tables or oversized results, and do not repeat queries for information already obtained.",
      evidenceHint: {
        kn: "which tool was called, what filter conditions were used, or the key SQL points",
      },
      fallbackSuggestions: {
        relations: "What object types and relations are in this knowledge network?",
        customers: "Find recently active high-value customers.",
        links: "How are the object types related?",
      },
      configFields: {
        maxSteps: {
          label: "Tool Step Limit",
          hint: "Maximum tool steps per round to prevent runaway calls",
        },
        keepToolResults: {
          label: "Retained Tool Results",
          hint: "Keep only the latest N full tool results between steps. 0 means no eviction",
        },
        dataToolCap: {
          label: "Data Result Limit (chars)",
          hint: "Character limit for run_sql / query_* results. 0 means no truncation",
        },
        schemaToolCap: {
          label: "Schema Result Limit (chars)",
          hint: "Character limit for get_kn_detail / search_schema and similar tools. 0 means no truncation",
        },
        maxHistoryMessages: {
          label: "History Messages",
          hint: "Only keep the latest N messages across rounds",
        },
        maxTurnChars: {
          label: "Per-Turn Text Limit (chars)",
          hint: "Maximum text length for each history message",
        },
        maxOutputTokens: {
          label: "Max Output Tokens",
          hint: "Maximum output per step including reasoning. Increase for reasoning models such as deepseek. 0 means model default",
        },
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
      toolGroup: {
        summary: "Called {{count}} tools",
        summary_one: "Called {{count}} tool",
        summary_other: "Called {{count}} tools",
        failed: "{{count}} failed",
        failed_one: "{{count}} failed",
        failed_other: "{{count}} failed",
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
        contextSection:
          "## Current Knowledge Network Summary (loaded automatically; call tools for full structure and instances as needed)\n{{context}}",
        historyTruncated: "{{content}}\n...[history truncated]",
      },
      model: {
        defaultSuffix: "{{modelName}} · Default",
      },
      settings: {
        promptPlaceholder: "System prompt. After saving, it will be sent with the conversation.",
        resetDefault: "Reset Default",
        configTitle: "Chat Settings",
        cancel: "Cancel",
        confirm: "Confirm",
        modelConfigTitle: "Model Settings",
        modelConfigDescription: "Choose the model used for this chat.",
        modelLabel: "Model",
        selectModel: "Select model",
        promptTitle: "System Prompt",
        promptDescription: "Control the Agent identity, tool strategy, and response style.",
        paramsTitle: "Parameters",
        paramsDescription:
          "Limit tool steps, retained history, and output size to keep answers focused and bounded.",
      },
      empty: {
        noLlmTitle: "No LLM Available",
        noLlmDescription:
          "Agent chat needs an LLM. Connect one in Model Factory, set it as default, and come back.",
        goModelFactory: "Connect an LLM in Model Factory",
        start: "Start Validation",
        knIntro:
          "Ask the Agent in natural language. It will use retrieval tools and answer based on knowledge network {{knId}}{{networkName}}. {{summary}}",
        networkName: " ({{networkName}})",
        summary:
          "The network summary has been loaded automatically ({{objectTypes}} object types / {{relations}} relation types), so you do not need to browse first.",
      },
      message: {
        user: "Me",
        agent: "Agent",
      },
    },
  },
} as const;
