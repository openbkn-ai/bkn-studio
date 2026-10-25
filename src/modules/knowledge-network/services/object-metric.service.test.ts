/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import {
  mockKnowledgeNetworks,
  mockObjectTypeLogicProperties,
} from "@/modules/knowledge-network/services/mock/state";
import {
  bindObjectMetricLogicPropertyV1,
  checkObjectMetricVersionDeletionV1,
  createNextObjectMetricDraftV1,
  createObjectMetricDraftV1,
  deleteObjectMetricVersionV1,
  deprecateObjectMetricV1,
  getObjectMetricCapabilitiesV1,
  getObjectMetricV1,
  listObjectMetricsV1,
  listObjectMetricVersionsV1,
  previewObjectMetricV1,
  publishObjectMetricV1,
  trialObjectMetricDataV1,
  updateObjectMetricDraftV1,
  upgradeObjectMetricLogicPropertyV1,
  validateObjectMetricV1,
  validateObjectMetricVersionV1,
} from "@/modules/knowledge-network/services/object-metric.service";

describe("object metric lifecycle", () => {
  it("keeps one mock logical property per metric and upgrades its pinned version", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const binding = {
      object_type_id: "order",
      property_name: "order_count",
      display_name: "订单数",
      metric_ref: { metric_id: "metric-1", version: 1 },
      execution: { mode: "realtime" as const },
      no_data_policy: "zero" as const,
      on_error: "unavailable" as const,
      status: "published" as const,
    };
    await bindObjectMetricLogicPropertyV1(networkId, "metric-1", 1, binding);
    await expect(
      bindObjectMetricLogicPropertyV1(networkId, "metric-1", 2, {
        ...binding,
        property_name: "another_property",
        metric_ref: { metric_id: "metric-1", version: 2 },
      }),
    ).rejects.toThrow("already bound");
    await upgradeObjectMetricLogicPropertyV1(networkId, "metric-1", "order_count", 2);
    expect(mockObjectTypeLogicProperties[networkId].order).toHaveLength(1);
    expect(mockObjectTypeLogicProperties[networkId].order[0]).toMatchObject({
      name: "order_count",
      metricBinding: { metric_ref: { metric_id: "metric-1", version: 2 } },
      dataSource: { id: "object_metric_v1:metric-1@2" },
    });
  });
  it("advertises the area and volume unit families in mock capabilities", async () => {
    const capabilities = await getObjectMetricCapabilitiesV1();
    expect(capabilities.quantity_kinds).toEqual(expect.arrayContaining(["area", "volume"]));
  });

  it("keeps mock network statistics in sync with V1 metric creation and deletion", async () => {
    const networkId = "kn-domain-risk";
    const initialCount =
      mockKnowledgeNetworks.find((network) => network.id === networkId)?.statistics.metricsTotal ??
      0;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "Temporary metric";
    definition.description = "Used to verify mock statistics";

    const draft = await createObjectMetricDraftV1(networkId, definition);
    expect(
      mockKnowledgeNetworks.find((network) => network.id === networkId)?.statistics.metricsTotal,
    ).toBe(initialCount + 1);

    await deleteObjectMetricVersionV1(networkId, draft.definition.id, draft.definition.version);
    expect(
      mockKnowledgeNetworks.find((network) => network.id === networkId)?.statistics.metricsTotal,
    ).toBe(initialCount);
  });

  it("generates a metric code when the user leaves it blank", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单总数";
    definition.description = "统计订单实例数量";

    const draft = await createObjectMetricDraftV1(networkId, definition);

    expect(draft.definition.code).toMatch(/^m_[a-z0-9]+$/);
  });

  it("keeps a pre-publish logical-property configuration after a draft update and reload", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("derived", "order");
    definition.name = "线下门店订单金额";
    definition.description = "每个订单返回符合线下门店条件的支付金额";
    definition.calculation_scope = "object_instance";
    definition.logic_property = {
      display_name: "线下门店订单金额",
      property_name: "offline_order_amount",
    };

    const draft = await createObjectMetricDraftV1(networkId, definition);
    const editedDefinition = structuredClone(draft.definition);
    editedDefinition.logic_property = {
      comment: "用于订单详情页展示",
      display_name: "线下门店订单实付金额",
      property_name: "offline_order_amount",
    };
    await updateObjectMetricDraftV1(networkId, draft.definition.id, editedDefinition);
    const reloaded = await getObjectMetricV1(networkId, draft.definition.id);

    expect(reloaded?.definition.logic_property).toEqual(editedDefinition.logic_property);
    expect(reloaded?.definition.lifecycle.status).toBe("draft");
  });

  it("persists validation before allowing publication", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.code = "total_order_count";
    definition.name = "订单总数";
    definition.description = "统计订单实例数量";

    const draft = await createObjectMetricDraftV1(networkId, definition);
    await expect(
      publishObjectMetricV1(networkId, draft.definition.id, draft.definition.version),
    ).rejects.toThrow("validated");

    const validated = await validateObjectMetricVersionV1(
      networkId,
      draft.definition.id,
      draft.definition.version,
    );
    expect(validated?.definition.lifecycle.status).toBe("validated");

    const published = await publishObjectMetricV1(
      networkId,
      draft.definition.id,
      draft.definition.version,
    );
    expect(published?.definition.lifecycle.status).toBe("published");

    const deprecated = await deprecateObjectMetricV1(
      networkId,
      draft.definition.id,
      draft.definition.version,
    );
    expect(deprecated?.definition.lifecycle.status).toBe("deprecated");
  });

  it("trials a draft definition without publishing it", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单总数";

    const result = await trialObjectMetricDataV1(networkId, definition);

    expect(result.model.metric_id).toBe("trial");
    expect(result.model.name).toBe("订单总数");
    expect(result.status).toBe("no_data");
  });

  it("filters and paginates the list by keyword, owner, type and status", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const first = createObjectMetricDefinitionV1("atomic", "order");
    first.name = "订单金额";
    first.description = "每个订单的金额";
    const second = createObjectMetricDefinitionV1("derived", "order");
    second.name = "已完成订单金额";
    second.description = "满足完成状态的订单金额";
    const third = createObjectMetricDefinitionV1("atomic", "channel");
    third.name = "渠道佣金率";
    third.description = "每个渠道的佣金率";

    const firstDraft = await createObjectMetricDraftV1(networkId, first);
    await createObjectMetricDraftV1(networkId, second);
    await createObjectMetricDraftV1(networkId, third);
    await validateObjectMetricVersionV1(
      networkId,
      firstDraft.definition.id,
      firstDraft.definition.version,
    );

    await expect(listObjectMetricsV1(networkId, { keyword: "完成" })).resolves.toMatchObject({
      total_count: 1,
    });
    await expect(
      listObjectMetricsV1(networkId, { metricType: "atomic", ownerObjectTypeId: "order" }),
    ).resolves.toMatchObject({ total_count: 1 });
    await expect(listObjectMetricsV1(networkId, { status: "validated" })).resolves.toMatchObject({
      total_count: 1,
    });
    const page = await listObjectMetricsV1(networkId, { limit: 1, offset: 1 });
    expect(page.entries).toHaveLength(1);
    expect(page.total_count).toBe(3);
  });

  it("counts latest metric identities instead of all mock version rows", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "Order amount";
    definition.description = "Order amount by owner";
    const draft = await createObjectMetricDraftV1(networkId, definition);
    await validateObjectMetricVersionV1(networkId, draft.definition.id, draft.definition.version);
    await publishObjectMetricV1(networkId, draft.definition.id, draft.definition.version);
    const next = await createNextObjectMetricDraftV1(networkId, draft.definition.id);

    const latest = await listObjectMetricsV1(networkId);
    expect(latest.total_count).toBe(1);
    expect(latest.entries.map((record) => record.definition.version)).toEqual([
      next.definition.version,
    ]);
  });

  it("resets a validated metric to draft after editing and preserves its immutable code", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.code = "order_amount";
    definition.name = "订单金额";
    definition.description = "每个订单的金额";
    const draft = await createObjectMetricDraftV1(networkId, definition);
    const validated = await validateObjectMetricVersionV1(
      networkId,
      draft.definition.id,
      draft.definition.version,
    );
    const editedDefinition = structuredClone(validated!.definition);
    editedDefinition.code = "attempted_code_change";
    editedDefinition.description = "修改后的业务定义";

    const edited = await updateObjectMetricDraftV1(
      networkId,
      draft.definition.id,
      editedDefinition,
    );

    expect(edited?.definition.lifecycle.status).toBe("draft");
    expect(edited?.definition.code).toBe("order_amount");
    expect(edited?.definition.description).toBe("修改后的业务定义");
  });

  it("keeps a published version immutable and creates a separate next draft", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单金额";
    definition.description = "每个订单的金额";
    const draft = await createObjectMetricDraftV1(networkId, definition);
    await validateObjectMetricVersionV1(networkId, draft.definition.id, draft.definition.version);
    const published = await publishObjectMetricV1(
      networkId,
      draft.definition.id,
      draft.definition.version,
    );

    await expect(
      updateObjectMetricDraftV1(networkId, draft.definition.id, {
        ...published!.definition,
        description: "不允许覆盖",
      }),
    ).rejects.toThrow("immutable");

    const next = await createNextObjectMetricDraftV1(networkId, draft.definition.id);
    expect(next?.definition.version).toBe(2);
    expect(next?.definition.lifecycle.status).toBe("draft");
    expect(next?.definition.description).toBe("每个订单的金额");
    const resumed = await createNextObjectMetricDraftV1(networkId, draft.definition.id);
    expect(resumed?.definition.version).toBe(2);
    const versions = await listObjectMetricVersionsV1(networkId, draft.definition.id);
    expect(versions.map((item) => item.definition.version)).toEqual([2, 1]);
    expect(
      versions.find((item) => item.definition.version === 1)?.definition.lifecycle.status,
    ).toBe("published");
  });

  it("can start a working draft from a deprecated release", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const definition = createObjectMetricDefinitionV1("atomic", "order");
    definition.name = "订单金额";
    definition.description = "每个订单的金额";
    const draft = await createObjectMetricDraftV1(networkId, definition);
    await validateObjectMetricVersionV1(networkId, draft.definition.id, draft.definition.version);
    await publishObjectMetricV1(networkId, draft.definition.id, draft.definition.version);
    await deprecateObjectMetricV1(networkId, draft.definition.id, draft.definition.version);

    const next = await createNextObjectMetricDraftV1(networkId, draft.definition.id);
    expect(next?.definition.version).toBe(2);
    expect(next?.definition.lifecycle.status).toBe("draft");
  });

  it("deletes working and unreferenced deprecated versions but rejects published versions", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const draftDefinition = createObjectMetricDefinitionV1("atomic", "order");
    draftDefinition.name = "待删除草稿";
    draftDefinition.description = "仅用于测试草稿删除";
    const draft = await createObjectMetricDraftV1(networkId, draftDefinition);
    await deleteObjectMetricVersionV1(networkId, draft.definition.id, draft.definition.version);
    await expect(getObjectMetricV1(networkId, draft.definition.id)).resolves.toBeUndefined();

    const publishedDefinition = createObjectMetricDefinitionV1("atomic", "order");
    publishedDefinition.name = "已发布对象指标";
    publishedDefinition.description = "已发布版本不能被草稿删除接口移除";
    const publishedDraft = await createObjectMetricDraftV1(networkId, publishedDefinition);
    await validateObjectMetricVersionV1(
      networkId,
      publishedDraft.definition.id,
      publishedDraft.definition.version,
    );
    await publishObjectMetricV1(
      networkId,
      publishedDraft.definition.id,
      publishedDraft.definition.version,
    );
    await expect(
      deleteObjectMetricVersionV1(
        networkId,
        publishedDraft.definition.id,
        publishedDraft.definition.version,
      ),
    ).rejects.toThrow("blocked");
    await expect(getObjectMetricV1(networkId, publishedDraft.definition.id)).resolves.toMatchObject(
      { definition: { lifecycle: { status: "published" } } },
    );
    await deprecateObjectMetricV1(
      networkId,
      publishedDraft.definition.id,
      publishedDraft.definition.version,
    );
    await deleteObjectMetricVersionV1(
      networkId,
      publishedDraft.definition.id,
      publishedDraft.definition.version,
    );
    await expect(
      getObjectMetricV1(networkId, publishedDraft.definition.id),
    ).resolves.toBeUndefined();
  });

  it("reports metric-version references before deletion", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const targetDefinition = createObjectMetricDefinitionV1("atomic", "order");
    targetDefinition.name = "基础订单数";
    targetDefinition.description = "删除目标";
    const target = await createObjectMetricDraftV1(networkId, targetDefinition);

    const dependentDefinition = createObjectMetricDefinitionV1("derived", "order");
    dependentDefinition.name = "订单增速";
    dependentDefinition.description = "引用基础订单数";
    if (dependentDefinition.specification.kind !== "derived") {
      throw new Error("expected a derived metric definition");
    }
    dependentDefinition.specification.base_metric = {
      metric_id: target.definition.id,
      version: target.definition.version,
    };
    const dependent = await createObjectMetricDraftV1(networkId, dependentDefinition);

    const check = await checkObjectMetricVersionDeletionV1(
      networkId,
      target.definition.id,
      target.definition.version,
    );
    expect(check).toMatchObject({
      deletable: false,
      hidden_blocker_count: 0,
      metric_id: target.definition.id,
      version: target.definition.version,
    });
    expect(check.blockers).toEqual([
      expect.objectContaining({
        field: "specification.base_metric",
        name: dependent.definition.name,
        resource_id: dependent.definition.id,
        resource_type: "metric_version",
        version: dependent.definition.version,
      }),
    ]);
    await expect(
      deleteObjectMetricVersionV1(networkId, target.definition.id, target.definition.version),
    ).rejects.toThrow("blocked");
  });

  it("reports every common validation error and previews all output shapes", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const invalid = createObjectMetricDefinitionV1("atomic", "order");
    invalid.name = "";
    invalid.description = "";
    const validation = await validateObjectMetricV1(networkId, invalid);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((item) => item.code)).toEqual([
      "name_required",
      "description_required",
    ]);

    const grouped = createObjectMetricDefinitionV1("atomic", "order");
    grouped.calculation_scope = "object_set";
    grouped.result_semantics.statistical_grain.group_by_dimensions = [
      { object_type_id: "order", property_name: "status" },
    ];
    const preview = await previewObjectMetricV1(networkId, grouped);
    expect(preview.output_schema.shape).toBe("grouped");
    expect(preview.validation.output_shape).toBe("grouped");
  });
});
