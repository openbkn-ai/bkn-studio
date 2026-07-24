/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const dataConnectEnUS = {
  dataConnect: {
    title: "Data Connection",
    description:
      "Manage connector instances provided by the Vega backend within the BKN platform console.",
    createTitle: "Create Data Connection",
    editTitle: "Edit Data Connection",
    createDescription:
      "Select a connector type first, then complete the connection configuration.",
    editDescription:
      "Update the current data connection configuration. Connector type remains unchanged.",
    searchPlaceholder: "Search name/description",
    connectorTypeFilterPlaceholder: "Filter by connector type",
    toolbarHint:
      "This module is now using Vega backend catalogs and connector types as the first implementation slice.",
    empty: "No data connections",
    emptyDescription:
      "No data connection records are available yet. Use create to add the first connector instance.",
    detailTitle: "Connection Detail",
    name: "Connection Name",
    connectorType: "Connector Type",
    creator: "Created By",
    createTime: "Created At",
    updater: "Updated By",
    updateTime: "Updated At",
    tags: "Tags",
    connectorConfig: "Connector Configuration",
    noConnectorConfig: "No connector configuration available.",
    healthResult: "Health Check Result",
    testConnectionSuccess: "Connection test succeeded.",
    tagsPlaceholder: "Press Enter to add tags",
    connectorTypeStep: "Connector Type",
    configStep: "Configuration",
    connectorTypeStepTitle: "Select connector type",
    connectorTypeStepDescription:
      "Choose the backend connector type that matches the target data source.",
    connectorTypeSearchPlaceholder: "Search by connector name or type",
    connectorTypeEmpty: "No connector types match the current filters.",
    categoryAll: "All",
    selectConnectorTypeRequired: "Please select a connector type first.",
    configStepTitle: "Configure data connection",
    configStepDescription: "Fill in access parameters for the selected connector.",
    encryptedFieldEditHint: "Sensitive fields are not echoed. Re-enter them.",
    encryptedFieldPlaceholder: "Enter {{field}}",
    createFlowHint: "Saving validates parameters and tests the connection.",
    editFlowHint: "Connector type cannot change. Enable or disable from the list.",
    nameLengthLimit: "Connection name cannot exceed {{count}} characters.",
    descriptionLengthLimit: "Description cannot exceed {{count}} characters.",
    tagsMaxLength: "At most {{count}} tags are allowed.",
    tagLengthLimit: "Each tag cannot exceed {{count}} characters.",
    tagInvalidCharacters:
      'Tags cannot contain special characters such as / : ? \\ " < > | and similar symbols.',
    tagRequired: "Tags cannot be empty.",
    deleteConfirmTitle: "Delete data connection",
    deleteConfirmDescription:
      'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
    enableConfirmTitle: "Enable data connection",
    enableConfirmDescription: 'Enable "{{name}}"?',
    disableConfirmTitle: "Disable data connection",
    disableConfirmDescription:
      'Disable "{{name}}"? Discovery and data access for this connection will be unavailable.',
    dangerDelete: {
      hasRunning: "A build task is still running. Stop it before deleting.",
      catalogImpact: "Connection \"{{name}}\" has {{count}} index(es) built.",
      impactWarning:
        "Deleting will also remove all indexes and build tasks, and cannot be undone.",
      catalogEmpty:
        "Connection \"{{name}}\" has no built indexes. Deletion cannot be undone.",
    },
    discoverManage: "Discover",
    discoverTitle: "Discover Management",
    discoverDescription:
      "Manage scheduled discovery plans and review recent discover tasks for data connections.",
    discoverToolbarHint:
      "Schedules use Vega backend discover-schedules, and recent executions come from discover-tasks.",
    discoverAutoRefreshHint: "Active tasks are refreshing automatically.",
    discoverCurrentConnection: "Current connection",
    discoverScheduleEnableConfirmTitle: "Enable discover schedule",
    discoverScheduleEnableConfirmDescription: 'Enable schedule "{{name}}"?',
    discoverScheduleDisableConfirmTitle: "Disable discover schedule",
    discoverScheduleDisableConfirmDescription:
      'Disable schedule "{{name}}"? Automatic discovery will stop until it is enabled again.',
    backToConnections: "Back to Data Connections",
    discoverCreate: "New Discover Plan",
    discoverRunNow: "Discover Now",
    discoverRunSchedule: "Run Now",
    discoverViewTasks: "View Tasks",
    discoverTabSchedules: "Schedules",
    discoverTabTasks: "Tasks",
    discoverRunNowConfirmTitle: "Discover now",
    discoverRunNowConfirmDescription:
      'A manual discover task will be created for "{{name}}". Choose a discover strategy.',
    discoverStrategyHints: {
      full_sync: "Sync all resources, including new discovery and cleanup.",
      create_only: "Discover new resources only. Existing resources are kept.",
      cleanup_only: "Clean up stale resources only. No new discovery.",
    },
    discoverRunScheduleConfirmTitle: "Run now",
    discoverRunScheduleConfirmDescription:
      'Run schedule "{{name}}" now? A task will be created with this schedule strategy.',
    discoverCreateTitle: "Create Discover Plan",
    discoverEditTitle: "Edit Discover Plan",
    discoverEditHint:
      "Catalog and enabled status are managed separately. Use the table switch to enable or disable a schedule.",
    discoverSearchPlaceholder: "Search schedule name",
    discoverCatalog: "Data Connection",
    discoverCatalogFilterPlaceholder: "Filter by data connection",
    discoverStatusFilter: "Status",
    discoverScheduleName: "Schedule Name",
    discoverScheduleNamePlaceholder: "e.g. Daily full discovery",
    discoverScheduleConfig: "Schedule",
    discoverStrategy: "Discover Strategy",
    discoverCronExpr: "Cron",
    discoverCronExprPlaceholder: "Example: 0 2 * * * (min hour day month weekday)",
    discoverCronPresets: "Presets",
    discoverCronPresetLabels: {
      daily2am: "Daily 02:00",
      hourly: "Hourly",
      monday2am: "Monday 02:00",
    },
    discoverStartTime: "Start Time",
    discoverEndTime: "End Time",
    discoverNextRun: "Next Run",
    discoverLastRun: "Last Run",
    discoverTaskStatus: "Task Status",
    discoverTriggerType: "Trigger Type",
    discoverProgress: "Progress",
    discoverMessage: "Message",
    discoverFinishTime: "Finish Time",
    discoverScheduleTableTitle: "Discover Plans",
    discoverTaskTableTitle: "Recent Tasks",
    discoverSelectedSchedule: 'Current schedule filter: "{{name}}"',
    discoverClearSelection: "Clear Filter",
    discoverTaskAutoRefreshing: "Active tasks are auto-refreshing.",
    discoverScheduleEmpty: "No discover plans",
    discoverScheduleEmptyDescription:
      "Create the first discover plan for a data connection and then review task history here.",
    discoverTaskEmpty: "No discover tasks",
    discoverTaskEmptyDescription:
      "No recent discover tasks match the current filters yet.",
    discoverTaskEmptyByScheduleDescription:
      "No tasks are linked to this schedule. Manual discovery and run-now actions are not attached to a schedule. Clear the filter to see all tasks.",
    discoverDeleteConfirmTitle: "Delete discover plan",
    discoverDeleteConfirmDescription:
      'Are you sure you want to delete the discover plan "{{name}}"?',
    discoverTaskDeleteConfirmTitle: "Delete discover task",
    discoverTaskDeleteConfirmDescription:
      'Are you sure you want to delete the discover task "{{id}}"?',
    discoverTriggerSuccess: "Discover task created successfully.",
    discoverTaskDetailTitle: "Discover Task Detail",
    discoverManualTask: "Manual Trigger",
    discoverStrategies: {
      full_sync: "Full Sync",
      create_only: "Incremental Create",
      cleanup_only: "Cleanup Only",
    },
    discoverTaskStatuses: {
      pending: "Pending",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
    },
    discoverTriggerTypes: {
      manual: "Manual",
      scheduled: "Scheduled",
    },
    modes: {
      local: "Local",
      remote: "Remote",
    },
    categories: {
      table: "Relational Database",
      index: "Search Engine",
      topic: "Topic",
      file: "File",
      fileset: "Fileset",
      metric: "Metric",
      api: "API",
    },
    healthStatuses: {
      healthy: "Healthy",
      degraded: "Degraded",
      unhealthy: "Unhealthy",
      offline: "Offline",
      unchecked: "Unchecked",
    },
  },
} as const;
