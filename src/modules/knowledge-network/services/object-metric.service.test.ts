/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createObjectMetricDefinitionV1 } from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import {
  createNextObjectMetricDraftV1,
  createObjectMetricDraftV1,
  deleteObjectMetricDraftV1,
  deprecateObjectMetricV1,
  getObjectMetricV1,
  listObjectMetricsV1,
  listObjectMetricVersionsV1,
  previewObjectMetricV1,
  publishObjectMetricV1,
  trialObjectMetricDataV1,
  updateObjectMetricDraftV1,
  validateObjectMetricV1,
  validateObjectMetricVersionV1,
} from "@/modules/knowledge-network/services/object-metric.service";

describe("object metric lifecycle", () => {
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
    const versions = await listObjectMetricVersionsV1(networkId, draft.definition.id);
    expect(versions.map((item) => item.definition.version)).toEqual([2, 1]);
    expect(
      versions.find((item) => item.definition.version === 1)?.definition.lifecycle.status,
    ).toBe("published");
  });

  it("deletes only draft versions and leaves published history readable", async () => {
    const networkId = `kn-${crypto.randomUUID()}`;
    const draftDefinition = createObjectMetricDefinitionV1("atomic", "order");
    draftDefinition.name = "待删除草稿";
    draftDefinition.description = "仅用于测试草稿删除";
    const draft = await createObjectMetricDraftV1(networkId, draftDefinition);
    await deleteObjectMetricDraftV1(networkId, draft.definition.id, draft.definition.version);
    await expect(getObjectMetricV1(networkId, draft.definition.id)).resolves.toBeUndefined();

    const publishedDefinition = createObjectMetricDefinitionV1("atomic", "order");
    publishedDefinition.name = "已发布指标";
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
    await deleteObjectMetricDraftV1(
      networkId,
      publishedDraft.definition.id,
      publishedDraft.definition.version,
    );
    await expect(getObjectMetricV1(networkId, publishedDraft.definition.id)).resolves.toMatchObject(
      { definition: { lifecycle: { status: "published" } } },
    );
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
