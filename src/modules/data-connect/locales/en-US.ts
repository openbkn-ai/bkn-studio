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
    searchPlaceholder: "Search by connection name or description",
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
    configStepDescription:
      "Fill in the connector configuration fields returned by the backend model.",
    encryptedFieldEditHint:
      "Sensitive fields are not returned by the backend. Re-enter them when editing.",
    createFlowHint:
      "Creating a connection will trigger backend-side validation and connection testing during save.",
    editFlowHint:
      "Editing keeps the connector type unchanged. Use enable/disable in the list page to change status.",
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
    scanManage: "Scan Management",
    scanTitle: "Scan Management",
    scanDescription:
      "Manage scheduled scans and review recent discover tasks for data connections.",
    scanToolbarHint:
      "Schedules use Vega backend discover-schedules, and recent executions come from discover-tasks.",
    scanAutoRefreshHint:
      "Active scan tasks are being refreshed automatically every few seconds.",
    backToConnections: "Back to Data Connections",
    scanCreate: "New Scan Plan",
    scanRunNow: "Run Now",
    scanCreateTitle: "Create Scan Plan",
    scanEditTitle: "Edit Scan Plan",
    scanEditHint:
      "Catalog and enabled status are managed separately. Use the table switch to enable or disable a schedule.",
    scanSearchPlaceholder: "Search by schedule name",
    scanCatalog: "Data Connection",
    scanCatalogFilterPlaceholder: "Filter by data connection",
    scanScheduleName: "Schedule Name",
    scanStrategy: "Scan Strategy",
    scanCronExpr: "Cron Expression",
    scanCronExprPlaceholder: "Example: 0 0 2 * * *",
    scanStartTime: "Start Time",
    scanEndTime: "End Time",
    scanNextRun: "Next Run",
    scanLastRun: "Last Run",
    scanTaskStatus: "Task Status",
    scanTriggerType: "Trigger Type",
    scanProgress: "Progress",
    scanMessage: "Message",
    scanFinishTime: "Finish Time",
    scanScheduleTableTitle: "Scan Plans",
    scanTaskTableTitle: "Recent Tasks",
    scanSelectedSchedule: 'Current schedule filter: "{{name}}"',
    scanClearSelection: "Clear Filter",
    scanTaskAutoRefreshing: "Active tasks are auto-refreshing.",
    scanScheduleEmpty: "No scan plans",
    scanScheduleEmptyDescription:
      "Create the first scan plan for a data connection and then review task history here.",
    scanTaskEmpty: "No scan tasks",
    scanTaskEmptyDescription:
      "No recent discover tasks match the current filters yet.",
    scanDeleteConfirmTitle: "Delete scan plan",
    scanDeleteConfirmDescription:
      'Are you sure you want to delete the scan plan "{{name}}"?',
    scanTaskDeleteConfirmTitle: "Delete scan task",
    scanTaskDeleteConfirmDescription:
      'Are you sure you want to delete the scan task "{{id}}"?',
    scanTriggerSuccess: "Scan task created successfully.",
    scanTaskDetailTitle: "Scan Task Detail",
    scanManualTask: "Manual Trigger",
    scanStrategies: {
      full_sync: "Full Sync",
      create_only: "Incremental Create",
      cleanup_only: "Cleanup Only",
    },
    scanTaskStatuses: {
      pending: "Pending",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
    },
    scanTriggerTypes: {
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
