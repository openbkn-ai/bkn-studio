/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const dataCatalogEnUS = {
  dataCatalog: {
    title: "Data Catalog",
    description:
      "Browse and govern data resources. Filter by connection to inspect tables, views, and index status.",
    catalogDetailTitle: "Resources",
    resourceDetailTitle: "Resource Detail",
    resourceWorkspace: {
      currentResource: "Current Resource",
      tabDetail: "Detail",
      tabPreview: "Data Preview",
      tabIndex: "Data Index",
      tabSemanticUnderstanding: "Semantic Understanding",
      discardChangesTitle: "Discard unsaved changes?",
      discardChangesDescription: "Switching tabs will discard the current unsaved changes and cannot be undone.",
      discardChangesConfirm: "Discard and switch",
      discoveryFailedTitle: "The latest resource discovery failed",
      discoveryFailedNoSchemaDescription:
        "No usable field metadata is available. Refresh discovery before previewing, querying, or indexing this resource.",
      discoveryFailedStaleSchemaDescription:
        "The last successfully discovered fields are still available, but they may be out of date.",
      resourceMissingTitle: "Resource is missing from its source",
      resourceMissingDescription:
        "Discovery could not find this resource. Restore it at the source and run discovery again before querying or building an index.",
      resourceDisabledTitle: "Resource is disabled",
      resourceDisabledDescription:
        "This resource is disabled. Enable it before previewing, querying, or building an index.",
      resourceStaleTitle: "Resource is stale",
      resourceStaleDescription:
        "This resource is stale and cannot be previewed, queried, or indexed, even though field metadata remains.",
      metadataUnavailableTitle: "Resource metadata is not ready",
      metadataUnavailableDescription:
        "No usable field metadata is available. Add or refresh the resource fields before querying or building an index.",
      statusMessageDetail: "Status details: {{message}}",
      openDiscovery: "Open discovery",
    },
    indexWorkspace: {
      backToOverview: "Back to Tasks",
      configTabHint: "Choose how fields are indexed. Saving does not change the live index yet.",
      tasksTabHint: "Pick how to build and review history. Live status is at the top of this tab.",
      embeddingFields: "Embedding Fields",
      finishedAtShort: "Finished at {{time}}",
      fulltextFields: "Fulltext Fields",
      buildKeyFields: "Build Key Fields",
      indexedRowsShort: "{{count}} rows indexed",
      lastEventShort: "Last event {{time}}",
      startConfigure: "Configure Index",
      statusCardTitle: "Live Index Status",
      configStatusReady: "Index config saved. Start a build under Task Management.",
      configStatusIncomplete:
        "Only build-key fields are configured. Enable at least one embedding or full-text feature before building.",
      configStatusEmpty: "Not configured yet. Select field roles and save.",
      launchTitle: "Start a Build",
      launchHint: "Create and start a build using the resource's current index config.",
      goConfigure: "Configure Index",
      launchConfigTitle: "Current resource config",
      editConfigLink: "Edit",
      launchConfigSummary:
        "Embedding {{embedding}} · fulltext {{fulltext}} · build key {{buildKey}} · model {{model}} · analyzer {{analyzer}}",
      viewConfig: "Configure Index",
      viewTasks: "Index Tasks",
      embeddingModel: "Embedding Model",
      fulltextAnalyzer: "Analyzer",
    },
    indexBuildTitle: "Task Management",
    indexBuildDescription:
      "Manage data-resource tasks, including viewing, pausing, restarting, and deleting tasks.",
    taskManagement: {
      tabs: { indexBuild: "Index Build Tasks", discover: "Discover Tasks", semanticUnderstanding: "Semantic Understanding Tasks" },
      columns: { task: "Task ID", strategy: "Discover Strategy", trigger: "Trigger", scope: "Scope", applyMode: "Apply Mode", confidence: "Confidence", applied: "Applied" },
      scope: { catalog: "Data Connection", resource: "Data Resource" },
      applyMode: { dryRun: "Preview only", fillEmpty: "Fill empty fields", force: "Force overwrite" },
      applied: { applied: "Applied", notApplied: "Not applied" },
      moreFilters: "More filters",
      moreFiltersWithCount: "More filters ({{count}})",
      clearAdvancedFilters: "Clear more filters",
      semanticStatus: { pending: "Pending", running: "Running", succeeded: "Succeeded", failed: "Failed", cancelled: "Cancelled" },
      details: { taskInformation: "Task Information", scheduleId: "Schedule ID", startTime: "Started", message: "Message", agentId: "Agent ID", failureReason: "Failure Reason" },
      discover: { empty: "No discover tasks" },
      semantic: { empty: "No semantic-understanding tasks", deleteTitle: "Delete semantic-understanding task", deleteDescription: "Delete semantic-understanding task “{{id}}”?", detailSections: { task: "Task Information", execution: "Execution & Apply", quality: "Quality & Field Application", payload: "Input & Result", audit: "Audit Information" }, fields: { catalogId: "Catalog ID", resourceId: "Resource ID", agentTaskId: "Agent Task ID", confidenceThreshold: "Confidence Threshold", confidenceDetail: "Confidence Detail", appliedTime: "Applied At", applyDetail: "Apply Detail", inputHash: "Input Hash", input: "Input Snapshot", result: "Understanding Result", resourceEffective: "Resource Enhancement", fieldEffective: "Effective Field Enhancements", warnings: "Processing Notes", field: "Field", updated: "Updated Attributes", reason: "Reason" }, values: { effective: "Effective", notEffective: "No effective update", fieldEffective: "{{effective}} / {{total}} fields" }, fieldStatus: { updated: "Updated", partial: "Partially updated", unchanged: "Unchanged", skipped: "Skipped" } },
    },
    semanticWorkspace: { summary: "Semantic Understanding Result", applied: "Semantic results loaded", notApplied: "No semantic results loaded", processing: "Semantic understanding is in progress", create: "Create Task", createTitle: "Create Semantic Understanding Task", start: "Start", started: "Semantic understanding task started", empty: "No semantic-understanding tasks", confidenceThreshold: "Confidence threshold", includeSamples: "Include sample data", includeSamplesHint: "Sample data will be sent to the semantic-understanding service without masking." },
    emptyDescription:
      "Create and discover a connection first, then browse resources and build indexes here.",
    unauthorizedTitle: "No data has been granted to you",
    unauthorizedDescription:
      "Data catalogs and tables are visible only when granted explicitly. Ask an administrator to grant you access to the catalogs you need.",
    backToCatalog: "Back to Data Catalog",
    buildChip: "Building · {{count}}",
    format: {
      daysAgo: "{{count}}d ago",
      hoursAgo: "{{count}}h ago",
      hundredMillionRows: "{{count}} rows",
      justNow: "just now",
      minutesAgo: "{{count}}m ago",
      rows: "{{count}} rows",
      tenThousandRows: "{{count}} rows",
    },
    taskErrors: {
      dataTooLong: {
        title: "Build checkpoint write failed",
        syncedMarkMessage:
          "The sync checkpoint is longer than the task table column can store, so the backend could not update the task status.",
        columnMessage:
          "Column {{column}} received a value longer than the database column allows, so the task status update failed.",
        syncedMarkSuggestion:
          "Increase the task table f_synced_mark column length, or shorten the connector checkpoint before rebuilding.",
        columnSuggestion: "Check and increase the column length, then rebuild.",
      },
      duplicateEntry: {
        title: "Task state write conflict",
        message: "The backend hit a unique-key conflict while writing task state.",
        suggestion:
          "Refresh the task list and remove the conflicting task before retrying if needed.",
      },
      missingDocumentId: {
        title: "Index documents are missing IDs",
        message: "Index write failed because some documents did not include a stable id field.",
        suggestion:
          "Check the resource build key or primary-key mapping, save the index configuration, then rebuild.",
      },
      unknown: {
        title: "Build task failed",
        message: "The backend returned an uncategorized error. See the raw error for details.",
      },
    },
    kind: {
      physical: "Physical Data Source",
      logical: "Logical Group",
    },
    categories: {
      table: "Table",
      logicview: "Logic View",
      dataset: "Dataset",
    },
    modes: {
      batch: "Batch",
      streaming: "Streaming",
    },
    form: {
      required: "Required",
      optional: "Optional",
    },
    indexState: {
      none: "Not Built",
      building: "Building",
      rebuilding: "Rebuilding",
      listening: "Listening",
      paused: "Paused",
      built: "Built",
      failed: "Build Failed",
      rebuildFailed: "Rebuild Failed",
      staleServing: "Serving Stale Index",
    },
    progress: {
      synced: "Synced {{synced}} / {{total}}",
      syncedRows: "{{count}} rows synced",
      lastEvent: "Last event {{time}}",
    },
    tree: {
      searchPlaceholder: "Search connections / resources",
      newConnection: "New Connection",
      physicalGroup: "Physical Data Source",
      logicalGroup: "Logical Group",
      builtin: "Built-in",
      addLogical: "Add logical group",
      addLogicalTitle: "Add Logical Group",
      logicalName: "Name",
      logicalNamePlaceholder: "e.g. team_analytics",
      logicalDescriptionPlaceholder: "Optional description",
      deleteLogicalTitle: "Delete logical group",
      deleteLogicalDescription:
        'Delete logical group "{{name}}"? This removes {{resources}} resources and cancels {{semanticTasks}} pending semantic tasks.',
      deleteLogicalBlockedTitle: "Logical group cannot be deleted",
      deleteLogicalBlockedDescription:
        "Resolve the following blockers before trying again:",
      deleteLogicalBlockers: {
        protected_resources: "{{count}} protected resources",
        build_tasks_running_or_stopping: "{{count}} running or stopping build tasks",
        discover_tasks_running: "{{count}} running discover tasks",
        semantic_understanding_tasks_running: "{{count}} running semantic tasks",
      },
      discovering: "Discovering",
      emptyPhysicalGroup: "No physical data source connections",
      emptyLogicalGroup: "No logical groups yet. Use + to add one.",
      empty: "No data connections yet",
      noMatch: "No matching connections",
      summary: "{{catalogCount}} connections · {{resourceCount}} resources",
      expand: "Expand",
      collapse: "Collapse",
    },
    catalog: {
      notFound: "No resources found for this connection; it may have been deleted",
      selectPhysicalDescription: "Select a data connection from the physical data source tree.",
      resourceSection: "Resources",
      goConnection: "Data Connection",
      goScan: "Discover Tasks",
      goDiscoverToDiscover: "Discover resources",
      emptyResourcesPhysical:
        "No resources yet. Run discovery from Data Connection to discover resources from the source.",
      emptyResourcesLogical: "No resources yet",
    },
    resource: {
      name: "Resource Name",
      basicName: "Resource",
      headerIndexState: "Index State",
      headerCatalog: "Catalog",
      schemaSection: "Field Info",
      schemaEmpty: "No schema fields",
      historyTasks: "Build History",
      historyEmpty: "No build tasks yet",
      namePlaceholder: "e.g. customers",
      catalog: "Catalog",
      catalogPlaceholder: "Select a catalog",
      category: "Category",
      discoverStatus: "Discovery Status",
      rowCount: "Rows",
      indexState: "Index State",
      searchPlaceholder: "Search resource name",
      noMatch: "No resources match the current filters",
      fieldCount: "Fields",
      create: "New Resource",
      createTitle: "New Data Resource",
      created: "Resource created: {{name}}",
      description: "Description",
      sourceIdentifier: "source_identifier",
      sourceIdentifierPlaceholder: "e.g. crm_core.customers or a SQL statement",
      sourceIdentifierHint:
        "Table name / view definition in the source; resources found by discover fill this automatically.",
      schemaDefinition: "Schema Definition",
      schemaHint:
        "One field per line: name type. Leave empty to use the default schema (id / name / updated_at); discover can complete it later.",
      fieldName: "Field Name",
      fieldDisplayName: "Business Name",
      fieldDescription: "Description",
      fieldType: "Type",
      editFields: "Edit",
      editHint: "You can edit the resource description, business name, and field description here.",
      fieldEditableHint: "Business name and description can be edited inline.",
      modifiedCount: "{{count}} field(s) modified",
      restoreAll: "Restore All",
      effectiveVersion: "Effective Version",
      effectiveActive: "Active",
      latestTask: "Latest Build Task",
      noEffectiveIndex:
        "No effective index yet - once a build succeeds, vector retrieval becomes available.",
      noIndexHint:
        "This resource has no index yet. Build one to enable vector retrieval in knowledge networks.",
      rebuildFailedTitle:
        "Rebuild failed. Retrieval is unaffected and still served by index {{version}}.",
      rebuildFailedHint:
        "Rebuild failed: {{error}}. Retrieval is unaffected and still served by index {{version}}.",
      notFound: "Resource not found; it may have been deleted",
    },
    actions: {
      preview: "Preview Data",
      previewMissingHint:
        "The source resource is missing. Restore it and run discovery again before previewing.",
      previewDisabledHint: "This resource is disabled. Enable it before previewing.",
      previewStaleHint: "This resource is stale and cannot be previewed.",
      previewMetadataUnavailableHint:
        "This resource has no usable field metadata and cannot be previewed yet.",
      indexMissingHint:
        "The source resource is missing. Restore it and run discovery again before building an index.",
      indexDisabledHint: "This resource is disabled. Enable it before building an index.",
      indexStaleHint: "This resource is stale and cannot be indexed.",
      indexMetadataUnavailableHint:
        "This resource has no usable field metadata and cannot be indexed yet.",
      dataIndex: "Data Index",
      more: "More actions",
    },
    discoverStatuses: {
      error: "Failed",
      missing: "Missing",
      new: "New",
      restored: "Restored",
      unchanged: "Unchanged",
      updated: "Updated",
    },
    gate: {
      catalogDisabled:
        "Connection \"{{name}}\" is disabled; preview and build are unavailable.",
      catalogDisabledShort: "Connection disabled",
      goEnable: "Open connections",
    },
    preview: {
      summary: "Showing {{count}} rows · {{total}} rows total",
      empty: "No data",
      metadataDiscoveryFailed: "Resource metadata discovery failed",
      metadataDiscoveryFailedDescription:
        "Preview is unavailable because no field metadata was discovered. Refresh discovery and try again.",
      metadataUnavailable: "Resource metadata is not ready",
      metadataUnavailableDescription:
        "Preview is unavailable until resource fields have been added or refreshed.",
      resourceMissing: "Source resource is missing",
      resourceMissingDescription:
        "This resource can no longer be found at its source. Restore it and run discovery again before previewing.",
      resourceDisabled: "Resource is disabled",
      resourceDisabledDescription:
        "This resource is disabled. Enable it before previewing data.",
      resourceStale: "Resource is stale",
      resourceStaleDescription:
        "This resource is stale and cannot be previewed, even though field metadata remains.",
      mockLongText:
        "This is the long text content in row {{row}}, used to verify truncation and hover display.",
    },
    build: {
      submit: "Start Build",
      startBuild: "Start Build",
      saveConfig: "Save Config",
      saveIndexConfig: "Save Index Config",
      saveConfigSuccess: "Index config saved",
      unsavedIndexConfig:
        "Index config has unsaved changes. Save it before starting a build.",
      needConfigFirst: "Complete the configuration under Configure Index before starting a build.",
      editTitle: "Configure Index",
      editSubmit: "Start Build",
      editConfirmTitle: "Start a new build?",
      editConfirmContent:
        "A new build task will use the resource's current config. The previous index keeps serving search until the new build succeeds (when still usable).",
      editConfirmOk: "Start Build",
      edited: "A new build task was created",
      streamingActiveLocked:
        "A streaming task is still running or listening. Pause/stop it before changing config or creating a new streaming build.",
      streamingRecreateHint:
        "Streaming tasks cannot be edited in place. Save resource config first, then create a new streaming build under Task Management.",
      activeTaskLocked:
        "This resource already has an active build task. Wait for it to finish or stop it before saving config or starting a new build.",
      configConflict:
        "An active build task blocks index config updates. Stop the task, then save again.",
      startRejected:
        "Could not start this task (config may have changed, or a newer successful build exists). Save the latest config under Configure Index, then create a new build.",
      created: "Build task created: {{id}}",
      conflict:
        "This resource already has an active build task; wait for it or pause listening first.",
      resource: "Resource",
      resourceHint:
        "Configure how fields are indexed under Configure Index; run builds under Task Management.",
      mode: "Build Mode",
      batchLabel: "Batch",
      batchDescription: "One-shot sync and indexing.",
      streamingLabel: "Streaming",
      streamingDescription:
        "Continuous incremental sync with a standing listener; a build key is required.",
      executeType: "Execution",
      executeFull: "Full",
      executeFullDescription: "Sync all rows from the source and rebuild the index. Use it for first builds or full refreshes.",
      executeIncremental: "Incremental",
      executeIncrementalDescription: "Continue from the build-key checkpoint and process only new or changed rows.",
      schemaLoading: "Loading fields...",
      schemaEmpty: "This resource has no fields yet; run a discover to discover its schema.",
      fulltextTypeHint: "Text-type fields only",
      fieldRole: "Field Roles",
      fieldRoleHint:
        "Check each field's role in the index; multiple allowed. Select embedding and/or full-text.",
      roleEmbedding: "Embedding",
      roleBuildKey: "Build key",
      roleFulltext: "Full-text search",
      roleEmbeddingHint:
        "Fields vectorized by the embedding model for semantic search; can be used with or without full-text.",
      roleBuildKeyHintBatch:
        "Field used to detect incremental data in batch builds (e.g. updated_at, auto-increment ID); required.",
      roleBuildKeyHintStreaming: "Row ID field for streaming builds; required.",
      roleBuildKeyHintConfig:
        "Used for incremental builds; required for both batch and streaming. Supported types are integer, unsigned integer, string, date, datetime, and timestamp.",
      buildKeyTypeHint: "Build keys support integer, unsigned integer, string, date, datetime, and timestamp fields only.",
      invalidBuildKeyFields: "Invalid build-key configuration: {{fields}}. Select schema fields with supported types.",
      removeInvalidBuildKeyFields: "Remove invalid build keys",
      unsupportedSchemaFields: "This resource contains other-type fields unsupported for index builds: {{fields}}. Correct the source field type or its discovery mapping before building.",
      roleFulltextHint:
        "Text fields indexed for keyword full-text search; applied immediately during data sync.",
      selectAll: "Select all",
      clearAll: "Clear",
      fieldCount: "{{count}} fields",
      fieldFilterPlaceholder: "Filter field name...",
      fieldNoMatch: "No fields match {{keyword}}",
      fulltextAnalyzer: "Analyzer",
      defaultFulltextAnalyzer: "Default Analyzer",
      defaultEmbeddingModel: "Default Embedding Model",
      defaultAnalyzerRequired:
        "Full-text fields are selected; set the resource default analyzer.",
      configCanBuild: "Buildable",
      configCanBuildYes: "Ready",
      configCannotBuild: "Missing features",
      resourceDefaultsTitle: "Resource Defaults",
      resourceDefaultsHint:
        "Features use these defaults when no override is selected.",
      fulltextAnalyzerOverrides:
        "Field analyzers override the default: {{overrides}}. Update them in Field Feature Config or choose Use default.",
      fieldEmbeddingModel: "Embedding Model",
      fieldFulltextAnalyzer: "Analyzer",
      inheritDefaultAnalyzer: "Use default",
      inheritDefaultModel: "Use default",
      featureConfig: "Feature Config",
      addFeature: "Add Feature",
      featureModelSelect: "Select model",
      featureAnalyzerSelect: "Select analyzer",
      featureNameLabel: "Feature name",
      featureDescriptionLabel: "Description",
      featureNamePlaceholder: "Feature name",
      featureDescriptionPlaceholder: "Feature description",
      defaultFeature: "Default",
      featureGroupHint: "One feature of each type is supported per field.",
      featureEnableHint: "Enable to create the feature for this field.",
      featureEmpty: "No {{feature}} configured",
      featureNotEnabled: "Off",
      featureConfiguredCount: "Configured",
      removeFeatureType: "Remove Type",
      duplicateFeatureTypeUnsupported:
        "Only one feature of each type is supported per field. Remove duplicate features: {{features}}.",
      featureSummaryEmpty: "No features",
      featureUnsupported: "Unsupported",
      defaultModelDimensions: "Default dimensions: {{dimensions}}",
      fulltextAnalyzerHint:
        "Available options come from the current environment. standard is for English / general text; if available, english performs English stemming.",
      fulltextChineseAnalyzerAvailableHint:
        "Chinese-text analyzer enabled in this environment: {{analyzers}}.",
      fulltextChineseAnalyzerUnavailableHint:
        "No Chinese analyzer such as IK/HanLP is enabled in this environment. standard and english do not provide Chinese word segmentation, so Chinese search recall and relevance may be limited. Ask an administrator to enable a Chinese analyzer.",
      analyzerSelectionUnavailable: "Analyzer capabilities are unavailable.",
      analyzers: {
        standard: "standard · English / general",
        english: "english · English stemming",
        ik_max_word: "ik_max_word · Chinese fine-grained",
        hanlp_index: "hanlp_index · Chinese HanLP",
      },
      analyzersLoading: "Loading full-text analyzer capabilities…",
      analyzersLoadError: "Unable to load full-text analyzer capabilities: {{message}}",
      analyzersLoadErrorFallback: "Please retry or check the index service.",
      retryLoadAnalyzers: "Retry",
      noAnalyzers: "No full-text analyzers are available; index configuration cannot be saved.",
      savedAnalyzerUnavailable: "Saved analyzer configuration is unavailable: {{analyzers}}. Choose an available analyzer to continue.",
      fieldsRequired: "Select at least one embedding or full-text field.",
      buildKeyRequired:
        "Batch mode requires a build-key field. Select one under Configure Index.",
      streamingBuildKeyRequired:
        "Streaming builds require a build-key field. Select one under Configure Index before creating the task.",
      model: "Embedding Model",
      modelRequired: "Select an embedding model.",
      noModels:
        "No embedding models connected; cannot save a config that includes embedding fields.",
      goConnectModel: "Connect a model",
      modelsLoading: "Loading embedding models…",
      modelsLoadError: "Failed to load embedding models: {{message}}",
      modelsLoadErrorFallback: "Retry later or check model management service",
      retryLoadModels: "Retry",
      savedModelUnavailable:
        'Saved embedding model "{{model}}" is not registered in this environment. Select a connected model.',
      dimensions: "Vector Dimensions",
      dimensionsHint:
        "(preview from model; server writes actual dimensions when the build runs)",
    },
    task: {
      column: "Task",
      createTime: "Created",
      indexColumn: "Index",
      detail: "Task Detail",
      rawError: "Raw error",
      modalTitle: "Build Task",
      progress: "Progress",
      statusFilterPlaceholder: "All statuses",
      empty: "No index tasks",
      emptyDescription:
        "No tasks match the current filters. Configure and submit a build from a resource's Data Index tab in Data Catalog.",
      pauseListening: "Pause Listening",
      resumeListening: "Resume Listening",
      paused: "Listening paused",
      resumed: "Listening resumed",
      stopBuild: "Stop Build",
      resumeBuild: "Resume Build",
      stopped: "Build stopped",
      buildResumed: "Build resumed",
      rebuild: "Rebuild",
      rebuildIncremental: "Incremental (resume from cursor)",
      rebuildFull: "Full (reset cursor, resync all)",
      rerun: "Rerun",
      rerunConfirmTitle: "Rerun build task",
      rerunResume: "Resume from the checkpoint",
      rerunReset: "Restart from the beginning",
      rebuildFullConfirmTitle: "Full reset this task?",
      rebuildFullConfirmContent:
        "This starts the task with reset=true (ignore cursor). If resource index config drifted relative to this task, start may be rejected — create a new build instead.",
      retried: "Build task resubmitted: {{id}}",
      startRejected:
        "Could not start this task (config may have changed, or a newer successful build exists). Open Data Index, save config, and create a new build.",
      deleteConfirmTitle: "Delete build task {{id}}?",
      deleteConfirmContent: "The task record cannot be recovered after deletion.",
      deleteConfirmContentActive:
        "The task is still running and will be stopped before deletion; the record cannot be recovered.",
      batchDelete: "Batch Delete",
      batchDeleteConfirmTitle: "Delete {{count}} build task(s)",
      batchDeleteConfirmContent:
        "Deleted task records cannot be recovered; running tasks are stopped before deletion.",
      batchDeletePartial: "{{failed}}/{{total}} task(s) failed to delete",
      model: "Model",
      finishedAt: "Finished At",
      fields: {
        resourceId: "Resource ID",
        embeddingFields: "Embedding fields",
        buildKeyFields: "Build key fields",
        fulltextFields: "Fulltext fields",
        fulltextAnalyzer: "Fulltext analyzer",
        embeddingModel: "Embedding model",
        modelDimensions: "Model dimensions",
        embeddingConfig: "Embedding configuration",
        creator: "Created by",
        syncedMark: "Sync checkpoint",
        totalCount: "Total rows",
        startTime: "Started at",
        lastProgressTime: "Last progress update",
      },
      statuses: {
        pending: "Pending",
        running: "Building",
        stopping: "Stopping",
        listening: "Listening",
        paused: "Paused",
        stopped: "Stopped",
        succeeded: "Succeeded",
        failed: "Failed",
        cancelled: "Cancelled",
      },
    },
  },
} as const;
