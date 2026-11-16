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
    missingClasses_one: "{{count}} event type has no event class yet: {{names}}.",
    missingClasses_other: "{{count}} event types have no event class yet: {{names}}.",
    createMissing: "Create event classes",
    createMissingDone: "Event classes created.",
    savedWithoutClass:
      "The event type was saved, but the platform did not create an event class: this platform version does not support event classes yet. Upgrade the platform.",
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
        "This knowledge network has versions. The event type and its rule checks take effect when saved; the event class goes into the draft and can be queried as objects once a version is published.",
      legacyRuleHint:
        "This event type has no rule tool, so the platform does not check it. Choose a rule tool and a schedule to have the platform check it.",
      name: "Name",
      namePlaceholder: "For example: overdue order",
      nameRequired: "Enter a name",
      code: "Code",
      codeHint:
        "Starts with a lowercase letter or digit and has only lowercase letters, digits, _, . and -. It cannot change after saving.",
      codeClassId: "The event class gets the ID {{id}}. It cannot change after saving.",
      codeRequired: "Enter a code",
      codeInvalid:
        "A code starts with a lowercase letter or digit, has only lowercase letters, digits, _, . and -, and is at most 64 characters long",
      source: "Source",
      sourceHint:
        "Rule hit: the platform calls the rule tool on schedule, one event for each object it finds. Reported: people report the events. It cannot change after saving.",
      subject: "About",
      subjectHint:
        "The object type the events are about. The platform relates the event class to it.",
      subjectRuleHint:
        "The key column of the rule tool is the primary key of this object type. The platform relates the event class to it.",
      subjectPlaceholder: "Choose an object type",
      subjectRequired: "Choose the object type the events are about",
      severity: "Default severity",
      severityPlaceholder: "None",
      mergeHours: "Merge window",
      mergeHoursHint:
        "A report about the same object within the window is a duplicate of the first event. 0 turns merging off.",
      ruleTool: "Rule tool",
      ruleToolHint:
        "A Cypher function of this network that returns a table: one row for each object the rule finds now, with the object's primary key in a key column and an optional name column. Its tool box must be published.",
      ruleToolPlaceholder: "Choose a rule tool",
      ruleToolRequired: "Choose a rule tool",
      ruleToolEmpty: "This network has no Cypher function to use as a rule yet",
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
      },
    },
    recognition: {
      title: "Recognition",
      edit: "Edit",
      checkNow: "Check now",
      managedNote:
        "This is an event class, kept by the platform's event module: its properties, data source and relation to the object type it is about come from the event type and cannot be changed here.",
      noRuleTool:
        "There is no rule tool yet, so the platform does not check this event type. Edit it and choose a rule tool to have it checked on schedule.",
      failures_one:
        "The last {{count}} check could not decide. If the account the checks run as lost its permission, someone with the permission needs to save the rule again.",
      failures_other:
        "The last {{count}} checks could not decide. If the account the checks run as lost its permission, someone with the permission needs to save the rule again.",
      code: "Code",
      source: "Source",
      subject: "About",
      severity: "Default severity",
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
      lastCheckOk_one: "OK, found {{count}} object",
      lastCheckOk_other: "OK, found {{count}} objects",
      lastCheckUnknown: "Could not decide: {{message}}",
      neverChecked: "Not checked yet",
      noMessage: "No reason given",
      checkDone_one: "Check done. Found {{count}} object.",
      checkDone_other: "Check done. Found {{count}} objects.",
      checkUnknown: "This check could not decide: {{message}}",
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
        'Deleting "{{name}}" also deletes its event type, event class, relation to the object type it is about, and dataset. An event type that has events cannot be deleted.',
      confirmVersioned:
        'Deleting "{{name}}" also deletes its event type. The event class and its relation are removed from the draft and go once a version is published. An event type that has events cannot be deleted.',
      refusedTitle: '"{{name}}" cannot be deleted',
      hasEvents: "This event type already has events, so it cannot be deleted.",
      inUse: "These definitions use the event class. Remove these references first:",
    },
  },
} as const;
