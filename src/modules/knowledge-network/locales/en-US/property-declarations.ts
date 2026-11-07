/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const propertyDeclarationsPart = {
  propertyDeclarations: {
    aliasProblem: {
      comma: "The alias “{{alias}}” cannot hold a comma",
      duplicate: "The alias “{{alias}}” appears twice",
      empty: "An alias cannot be empty",
      otherProperty:
        "The alias “{{alias}}” is the name or display name of the property {{property}}",
      ownName: "The alias “{{alias}}” is this property's name or display name",
      tooLong: "The alias “{{alias}}” is longer than {{max}} characters",
      tooMany: "At most {{max}} aliases",
    },
    aliases: "Aliases",
    aliasesHint:
      "At most {{max}}, each at most {{length}} characters, none the name or display name of a property of this object type.",
    aliasesPlaceholder: "Press Enter after each, or separate them with commas",
    cleared:
      "Changing the type to “{{type}}” cleared the declarations it does not take: {{names}}.",
    clearedByValueType:
      "The value type “{{valueType}}” now holds the rules, so the property's own {{names}} were cleared.",
    clearedName: {
      crs: "coordinate system",
      length: "length",
      pattern: "pattern",
      range: "range",
      semantic: "semantic",
      timezone: "time zone",
      unique: "unique",
      unit: "unit",
      valueType: "value type",
    },
    column: "Declarations",
    crs: "Coordinate system",
    crsNone: "Not declared",
    editProperty: "Edit {{property}}",
    enumItems: "Enum items",
    issue: {
      aliasTaken:
        "The alias “{{alias}}” of the property {{property}} is the name or display name of the property {{other}}",
      crsMismatch:
        "Latitude and longitude use different coordinate systems ({{latitude}} and {{longitude}}); make them the same",
      endTimeWithoutEventTime:
        "The property {{property}} declares an end time, which needs another property declaring the event time",
      latitudeWithoutLongitude:
        "The property {{property}} declares a latitude, which needs another property declaring the longitude",
      locationWithCoordinates:
        "A location and a latitude and longitude describe the same position; {{property}} and {{other}} cannot both declare one",
      longitudeWithoutLatitude:
        "The property {{property}} declares a longitude, which needs another property declaring the latitude",
      semanticTaken:
        "{{property}} and {{other}} both declare the semantic “{{semantic}}”; each semantic goes on one property",
    },
    issuesTitle: "Semantics and constraints need a change",
    note: "BKN 3.0 · for understanding and display; the source data is not checked",
    refusalProperty: "About the property {{property}}",
    refusalTitle: "The backend did not accept the property declarations: {{description}}",
    required: "Required",
    requiredLabel: "Every instance has a value",
    requiredPrimaryKey: "A primary key always has a value",
    semantic: "Semantic",
    semanticHint: "Semantics for “{{type}}”: {{values}}.",
    semanticNone: "Not declared",
    semanticNoneForType: "No semantic applies to the type “{{type}}”.",
    semanticTaken: "{{semantic}} (used by {{property}})",
    semanticValue: {
      end_time: "End time",
      event_time: "Event time",
      latitude: "Latitude",
      location: "Location",
      longitude: "Longitude",
      severity: "Severity",
      status: "Status",
      valid_from: "Valid from",
      valid_to: "Valid to",
    },
    tag: {
      aliases: "Aliases {{aliases}}",
      crs: "CRS {{crs}}",
      length: "Length {{range}}",
      moreAliases: "and {{count}} more",
      other: "{{key}}",
      pattern: "Pattern",
      range: "Range {{range}}",
      required: "Required",
      timezone: "Time zone {{timezone}}",
      unique: "Unique",
      unit: "Unit {{unit}}",
      valueType: "Value type {{name}}",
    },
    timezone: "Time zone",
    timezoneInvalid: "“{{value}}” is not an IANA time zone name such as Asia/Shanghai",
    timezonePlaceholder: "Such as Asia/Shanghai",
    title: "Semantics and constraints",
    undeclared: "Not declared",
    unique: "Unique",
    uniqueLabel: "No two instances share a value, primary key aside",
    valueType: "Value type",
    valueTypeCreate: "New value type",
    valueTypeMissing: "The value type {{id}} is not among this network's value types",
    valueTypeNone: "No value type",
    valueTypeNoneForType: "This network has no value type based on “{{type}}”.",
    valueTypeView: "View",
    valueTypesLoadFailed: "The value types could not be read, so none can be picked for now.",
  },
} as const;
