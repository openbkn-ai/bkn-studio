/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const bknProjectEnUS = {
  bknProject: {
    title: "Projects",
    description:
      "Each project brings requirements, ontology and releases together for one business knowledge network.",
    list: {
      cardTitle: "Projects",
      cardTip:
        "Several projects may change one knowledge network; publishing checks whether another project has changed its live version.",
      searchPlaceholder: "Search project names",
      showArchived: "Show archived",
      create: "New project",
      refresh: "Refresh",
      total: "{{count}} in total",
      total_one: "{{count}} in total",
      total_other: "{{count}} in total",
      prevPage: "Previous",
      nextPage: "Next",
      loadFailed: "Failed to load projects",
      emptyTitle: "No projects yet",
      emptyDescription:
        "Create a project to build a business knowledge network from structured data.",
      emptyFiltered: "No matching projects",
      columns: {
        project: "Project",
        network: "Target knowledge network",
        catalogs: "Data catalogs",
        owner: "Owner",
        updated: "Updated",
        actions: "Actions",
      },
      sameNetwork: "Same network · {{count}} other projects",
      sameNetwork_one: "Same network · {{count}} other project",
      sameNetwork_other: "Same network · {{count}} other projects",
      archivedTag: "Archived",
      ownerYou: "You",
      archive: "Archive",
      unarchive: "Restore",
      archiveConfirm: {
        title: 'Archive project "{{name}}"?',
        content:
          "Archived projects are hidden from the default list. Published versions are not affected, and you can restore the project at any time.",
        ok: "Archive",
      },
      archiveSuccess: "Archived",
      unarchiveSuccess: "Restored",
      archiveFailed: "Operation failed",
    },
    create: {
      title: "New project",
      submit: "Create",
      success: "Project created",
      failed: "Failed to create the project",
      name: "Project name",
      namePlaceholder: "For example: Delivery delay warning",
      nameRequired: "Enter a project name",
      nameTooLong: "The project name must be at most {{max}} characters",
      target: "Target knowledge network",
      existing: "Use an existing network",
      existingDescription: "Revise an existing network; the baseline is its live version",
      networkPlaceholder: "Select a knowledge network",
      networkRequired: "Select a knowledge network",
      networksLoadFailed: "Failed to load knowledge networks",
      newNetwork: "New knowledge network",
      newNetworkDescription: "Start from an empty network; the first release is v1.0.0",
      newNetworkName: "Network name",
      newNetworkNamePlaceholder: "For example: Delivery management",
      newNetworkNameRequired: "Enter a network name",
      catalogs: "Data sources",
      catalogsHint:
        "Select the data catalogs that hold the structured data; the project references them and copies nothing.",
      catalogsPlaceholder: "Select data catalogs",
      catalogsLoadFailed: "Failed to load data catalogs",
    },
    workspace: {
      title: "Project workspace",
      description: "Requirements, ontology and releases of a project.",
      navLabel: "Project navigation",
      groupBuild: "Build",
      groupRelease: "Release and run",
      sections: {
        overview: "Overview",
        requirements: "Requirements",
        model: "Ontology modeling",
        instances: "Knowledge base build",
        release: "Releases",
        builds: "Build tasks",
      },
      backToList: "Back to projects",
      targetNetwork: "Target network {{name}}",
      live: "Live v{{version}}",
      unpublished: "Not published yet",
      notFound: "Project not found",
      notFoundDescription: "The project does not exist, or you cannot see its knowledge network.",
      loadFailed: "Failed to load the project",
      comingSoon: "This page is under construction",
      comingSoonDescription: "A later version brings the full feature here.",
    },
    model: {
      status: {
        ready: "Draft",
        drafting: "Drafting",
        failed: "Drafting failed",
      },
      summary:
        "Drafted from the tables of the project's data catalogs: {{objects}} object types, {{relations}} relation types.",
      pending: "{{count}} items wait for you",
      pending_one: "{{count}} item waits for you",
      pending_other: "{{count}} items wait for you",
      generate: "Draft from tables",
      regenerate: "Draft again",
      generateFailed: "Failed to start drafting",
      loadFailed: "Failed to load the draft",
      regenerateConfirm: {
        title: "Draft again?",
        content:
          "Drafting again replaces this draft and discards the {{count}} decisions made on it.",
        content_one:
          "Drafting again replaces this draft and discards the {{count}} decision made on it.",
        content_other:
          "Drafting again replaces this draft and discards the {{count}} decisions made on it.",
        contentUncounted:
          "Drafting again replaces this draft and discards every decision made on it.",
        ok: "Discard and draft again",
      },
      adoptBlocked: {
        needsIdentity: "Choose its identity before adopting it",
        endsNotAdopted: "Adopt the object types it connects before adopting it",
        archived: "The project is archived and cannot be changed",
      },
      catalogs: {
        change: "Change data catalogs",
        choose: "Choose data catalogs",
        title: "The project's data catalogs",
        label: "Data catalogs",
        hint: "AI drafts the ontology from the tables in these catalogs. Changing them keeps the current draft; the new catalogs are read when you draft again.",
        removed:
          "Data catalogs {{names}} no longer exist or you cannot see them; saving removes them from the project.",
        loadFailed: "The data catalogs could not be listed, so they cannot be changed for now.",
        saved: "Data catalogs changed. Drafting reads the new catalogs.",
      },
      actions: {
        adoptItem: "Adopt {{name}}",
        edit: "Edit {{name}}",
      },
      edit: {
        title: "Edit {{name}}",
        name: "Name",
        nameRequired: "Enter a name",
        description: "Description",
        stale:
          "Someone changed this draft, so it was reloaded. Make your change again if it is still needed.",
        cascade: "Also stopped adopting {{count}} relation types that connect it",
        cascade_one: "Also stopped adopting {{count}} relation type that connects it",
        cascade_other: "Also stopped adopting {{count}} relation types that connect it",
      },
      empty: {
        title: "No ontology draft yet",
        description:
          "AI drafts object types, relation types and value types from the structure of the tables; nothing is adopted until you confirm the draft.",
        noCatalogs:
          "The project has no data catalogs; select the catalogs that hold its structured data first.",
        noCatalogsAskOwner:
          "The project has no data catalogs yet. Ask the project owner to choose them.",
      },
      drafting: {
        title: "AI is drafting the ontology from the table structure",
        description: "This page refreshes by itself; you may leave it and come back.",
      },
      failed: {
        title: "Drafting failed",
        interrupted: "Drafting was interrupted. Draft again.",
        timeout: "Drafting took too long. Draft again, or select fewer data catalogs.",
        source: "The data source answered with an error. Draft again later.",
        details: "Technical details (include them when reporting a problem)",
      },
      notice: {
        draftReadsMissing:
          "Some tables of the draft come from data catalogs {{names}}, which no longer exist or you cannot see. Drafting again reads the project's current catalogs.",
        askOwner: "Ask the project owner to change the data catalogs.",
        missingCatalogs:
          "Data catalogs {{names}} no longer exist, or you cannot see them. Choosing identities, restoring fields and drafting again will fail until the project's catalogs change.",
        unadoptedEnds:
          "{{count}} relation types are adopted although an object type they connect is not. Unadopt them, or adopt the object types at both ends first.",
        unadoptedEnds_one:
          "{{count}} relation type is adopted although an object type it connects is not. Unadopt it, or adopt the object types at both ends first.",
        unadoptedEnds_other:
          "{{count}} relation types are adopted although an object type they connect is not. Unadopt them, or adopt the object types at both ends first.",
      },
      tabs: {
        objects: "Object types {{count}}",
        objects_one: "Object type {{count}}",
        objects_other: "Object types {{count}}",
        relations: "Relation types {{count}}",
        relations_one: "Relation type {{count}}",
        relations_other: "Relation types {{count}}",
        valueTypes: "Value types {{count}}",
        valueTypes_one: "Value type {{count}}",
        valueTypes_other: "Value types {{count}}",
        excluded: "Left out {{count}}",
      },
      state: {
        adopted: "Adopted",
        notAdopted: "Not adopted",
        unadoptedEnd: "Object type not adopted",
      },
      columns: {
        objectType: "Object type",
        state: "Adopted",
        identity: "Identity",
        properties: "Properties",
        source: "Data source",
        relationType: "Relation type",
        ends: "Source → target",
        cardinality: "Correspondence",
        evidence: "Evidence",
        valueType: "Value type",
        baseType: "Base type",
        values: "Values",
        codeTable: "Code table",
        usedBy: "Used by",
        field: "Field",
        reason: "Reason",
        table: "Table",
      },
      identityPending: "Waiting for you",
      cardinality: {
        oneToOne: "One to one",
        manyToOne: "Many to one",
        manyToMany: "Many to many",
      },
      excluded: {
        fieldsTitle: "Fields left out",
        fieldsTip: "These fields were left out of the ontology.",
        unreadableTitle: "Tables that could not be read",
        reason: {
          privacy: "Personal information (keyword: {{keyword}})",
          unsupported_type: "This field type is not supported yet",
          not_visible: "You cannot see this table",
          no_structure: "The fields of this table could not be read yet",
          other: "Another reason",
          none: "No reason given",
        },
      },
      detail: {
        apiName: "ID",
        name: "Name",
        description: "Description",
        noDescription: "No description",
        table: "Table",
        identity: "Identity",
        displayKey: "Display property",
        propertiesTitle: "Properties",
        property: "Property",
        type: "Type",
        mappedField: "Source field",
        missingDescription: "No description",
        excludedTitle: "Fields left out",
        close: "Close",
      },
      evidence: {
        other: "Another basis",
        keySource: {
          primary_key: "The table's primary key",
          unique_index: "A unique constraint of the table",
          inferred: "Inferred by AI",
          chosen: "Chosen by you",
          none: "No usable identity",
        },
        origin: {
          foreign_key: "A link declared in the tables",
          name_match: "Recommended from matching field names",
          link_table: "Connected through a linking table",
        },
        verification: {
          confirmed: "Confirmed",
          unconfirmed: "Worth checking",
        },
        countReason: {
          none: "Not counted",
          composite_key: "Identities made of several properties are not counted",
          query_failed: "Counting did not finish",
          cross_catalog: "The two tables are in different data catalogs, so they are not counted",
          link_table: "Connected through a linking table, so not counted",
          other: "Not counted",
        },
        keyCount: "{{rows}} rows, {{distinct}} distinct, {{nulls}} empty",
        joinCount: "{{rows}} rows: {{hits}} have a matching record ({{rate}}), {{orphans}} do not",
        warning: {
          notUnique:
            "Not unique: {{rows}} rows have only {{distinct}} distinct values; records sharing a value merge into one instance",
          nulls: "{{nulls}} rows are empty and create no instance",
        },
      },
    },
    overview: {
      fields: {
        network: "Target network",
        owner: "Owner",
        updated: "Updated",
        id: "ID",
      },
      tiles: {
        questions: "Questions expected to be answerable",
        questionsSub: "Estimated once requirements are drafted",
        ontology: "Ontology",
        ontologySub: "Shown once drafted from tables",
        sources: "Data sources",
        sourcesValue: "{{count}} catalogs",
        sourcesValue_one: "{{count}} catalog",
        sourcesValue_other: "{{count}} catalogs",
        sourcesSub: "Referenced, never copied",
        instances: "Instances",
        instancesSub: "Created once the draft is confirmed",
      },
      model: {
        title: "Ontology concept model",
        open: "Open in ontology modeling",
        empty: "No ontology draft yet",
        emptyDescription:
          "Once the ontology is drafted from tables, its object and relation types show here.",
      },
      changes: {
        title: "Recent changes",
        empty: "No changes yet",
      },
      versions: {
        title: "Versions and builds",
        live: "Live version",
        draft: "Draft",
        latestRelease: "Latest release",
        unpublished: "Not published yet",
      },
    },
  },
};
