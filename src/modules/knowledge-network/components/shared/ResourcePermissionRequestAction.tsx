/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Form, Input, Modal, Spin } from "antd";
import { useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getRuntimeConfig } from "@/framework/runtime/config";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createPermissionRequest,
  listPermissionRequests,
} from "@/modules/account/services/permission-requests.service";

type RequestForm = { operations?: string[]; reason?: string };

const RESOURCE_PERMISSION_OPERATIONS: Record<string, readonly string[]> = {
  // A catalog is its own authorization root. Creating a catalog and changing
  // its ACL are deliberately excluded: neither can be requested for an
  // existing catalog instance.
  catalog: [
    "view_detail",
    "modify",
    "delete",
    "task_manage",
    "resource_manage",
    "query_data",
    "data_write",
  ],
  // A data resource inherits the applicable catalog business operations via
  // the resource-parent mapping. It has no instance-level create, authorize,
  // or task_manage operation.
  resource: ["view_detail", "query_data", "data_write", "modify", "delete"],
  tool_box: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  function: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  mcp: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  skill: ["view", "modify", "delete", "publish", "unpublish", "execute"],
  concept_group: ["view_detail", "modify", "delete"],
  object_type: ["view_detail", "modify", "delete", "query_data"],
  relation_type: ["view_detail", "modify", "delete", "query_data"],
  action_type: ["view_detail", "modify", "delete", "execute"],
  metric: ["view_detail", "modify", "delete", "query_data"],
};

type ResourcePermissionRequestActionProps = {
  operations?: string[];
  resourceType: string;
  resourceID: string;
  resourceName: string;
  trigger?: "button" | "text";
};

export function canRequestResourcePermission(
  resourceType: string,
  operations: string[] | undefined,
  permissionRequestsEnabled = true,
) {
  if (!permissionRequestsEnabled || getRuntimeConfig().currentUser.isSuperAdmin) {
    return false;
  }
  return getMissingResourcePermissionOperations(resourceType, operations).length > 0;
}

export function getMissingResourcePermissionOperations(
  resourceType: string,
  operations: string[] | undefined,
) {
  // Do not infer missing permissions when the backend did not return the
  // effective operation set. Otherwise owners could incorrectly see and
  // submit a permission request for resources they already control.
  if (!operations || operations.includes("*") || operations.includes("full_business_access")) {
    return [];
  }

  return (RESOURCE_PERMISSION_OPERATIONS[resourceType] ?? []).filter(
    (operation) => !operations.includes(operation),
  );
}

export function ResourcePermissionRequestAction({
  operations,
  resourceType,
  resourceID,
  resourceName,
  trigger = "text",
}: ResourcePermissionRequestActionProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const entitlement = useEntitlement();
  const communityBuild = isCommunityBuild(entitlement);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<string[]>([]);
  const [form] = Form.useForm<RequestForm>();
  const selectableOperations = useMemo(
    () =>
      getMissingResourcePermissionOperations(resourceType, operations).filter(
        (operation) => !pendingOperations.includes(operation),
      ),
    [operations, pendingOperations, resourceType],
  );

  if (communityBuild || getRuntimeConfig().currentUser.isSuperAdmin) {
    return null;
  }

  const openRequest = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    setLoading(true);
    form.resetFields();
    try {
      const page = await listPermissionRequests("mine", 200, 0);
      const nextPendingOperations = page.entries
        .filter(
          (request) =>
            request.status === "pending" &&
            request.resource_type === resourceType &&
            request.resource_id === resourceID,
        )
        .flatMap((request) =>
          request.operations?.length ? request.operations : [request.operation],
        );
      setPendingOperations(nextPendingOperations);
      setPending(nextPendingOperations.length > 0);
    } catch (error) {
      setOpen(false);
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const submit = async (values: RequestForm) => {
    setSubmitting(true);
    try {
      await createPermissionRequest({
        resourceType,
        resourceID,
        resourceName,
        operations: communityBuild ? ["full_business_access"] : (values.operations ?? []),
        reason: values.reason?.trim() ?? "",
      });
      void message.success(t("knowledgeNetwork.permissionRequestSuccess"));
      setOpen(false);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {trigger === "button" ? (
        <AppButton onClick={(event) => void openRequest(event)}>
          {t("knowledgeNetwork.requestPermission")}
        </AppButton>
      ) : (
        <span onClick={(event) => void openRequest(event)} role="button" tabIndex={0}>
          {t("knowledgeNetwork.requestPermission")}
        </span>
      )}
      <Modal
        centered
        confirmLoading={submitting}
        okButtonProps={{
          disabled:
            loading ||
            (communityBuild && pending) ||
            (!communityBuild && selectableOperations.length === 0),
        }}
        okText={t("knowledgeNetwork.permissionRequestSubmit")}
        onCancel={() => {
          if (!submitting) setOpen(false);
        }}
        onOk={() => void form.submit()}
        open={open}
        title={t("knowledgeNetwork.permissionRequestResourceTitle")}
      >
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
            <Form.Item label={t("knowledgeNetwork.permissionRequestResource")}>
              <Input disabled value={`${resourceName} (${resourceID})`} />
            </Form.Item>
            {communityBuild ? (
              <Alert
                showIcon
                type="warning"
                message={t("knowledgeNetwork.permissionRequestCommunity")}
              />
            ) : null}
            {pending ? (
              <Alert
                showIcon
                style={{ marginTop: 16 }}
                type="info"
                message={t("knowledgeNetwork.permissionRequestPending", {
                  operations: pendingOperations
                    .map((operation) => t(`knowledgeNetwork.permissionOperation.${operation}`))
                    .join("、"),
                })}
              />
            ) : null}
            {communityBuild ? (
              <Form.Item
                label={t("knowledgeNetwork.permissionRequestOperations")}
                style={{ marginTop: 16 }}
              >
                <Checkbox checked disabled>
                  {t("knowledgeNetwork.permissionOperation.full_business_access")}
                </Checkbox>
              </Form.Item>
            ) : (
              <Form.Item
                label={t("knowledgeNetwork.permissionRequestOperations")}
                name="operations"
                rules={[{ required: true }]}
                style={{ marginTop: 16 }}
              >
                <Checkbox.Group
                  options={selectableOperations.map((operation) => ({
                    label: t(`knowledgeNetwork.permissionOperation.${operation}`),
                    value: operation,
                  }))}
                />
              </Form.Item>
            )}
            <Form.Item label={t("knowledgeNetwork.permissionRequestReason")} name="reason">
              <Input.TextArea maxLength={512} rows={3} />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </>
  );
}
