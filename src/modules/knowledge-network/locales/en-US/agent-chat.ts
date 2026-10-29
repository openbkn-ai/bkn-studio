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
      soloEmptyTitle: "Start validation",
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
    execution: {
      errors: {
        modelUnavailable: "The model service is temporarily unavailable. Try again later.",
        modelRejected:
          "The model service rejected this request. Check the model configuration or context length.",
        withCause: "{{message}}: {{cause}}",
        failed: "Smart Q&A failed. Try again.",
        timeout: "Smart Q&A timed out. Narrow the question and try again.",
        unavailable: "A service Smart Q&A depends on is temporarily unavailable. Try again later.",
        forbidden: "Your account cannot use Smart Q&A or this knowledge network.",
        agentNotReady:
          "The Smart Q&A Agent is not published yet. Ask an administrator to configure and publish it.",
        threadBusy: "The previous turn is still running. Try again shortly.",
        network: "The connection to Smart Q&A was interrupted. Try again.",
      },
    },
    config: {
      title: "Q&A settings",
      sharedTitle: "Global agent",
      sharedDescription:
        "Maintained by platform administrators in Built-in agents and shared by every network. The current knowledge network and your preferences can only add to or narrow it.",
      model: "Model",
      defaultModel: "Platform default model",
      status: "Status",
      published: "Published",
      draft: "Not published",
      caps: "Execution caps",
      networkTitle: "Current knowledge network",
      networkDescription:
        "Applies to the current knowledge network for everyone. Use it for this network's terms, definitions, and caveats.",
      networkReadOnly:
        "Applies to the current knowledge network. You cannot modify this network, so it is read-only.",
      userTitle: "My preferences",
      userDescription:
        "Applies only to you, after the global Agent and current knowledge network settings.",
      instruction: "Additional instructions",
      instructionPlaceholder: "For example: lead with the conclusion, then list details in a table",
      tools: "Available tools",
      followUpper: "Follow the layer above",
      limits: "Execution limits",
      followCap: "Follows cap {{value}}",
      noCap: "No cap",
      save: "Save",
      reset: "Reset",
      saved: "Saved",
      resetDone: "Reset to defaults",
      serviceDefault: "Service default",
      capValue: "Cap {{value}}",
      customTools: "Custom",
      sharedPrompt: "Shared prompt",
      promptCurrent: "In use: v{{version}}",
      inUse: "In use",
      useThisVersion: "Use this version",
      rolledBack: "Version switched",
      publishPrompt: "Publish as new version",
      promptPublished: "New version published",
      sharedReadOnly: "Maintained by platform administrators in System Admin.",
      openSystemConfig: "Edit in system admin",
      mcpProfile: "MCP service",
      mcpDefault: "Service default",
      mcpFull: "Full",
      mcpCompact: "Compact",
      limitFields: {
        max_turns: { label: "Step cap", hint: "Most steps in one turn" },
        max_tool_calls: { label: "Tool call cap", hint: "Most tool calls in one turn" },
        timeout_s: { label: "Timeout (s)", hint: "Longest time one turn may run" },
        max_output_tokens: { label: "Output cap", hint: "Most tokens one model call may output" },
        keep_tool_results: {
          label: "Full results kept",
          hint: "Only the most recent tool results of this question reach the model in full; earlier ones become placeholders, and earlier questions keep only placeholders",
        },
        data_result_chars: {
          label: "Data result cap (chars)",
          hint: "Results of run_sql, query_*, run_cypher and similar are truncated beyond this, with a hint to narrow the query",
        },
        schema_result_chars: {
          label: "Schema result cap (chars)",
          hint: "Truncation length for get_kn_detail, search_schema and similar",
        },
        summarize_after_tokens: {
          label: "Summarize after (tokens)",
          hint: "Once the context passes this many tokens, older history is condensed into a summary",
        },
      },
    },
    managedTurns: {
      loadSummary: "Load knowledge network summary",
    },
    placeholders: {
      askAgent: "Ask agent, for example: {{suggestion}}",
    },
    composer: {
      stop: "Stop",
      send: "Send",
      settings: "Q&A settings",
      clear: "Clear",
      validationOnly: "Smart Q&A is for capability validation only, not for production use.",
    },
    chatPane: {
      fallbackSuggestions: {
        relations: "What object types and relations are in this knowledge network?",
        customers: "Find recently active high-value customers.",
        links: "How are the object types related?",
      },
      reasoning: {
        live: "Thinking",
        done: "Reasoning",
      },
      toolCall: {
        returnedError: "Returned an error",
        running: "Calling...",
        failed: "Failed",
        interrupted: "Interrupted before a result arrived",
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
        someFailed: "{{count}} failed",
        someFailed_one: "{{count}} failed",
        someFailed_other: "{{count}} failed",
      },
      error: {
        retry: "Retry round",
        detail: "Details",
      },
      empty: {
        start: "Start validation",
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
