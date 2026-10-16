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
      soloEmptyTitle: "Start Validation",
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
      clear: "Clear",
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
      },
      error: {
        retry: "Retry Round",
        detail: "Details",
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
