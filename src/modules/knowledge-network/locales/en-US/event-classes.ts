/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const eventClassesPart = {
  eventClasses: {
    tag: "Event",
    tagManagedHint:
      "Event class: each object is one event, written by the platform's event module.",
    tagDeclaredHint:
      "Event class: a property declares the event time. Its data comes from the bound table and the platform only reads it.",
    create: "New event class",
    nav: "Event classes",
    description:
      "Review and maintain the event classes of the active knowledge network: where their events come from, what they are about, and the rules that recognize them.",
    unavailable: "This deployment does not support event classes.",
    openDefinition: "View in dynamic model",
    listSeparator: ", ",
    source: {
      rule: "Rule hit",
      report: "Reported",
    },
    errors: {
      existed:
        "The code is taken, or the network already has an object type with this name or ID. Use another code or name.",
    },
    form: {
      createTitle: "New event class",
      editTitle: "Edit event class",
      versionedHint:
        "This knowledge network has versions. The event class and its recognition action go into the draft and take effect once a version is published; the platform checks on schedule from then on.",
      legacyRuleHint:
        "This event class has no recognition action, so the platform does not check it. Set a schedule and a recognition rule to have the platform check it.",
      metricBasisHint:
        "This event class is recognized by a metric anomaly, which cannot be edited here. It is kept while no rule is set; setting a recognition rule here replaces it.",
      sectionBasics: "Basics",
      sectionRule: "Recognition rule",
      whenHint: "Each object the rule hits gets an event.",
      cypherReadOnly:
        "This rule is a Cypher query written directly. It is shown read-only here and kept as it is when you save. To change it, publish it as a function from the data query page and use the function instead.",
      newFunction: "New function",
      newFunctionHint:
        "Opens the data query page in a new tab: write the Cypher there and publish it as a function, then reload the list here to choose it.",
      editFunction: "Edit function",
      reloadFunctions: "Reload functions",
      saveFailed: "Could not save: {{message}}",
      sectionHandling: "Event handling",
      basisTabs: {
        condition: "Condition rule",
        cypher: "Cypher (read-only)",
        function: "Function rule",
      },
      ruleRequired: "Set a recognition rule",
      conditionHint:
        "Each object of the subject that meets the condition records one event. A value can be the check time or the check date, moved by an ISO 8601 duration.",
      conditionSubjectFirst:
        "Choose the object type the events are about before setting a condition",
      conditionIncomplete: "Choose a property and an operator for every condition",
      valueFromCheckTime: "Check time",
      valueFromCheckDate: "Check date",
      offset: "Offset",
      offsetHint:
        "An ISO 8601 duration: -PT48H is 48 hours earlier, -P1D the day before. Leave it empty for no offset.",
      offsetTimePlaceholder: "Offset, such as -PT48H",
      offsetDatePlaceholder: "Offset, such as -P1D",
      offsetInvalid:
        "An offset is an ISO 8601 duration such as -PT48H or -P1D; a check date moves by whole days only",
      parameterValue: "Value",
      trial: "Try",
      trialHint:
        "Runs the rule once now, as you, to see which objects it finds. No event is recorded.",
      trialResult_one: "{{count}} object found",
      trialResult_other: "{{count}} objects found",
      trialShown_one: "Only the first {{count}} is listed",
      trialShown_other: "Only the first {{count}} are listed",
      trialLimited: "The result was cut short; a check covers only the objects it kept.",
      trialRowFilter: "A row filter hides some objects from you; the trial does not include them.",
      trialStale: "The rule changed since this trial.",
      trialKey: "Key",
      trialName: "Name",
      trialFailed: "The trial failed: {{message}}",
      name: "Name",
      namePlaceholder: "For example: overdue order",
      nameRequired: "Enter a name",
      code: "Code",
      codeHint:
        "The ID of the event class. Starts with a lowercase letter or digit and has only lowercase letters, digits, _ and -. It cannot change after saving.",
      codeRequired: "Enter a code",
      codeInvalid:
        "A code starts with a lowercase letter or digit, has only lowercase letters, digits, _ and -, and is at most 64 characters long",
      source: "Source",
      sourceHint:
        "Rule hit: the platform checks the recognition rule on schedule and records one event for each object it finds. Reported: people report the events. It cannot change after saving.",
      subject: "About",
      subjectHint:
        "The object type the events are about. The platform relates the event class to it.",
      subjectRuleHint:
        "The recognition rule selects objects of this object type. The platform relates the event class to it.",
      subjectLockedHint:
        "The recognition action is bound to this object type. Delete the action before changing it.",
      handlingNote: "Handling note",
      handlingAction: "Handling action",
      handlingActionHint:
        "An action type on the subject. A recognition action, which records events, cannot be chosen.",
      handlingActionPlaceholder: "None: only the handling note",
      handlingActionEmpty: "The subject has no action types yet",
      handlingActionInputs_one: "asks for {{count}} input",
      handlingActionInputs_other: "asks for {{count}} inputs",
      handlingParameters: "Parameters",
      handlingParametersHint:
        "The inputs the action type asks for. Run automatically, each needs a value: a constant, or a property of the event's object. Suggested, the values are offered to the person handling the event and may be left blank.",
      handlingParameterFrom: "Where {{name}} comes from",
      handlingParameterValue: "Value of {{name}}",
      handlingParameterConst: "Constant",
      handlingParameterProperty: "Object property",
      handlingParameterPropertyPlaceholder: "Choose a property",
      handlingParameterValuePlaceholder: "Enter a value",
      handlingParameterTrue: "True",
      handlingParameterFalse: "False",
      handlingParameterRequired:
        "Nobody gives inputs when the action runs by itself: give {{name}} a value",
      handlingMode: "Handling",
      handlingModeAuto: "Run automatically",
      handlingModeSuggest: "Suggest only",
      handlingModeHint:
        "Run automatically: for each event a check newly finds (not a backlog), the platform runs the action once on the event's object as the recognition's execution subject. A governed action type is not started by the platform; the event is marked as needing a person. Suggest only: the person handling an event sees the suggestion and runs it.",
      handlingModeReportHint:
        "Reported events are not handled automatically; the action is suggested to whoever handles them.",
      handlingNotePlaceholder: "What to do about an event of this class",
      subjectPlaceholder: "Choose an object type",
      subjectRequired: "Choose the object type the events are about",
      severity: "Default severity",
      severityPlaceholder: "None",
      mergeHours: "Merge window",
      mergeHoursHint:
        "A report about the same object within the window is a duplicate of the first event. 0 turns merging off.",
      ruleTool: "Function",
      ruleToolHint:
        "A Cypher function of this network that returns a table: one row for each object the rule finds now, with the object's primary key in a key column and an optional name column. Its tool box must be published.",
      ruleToolPlaceholder: "Choose a Cypher function of this network",
      ruleToolRequired: "Choose a function",
      ruleToolEmpty: "This network has no Cypher function to use as a rule yet. Create one first.",
      ruleToolUnavailableGroup: "Saved (not available now)",
      parameters: "Parameters",
      parameterMode: "Value",
      parameterFixed: "Fixed value",
      parameterCheckDate: "Day of the check",
      parameterRequiredMark: "Required",
      parameterRequired: "Fill in the parameter {{name}}",
      schedule: "Check schedule",
      scheduleHint:
        "Checks are at least 5 minutes apart. Saving tries the rule once as you, and later checks read the data as you too.",
      scheduleKind: "Frequency",
      keptRate:
        "Checked at a fixed rate of every {{rate}}, which this form cannot edit. Leave the check time alone to keep it; change it to check at the new time instead.",
      cronInvalid: "A cron expression has 5 fields: minute, hour, day of month, month, day of week",
      savedWithTrial_one: "Saved. The trial found {{count}} object.",
      savedWithTrial_other: "Saved. The trial found {{count}} objects.",
      savedWithLimitedTrial_one: "Saved. The trial found {{count}} object (result truncated).",
      savedWithLimitedTrial_other: "Saved. The trial found {{count}} objects (result truncated).",
    },
    schedule: {
      kinds: {
        minutes: "Every few minutes",
        hours: "Every few hours",
        daily: "Daily",
        weekly: "Weekly",
        cron: "Cron expression",
      },
      minutesUnit: "min",
      hoursUnit: "h",
      weekday: "Day of week",
      time: "Time",
      timezone: "Time zone",
      weekdays: {
        "0": "Sunday",
        "1": "Monday",
        "2": "Tuesday",
        "3": "Wednesday",
        "4": "Thursday",
        "5": "Friday",
        "6": "Saturday",
      },
      describe: {
        minutes_one: "Every {{count}} minute",
        minutes_other: "Every {{count}} minutes",
        hours_one: "Every {{count}} hour",
        hours_other: "Every {{count}} hours",
        daily: "Daily at {{time}}",
        weekly: "Every {{weekday}} at {{time}}",
        cron: "Cron: {{cron}}",
        rate: "Every {{rate}}",
      },
    },
    recognition: {
      title: "Event settings",
      checkNow: "Check now",
      noRuleTool:
        "There is no recognition action yet, so the platform does not check this event class. Edit it and set a recognition rule to have it checked on schedule.",
      noAction: "This event class has no recognition action to check.",
      noSchedule:
        "The recognition action has no platform schedule yet. On a network with versions it gets one when a version is published; otherwise save it again and retry.",
      checkStarted: "The check has started. Its result shows under Last check once it finishes.",
      basis: "Selects by",
      bases: {
        condition: "Condition",
        cypher: "Cypher query",
        function: "Cypher function",
        metric: "Metric anomaly",
      },
      code: "Code",
      source: "Source",
      subject: "About",
      severity: "Default severity",
      handling: "Handling action",
      handlingModes: { auto: "runs automatically", suggest: "suggested" },
      handlingExecutions: "handling runs",
      handlingParameterConst: "the constant {{value}}",
      handlingParameterProperty: "the object's property {{property}}",
      executions: "Execution records",
      viewExecutions: "See the record of each check",
      mergeHours: "Merge window",
      mergeHoursValue_one: "{{count}} hour",
      mergeHoursValue_other: "{{count}} hours",
      mergeOff: "Off",
      ruleTool: "Rule tool",
      parameters: "Parameters",
      checkDate: "Day of the check",
      schedule: "Check schedule",
      subjectAccount: "Runs as",
      nextCheck: "Next check",
      lastCheck: "Last check",
      neverChecked: "Not checked yet",
    },
    list: {
      searchPlaceholder: "Search by name or code",
      empty: "No event classes yet",
      name: "Name",
      lastCheckFailed: "Unknown",
      lastCheckHits_one: "Found {{count}} object",
      lastCheckHits_other: "Found {{count}} objects",
      lastCheckNoHits: "No matches",
    },
    subject: {
      section: "Events",
      description:
        "Event classes about this object type. The platform writes the events that rules find or people report into the event class, and they can be queried along the relation.",
      empty: "No event class is about this object type yet",
      code: "Code",
      source: "Source",
      severity: "Severity",
      schedule: "Check schedule",
      nextCheck: "Next check",
    },
    delete: {
      title: "Delete event class",
      confirm:
        'Deleting "{{name}}" also deletes its recognition action. An event class that has events cannot be deleted.',
      confirmVersioned:
        'Deleting "{{name}}" also deletes its recognition action. Both are removed from the draft and go once a version is published. An event class that has events cannot be deleted.',
      refusedTitle: '"{{name}}" cannot be deleted',
      hasEvents: "This event class already has events, so it cannot be deleted.",
      recognizedByAction:
        "The event class still has a recognition action. Delete the action first, then the class.",
      inUse: "These definitions use the event class. Remove these references first:",
    },
  },
} as const;
