/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  LockOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input, Modal, Space, Spin, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getRuntimeConfig } from "@/framework/runtime/config";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createPermissionRequest,
  isPermissionAlreadyGrantedError,
  isPermissionRequestResourceDeletedError,
  listPermissionRequests,
} from "@/modules/account/services/permission-requests.service";
import {
  getMissingResourcePermissionOperations,
  togglePermissionRequestOperation,
} from "@/modules/knowledge-network/components/shared/resource-permission-request";
import { AuthorizationRegistryFailureAlert } from "@/modules/system-admin/components/AuthorizationRegistryFailureAlert";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

import authorizationStyles from "@/modules/system-admin/scenes/admin.module.css";

type RequestForm = { operations?: string[]; reason?: string };

type ResourcePermissionRequestActionProps = {
  operations?: string[];
  resourceType: string;
  resourceID: string;
  resourceName: string;
  trigger?: "button" | "none" | "text";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function requestResourceIcon(resourceType: string) {
  if (resourceType === "knowledge_network") return <DeploymentUnitOutlined />;
  if (["catalog", "resource"].includes(resourceType)) return <DatabaseOutlined />;
  if (["tool_box", "function"].includes(resourceType)) return <ToolOutlined />;
  if (resourceType === "mcp") return <ApiOutlined />;
  if (resourceType === "skill") return <FileTextOutlined />;
  return <AppstoreOutlined />;
}

export function ResourcePermissionRequestAction({
  operations,
  resourceType,
  resourceID,
  resourceName,
  trigger = "text",
  open,
  onOpenChange,
}: ResourcePermissionRequestActionProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const { catalogError, catalogLoading, operationsForType, retryAuthorizationRegistry } =
    useAuthorizationRegistry();
  const entitlement = useEntitlement();
  const communityBuild = isCommunityBuild(entitlement);
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<string[]>([]);
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [form] = Form.useForm<RequestForm>();
  const requestOpen = open ?? internalOpen;
  const selectableOperationKeys = useMemo(
    () =>
      getMissingResourcePermissionOperations(resourceType, operations).filter(
        (operation) => !pendingOperations.includes(operation),
      ),
    [operations, pendingOperations, resourceType],
  );
  const selectableOperations = useMemo(() => {
    const registryOperations = new Map(
      operationsForType(resourceType).map((operation) => [operation.key, operation]),
    );
    return selectableOperationKeys.map((operation) => {
      const registryOperation = registryOperations.get(operation);
      return (
        registryOperation ?? {
          description: t(`knowledgeNetwork.permissionOperation.${operation}`),
          key: operation,
          label: t(`knowledgeNetwork.permissionOperation.${operation}`),
          requires: [],
        }
      );
    });
  }, [operationsForType, resourceType, selectableOperationKeys, t]);
  const selectedRequirements = useMemo(
    () =>
      selectableOperations.flatMap((requirement) => {
        const dependents = selectableOperations.filter(
          (operation) =>
            selectedOperations.includes(operation.key) &&
            operation.requires.includes(requirement.key),
        );
        return dependents.length ? [requirement.key] : [];
      }),
    [selectableOperations, selectedOperations],
  );

  const setOperations = (next: string[]) => {
    const normalized = [...new Set(next)];
    setSelectedOperations(normalized);
    form.setFieldValue("operations", normalized);
  };
  const toggleOperation = (operationKey: string) => {
    setSelectedOperations((current) => {
      const next = togglePermissionRequestOperation(current, operationKey, selectableOperations);
      form.setFieldValue("operations", next);
      return next;
    });
  };
  const setRequestOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const openRequest = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setRequestOpen(true);
  };

  useEffect(() => {
    if (!requestOpen) return;
    let active = true;
    setLoading(true);
    form.resetFields();
    setPending(false);
    setPendingOperations([]);
    setSelectedOperations([]);
    void listPermissionRequests("mine", 20, 0, {
      resourceID,
      resourceType,
      status: "pending",
    })
      .then((page) => {
        if (!active) return;
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
      })
      .catch((error) => {
        if (!active) return;
        void message.error(extractRequestErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, message, requestOpen, resourceID, resourceType]);

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
      setRequestOpen(false);
      message.success({
        content: (
          <Space size={8}>
            {t("knowledgeNetwork.permissionRequestSuccess")}
            <Button
              onClick={() => {
                void navigate("/account/permission-requests?tab=mine");
              }}
              size="small"
              type="link"
            >
              {t("knowledgeNetwork.permissionRequestViewMine")}
            </Button>
          </Space>
        ),
        duration: 5,
      });
    } catch (error) {
      if (isPermissionAlreadyGrantedError(error)) {
        setRequestOpen(false);
        void message.info(t("knowledgeNetwork.permissionRequestAlreadyGranted"));
        return;
      }
      if (isPermissionRequestResourceDeletedError(error)) {
        setRequestOpen(false);
        void message.warning(t("knowledgeNetwork.permissionRequestResourceDeleted"));
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (communityBuild || getRuntimeConfig().currentUser.isSuperAdmin) {
    return null;
  }

  return (
    <>
      {trigger === "button" ? (
        <AppButton onClick={(event) => void openRequest(event)}>
          {t("knowledgeNetwork.requestPermission")}
        </AppButton>
      ) : trigger === "text" ? (
        <span
          onClick={(event) => void openRequest(event)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") void openRequest(event);
          }}
          role="button"
          tabIndex={0}
        >
          {t("knowledgeNetwork.requestPermission")}
        </span>
      ) : null}
      <Modal
        centered
        confirmLoading={submitting}
        okButtonProps={{
          disabled: loading || catalogLoading || selectedOperations.length === 0,
        }}
        okText={t("knowledgeNetwork.permissionRequestSubmit")}
        onCancel={() => {
          if (!submitting) setRequestOpen(false);
        }}
        onOk={() => void form.submit()}
        open={requestOpen}
        rootClassName={authorizationStyles.adminOverlay}
        title={t("knowledgeNetwork.permissionRequestResourceTitle")}
      >
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
            <Form.Item label={t("knowledgeNetwork.permissionRequestResource")}>
              <Space align="start" size={8}>
                <Typography.Text>{requestResourceIcon(resourceType)}</Typography.Text>
                <div>
                  <Typography.Text strong>{resourceName}</Typography.Text>
                  <div>
                    <Tag>{t(`account.permissionRequests.resourceTypes.${resourceType}`)}</Tag>
                    <Typography.Text copyable={{ text: resourceID }} type="secondary">
                      {t("knowledgeNetwork.permissionRequestResourceID", { id: resourceID })}
                    </Typography.Text>
                  </div>
                </div>
              </Space>
            </Form.Item>
            <AuthorizationRegistryFailureAlert
              error={catalogError}
              onRetry={retryAuthorizationRegistry}
            />
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
            <Form.Item hidden name="operations" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label={t("knowledgeNetwork.permissionRequestOperations")}
              style={{ marginTop: 16 }}
            >
              <div className={authorizationStyles.authzGrantFieldHead}>
                <span className={authorizationStyles.authzGrantFieldLabel}>
                  {t("systemAdmin.objectGrants.selectedOperationCount", {
                    selected: selectedOperations.length,
                    total: selectableOperations.length,
                  })}
                </span>
                <div className={authorizationStyles.authzGrantFieldActions}>
                  <Button
                    disabled={
                      catalogLoading ||
                      !selectableOperations.length ||
                      selectedOperations.length === selectableOperations.length
                    }
                    onClick={() =>
                      setOperations(selectableOperations.map((operation) => operation.key))
                    }
                    size="small"
                    type="link"
                  >
                    {t("systemAdmin.objectGrants.selectAllOperations")}
                  </Button>
                  <Button
                    disabled={catalogLoading || !selectedOperations.length}
                    onClick={() => setOperations([])}
                    size="small"
                    type="link"
                  >
                    {t("systemAdmin.objectGrants.clearOperations")}
                  </Button>
                </div>
              </div>
              <div
                aria-label={t("knowledgeNetwork.permissionRequestOperations")}
                className={authorizationStyles.authzGrantOperations}
                role="group"
              >
                {selectableOperations.map((operation) => {
                  const selected = selectedOperations.includes(operation.key);
                  const required = selectedRequirements.includes(operation.key);
                  return (
                    <Tooltip key={operation.key} title={operation.description ?? operation.key}>
                      <button
                        aria-label={`${operation.label} (${operation.key})`}
                        aria-pressed={selected}
                        className={
                          selected
                            ? authorizationStyles.authzGrantOperationSelected
                            : authorizationStyles.authzGrantOperation
                        }
                        disabled={catalogLoading}
                        onClick={() => toggleOperation(operation.key)}
                        type="button"
                      >
                        {operation.label}
                        {required ? (
                          <LockOutlined className={authorizationStyles.authzGrantLock} />
                        ) : null}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
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
