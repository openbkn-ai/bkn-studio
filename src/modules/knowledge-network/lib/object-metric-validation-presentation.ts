/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricValidationIssueV1 } from "@/modules/knowledge-network/types/object-metric";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";

export type ObjectMetricValidationIssuePresentation = {
  location: string;
  problem: string;
  suggestion: string;
};

type PresentationContext = {
  aggregation?: string;
  calculationScope?: "object_instance" | "object_set";
};

const fieldLabels = (): ReadonlyArray<readonly [string, string]> => [
  ["specification.measure.expression", objectMetricText("m7995b720bc22")],
  ["specification.measure.aggregation", objectMetricText("mb17e03bc6bad")],
  ["specification.base_metric", objectMetricText("m4919ba2e9c0b")],
  ["specification.expression", objectMetricText("m158be067b860")],
  ["specification.alignment.primary_dependency_alias", objectMetricText("m1b7c44db1dec")],
  ["specification.alignment.time_key", objectMetricText("mfc24e51d724b")],
  ["specification.alignment", objectMetricText("mb91b96f3f5d0")],
  ["specification.dependencies", objectMetricText("ma6ace5b29ab9")],
  ["specification.business_qualifiers.event_time", objectMetricText("m167212ee6e47")],
  ["specification.business_qualifiers.relation_path", objectMetricText("m14abf2359755")],
  ["specification.business_qualifiers.time_window", objectMetricText("m07eb730af899")],
  ["specification.business_qualifiers", objectMetricText("mc2773b1bc4ba")],
  ["result_semantics.value.physical_type", objectMetricText("m8410f1c133ee")],
  ["result_semantics.value.semantic_type", objectMetricText("m6551b12a8b84")],
  ["result_semantics.value.unit", objectMetricText("m80b19d68b149")],
  ["result_semantics.no_data_policy", objectMetricText("me5ab55285d71")],
  ["result_semantics.statistical_grain", objectMetricText("m1fce8d321e5a")],
  ["query_capabilities.analysis_dimensions", objectMetricText("m9a004b7a1da9")],
  ["query_capabilities.time_dimensions", objectMetricText("m40e232fef99f")],
  ["calculation_scope", objectMetricText("m9d1c9c0a1780")],
  ["description", objectMetricText("m419eb90613fd")],
  ["name", objectMetricText("m5fadf5e3e6a9")],
  ["code", objectMetricText("m13700a34d7b3")],
];

const aggregationLabels: Record<string, string> = {
  get avg() {
    return objectMetricText("mdb7538b96322");
  },
  get count() {
    return objectMetricText("me2f713680e9a");
  },
  get count_distinct() {
    return objectMetricText("m1e96cd1f49bf");
  },
  get count_rows() {
    return objectMetricText("m21179deb9a74");
  },
  get identity() {
    return objectMetricText("m9d001b97d59e");
  },
  get max() {
    return objectMetricText("m1e7a22820768");
  },
  get min() {
    return objectMetricText("mb2dcdcfabb6a");
  },
  get sum() {
    return objectMetricText("m2819237ddb01");
  },
};

function validationLocation(field: string) {
  return (
    fieldLabels().find(
      ([prefix]) =>
        field === prefix || field.startsWith(`${prefix}.`) || field.startsWith(`${prefix}[`),
    )?.[1] ?? objectMetricText("m283a7f514f66")
  );
}

function genericPresentation(
  issue: ObjectMetricValidationIssueV1,
): Omit<ObjectMetricValidationIssuePresentation, "location"> {
  if (issue.code.endsWith("_required")) {
    return {
      problem: objectMetricText("md3b17f9e1f00"),
      suggestion: objectMetricText("m9cd9640b044f"),
    };
  }
  if (issue.code.includes("duplicate")) {
    return {
      problem: objectMetricText("ma24457981e1f"),
      suggestion: objectMetricText("m657c3819beed"),
    };
  }
  if (issue.code.includes("mismatch")) {
    return {
      problem: objectMetricText("mb192c6b1df3e"),
      suggestion: objectMetricText("m9ce2605b88cf"),
    };
  }
  if (issue.code.includes("forbidden") || issue.code.includes("not_allowed")) {
    return {
      problem: objectMetricText("m24499ed2ad28"),
      suggestion: objectMetricText("mf8a30b5b7ae8"),
    };
  }
  if (issue.code.startsWith("invalid_")) {
    return {
      problem: objectMetricText("m5b25b39b7229"),
      suggestion: objectMetricText("m114752bae357"),
    };
  }
  return {
    problem: objectMetricText("m00ef3c32b1a7"),
    suggestion: objectMetricText("mb52b75ebd906"),
  };
}

export function presentObjectMetricValidationIssue(
  issue: ObjectMetricValidationIssueV1,
  context: PresentationContext = {},
): ObjectMetricValidationIssuePresentation {
  const location = validationLocation(issue.field);

  switch (issue.code) {
    case "aggregation_input_type_invalid": {
      const aggregation = context.aggregation
        ? (aggregationLabels[context.aggregation] ?? objectMetricText("m8b9263fad19c"))
        : objectMetricText("m8b9263fad19c");
      return {
        location,
        problem: objectMetricText("m28d374b33a20", { p0: aggregation }),
        suggestion: objectMetricText("ma6bbba71a0a7"),
      };
    }
    case "measure_expression_required":
    case "atomic_measure_property_required":
      return {
        location,
        problem: objectMetricText("m2ae12799a961"),
        suggestion: objectMetricText("mc0d9d1057c6e"),
      };
    case "atomic_result_type_mismatch":
    case "composite_result_type_mismatch":
    case "value_type_mismatch":
      return {
        location,
        problem: objectMetricText("mf8679d77f3bc"),
        suggestion: objectMetricText("m347e0e1bc2c8"),
      };
    case "zero_no_data_policy_incompatible":
      return {
        location,
        problem: objectMetricText("m732b9bcf6066"),
        suggestion: objectMetricText("mbe94b3130497"),
      };
    case "decimal_format_required":
    case "invalid_decimal_format":
      return {
        location,
        problem: objectMetricText("md48911ff51f1"),
        suggestion: objectMetricText("mcba571168d4c"),
      };
    case "semantic_unit_required":
    case "currency_unit_required":
    case "duration_unit_required":
    case "unit_code_required":
      return {
        location,
        problem: objectMetricText("m53716adc8196"),
        suggestion: objectMetricText("m2b8cb43523c3"),
      };
    case "fixed_dimension_not_analyzable":
      return {
        location,
        problem: objectMetricText("mf7261c88b824"),
        suggestion: objectMetricText("m0e06fc00cbe4"),
      };
    case "base_metric_required":
      return {
        location,
        problem: objectMetricText("m8bf8cfce0681"),
        suggestion: objectMetricText("m6b1b90a27660"),
      };
    case "business_qualifier_required":
      return {
        location,
        problem: objectMetricText("m92e1c846a523"),
        suggestion:
          context.calculationScope === "object_instance"
            ? objectMetricText("m1dbeead380b2")
            : objectMetricText("m1ac752b96fb4"),
      };
    case "event_time_required":
      return {
        location,
        problem: objectMetricText("mc00300350d5d"),
        suggestion: objectMetricText("m249729574b69"),
      };
    case "rolling_window_invalid":
      return {
        location,
        problem: objectMetricText("m087c37eef2a5"),
        suggestion: objectMetricText("m163090116257"),
      };
    case "calendar_window_invalid":
      return {
        location,
        problem: objectMetricText("m440523fb81f9"),
        suggestion: objectMetricText("mf53126f2c0f1"),
      };
    case "week_start_required":
    case "invalid_week_start":
      return {
        location,
        problem: objectMetricText("m9808d41fbe09"),
        suggestion: objectMetricText("me90413c39aab"),
      };
    case "fixed_window_invalid":
      return {
        location,
        problem: objectMetricText("mbc7654c9999b"),
        suggestion: objectMetricText("mb17e38ae7584"),
      };
    case "invalid_timezone":
      return {
        location,
        problem: objectMetricText("mae5a0f0a072e"),
        suggestion: objectMetricText("m282612bee33e"),
      };
    case "invalid_time_window":
      return {
        location,
        problem: objectMetricText("m78fdfd48a2d1"),
        suggestion: objectMetricText("me18207a7ad28"),
      };
    case "unbounded_window_fields_forbidden":
    case "rolling_window_fields_forbidden":
    case "calendar_window_fields_forbidden":
    case "fixed_window_fields_forbidden":
      return {
        location,
        problem: objectMetricText("m17fb876b12ab"),
        suggestion: objectMetricText("m9125793e1404"),
      };
    case "derived_event_time_not_in_base":
      return {
        location,
        problem: objectMetricText("mff8d6e6ae3f6"),
        suggestion: objectMetricText("m4d331e2d4da4"),
      };
    case "derived_analysis_capability_not_in_base":
      return {
        location,
        problem: objectMetricText("m6a2537a59d42"),
        suggestion: objectMetricText("ma8601f5e09f8"),
      };
    case "derived_time_capability_not_in_base":
      return {
        location,
        problem: objectMetricText("ma75762e1e47e"),
        suggestion: objectMetricText("m1822ac8f2bca"),
      };
    case "derived_value_semantics_mismatch":
      return {
        location,
        problem: objectMetricText("m996de259e56a"),
        suggestion: objectMetricText("md01e5b491031"),
      };
    case "derived_scope_mismatch":
      return {
        location,
        problem: objectMetricText("me1d3b5702320"),
        suggestion: objectMetricText("m3ace3dd1d3e4"),
      };
    case "composite_dependencies_required":
      return {
        location,
        problem: objectMetricText("m0a2cd24154a5"),
        suggestion: objectMetricText("m9c34baa7b669"),
      };
    case "dependency_metric_required":
      return {
        location,
        problem: objectMetricText("m9569bcdd0b6f"),
        suggestion: objectMetricText("mc9192ba988f8"),
      };
    case "dependency_alias_required":
      return {
        location,
        problem: objectMetricText("mcfff0bd993d0"),
        suggestion: objectMetricText("m807a2629d94e"),
      };
    case "dependency_alias_duplicate":
      return {
        location,
        problem: objectMetricText("m3190a88d859a"),
        suggestion: objectMetricText("me3e7409b7fb7"),
      };
    case "dependency_not_referenced":
      return {
        location,
        problem: objectMetricText("m76bfe92dd6e3"),
        suggestion: objectMetricText("m2b62acc753fa"),
      };
    case "unknown_dependency_alias":
      return {
        location,
        problem: objectMetricText("m3453392f330d"),
        suggestion: objectMetricText("mb4882611349d"),
      };
    case "rollup_aggregation_required":
      return {
        location,
        problem: objectMetricText("m22acc4379ad1"),
        suggestion: objectMetricText("m01fbad6fcc1a"),
      };
    case "rollup_aggregation_forbidden":
      return {
        location,
        problem: objectMetricText("m414e6058ac82"),
        suggestion: objectMetricText("me83ca518b692"),
      };
    case "instance_related_set_alignment_forbidden":
      return {
        location,
        problem: objectMetricText("mc270993bd229"),
        suggestion: objectMetricText("m1ae977588b47"),
      };
    case "related_dependency_time_series_unsupported":
      return {
        location,
        problem: objectMetricText("mcd6e8b27adc6"),
        suggestion: objectMetricText("mcb6ff846b92e"),
      };
    case "primary_dependency_required":
    case "primary_dependency_unknown":
      return {
        location,
        problem: objectMetricText("me21db9901764"),
        suggestion: objectMetricText("me028c9930bc9"),
      };
    case "metric_dependency_cycle":
      return {
        location,
        problem: objectMetricText("m2d4d2ec139b9"),
        suggestion: objectMetricText("m9108ee54f522"),
      };
    default:
      return { location, ...genericPresentation(issue) };
  }
}
