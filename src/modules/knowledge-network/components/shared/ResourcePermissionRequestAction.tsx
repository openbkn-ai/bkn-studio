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
import { getMissingResourcePermissionOperations } from "@/modules/knowledge-network/components/shared/resource-permission-request";

type RequestForm = { operations?: string[]; reason?: string };

type ResourcePermissionRequestActionProps = {
  operations?: string[];
  resourceType: string;
  resourceID: string;
  resourceName: string;
  trigger?: "button" | "text";
};

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
        operations: values.operations ?? [],
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
          disabled: loading || selectableOperations.length === 0,
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
            <Form.Item label={t("knowledgeNetwork.permissionRequestReason")} name="reason">
              <Input.TextArea maxLength={512} rows={3} />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </>
  );
}
