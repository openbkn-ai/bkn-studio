import {
  ApiOutlined,
  AppstoreOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  ImportOutlined,
  LeftOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Card, Empty, List, Space, Spin, Table, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import type {
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
import { ConceptGroupDetailDrawer } from "@/modules/knowledge-network/components/ConceptGroupDetailDrawer";
import { ConceptGroupFormModal } from "@/modules/knowledge-network/components/ConceptGroupFormModal";
import { ActionTypeDetailDrawer } from "@/modules/knowledge-network/components/ActionTypeDetailDrawer";
import { ActionTypeFormModal } from "@/modules/knowledge-network/components/ActionTypeFormModal";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/KnowledgeNetworkFormModal";
import { ObjectTypeFormModal } from "@/modules/knowledge-network/components/ObjectTypeFormModal";
import { ObjectTypeDetailDrawer } from "@/modules/knowledge-network/components/ObjectTypeDetailDrawer";
import { RelationTypeDetailDrawer } from "@/modules/knowledge-network/components/RelationTypeDetailDrawer";
import { RelationTypeFormModal } from "@/modules/knowledge-network/components/RelationTypeFormModal";
import {
  createKnowledgeNetworkActionType,
  createKnowledgeNetworkConceptGroup,
  createKnowledgeNetworkObjectType,
  createKnowledgeNetworkRelationType,
  deleteKnowledgeNetworkActionType,
  deleteKnowledgeNetworkConceptGroup,
  deleteKnowledgeNetworkObjectType,
  deleteKnowledgeNetworkRelationType,
  getKnowledgeNetwork,
  getKnowledgeNetworkConceptGroup,
  getKnowledgeNetworkPreviewGraph,
  listKnowledgeNetworkActionTypes,
  listKnowledgeNetworkConceptGroups,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRecentObjects,
  listKnowledgeNetworkRelationTypes,
  updateKnowledgeNetwork,
  updateKnowledgeNetworkActionType,
  updateKnowledgeNetworkConceptGroup,
  updateKnowledgeNetworkObjectType,
  updateKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkActionTypeRecord,
  ConceptGroupMutationPayload,
  ConceptGroupRecord,
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkObjectTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeMutationPayload,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkWorkspaceScene.module.css";

type WorkspaceNavItem = {
  count?: number;
  icon: React.ReactNode;
  key: KnowledgeNetworkWorkspaceSection;
  label: string;
};

function renderKnowledgeNetworkIcon(icon?: string) {
  switch (icon) {
    case "team":
      return <UserOutlined />;
    case "database":
    case "hdd":
    case "shop":
      return <DatabaseOutlined />;
    case "share-alt":
      return <ApiOutlined />;
    case "deployment-unit":
    default:
      return <DeploymentUnitOutlined />;
  }
}

export function KnowledgeNetworkWorkspaceScene({
  networkId,
  onBack,
  section,
}: KnowledgeNetworkWorkspaceSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const params = useParams<{ networkId: string }>();
  const activeNetworkId = networkId ?? params.networkId ?? "";
  const [detail, setDetail] = useState<KnowledgeNetworkRecord | null>(null);
  const [recentObjects, setRecentObjects] = useState<KnowledgeNetworkRecentObject[]>(
    [],
  );
  const [conceptGroups, setConceptGroups] = useState<ConceptGroupRecord[]>([]);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>(
    [],
  );
  const [relationTypes, setRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>(
    [],
  );
  const [actionTypes, setActionTypes] = useState<KnowledgeNetworkActionTypeRecord[]>(
    [],
  );
  const [previewGraph, setPreviewGraph] = useState<KnowledgeNetworkPreviewGraph>({
    nodes: [],
    edges: [],
  });
  const [conceptGroupModalMode, setConceptGroupModalMode] = useState<
    "create" | "edit"
  >("create");
  const [conceptGroupFormOpen, setConceptGroupFormOpen] = useState(false);
  const [activeConceptGroup, setActiveConceptGroup] =
    useState<ConceptGroupRecord | null>(null);
  const [conceptGroupDetailId, setConceptGroupDetailId] = useState<string | null>(
    null,
  );
  const [objectTypeModalMode, setObjectTypeModalMode] = useState<
    "create" | "edit"
  >("create");
  const [objectTypeFormOpen, setObjectTypeFormOpen] = useState(false);
  const [activeObjectType, setActiveObjectType] =
    useState<KnowledgeNetworkObjectTypeRecord | null>(null);
  const [objectTypeDetailId, setObjectTypeDetailId] = useState<string | null>(null);
  const [relationTypeModalMode, setRelationTypeModalMode] = useState<
    "create" | "edit"
  >("create");
  const [relationTypeFormOpen, setRelationTypeFormOpen] = useState(false);
  const [activeRelationType, setActiveRelationType] =
    useState<KnowledgeNetworkRelationTypeRecord | null>(null);
  const [relationTypeDetailId, setRelationTypeDetailId] = useState<string | null>(
    null,
  );
  const [actionTypeModalMode, setActionTypeModalMode] = useState<
    "create" | "edit"
  >("create");
  const [actionTypeFormOpen, setActionTypeFormOpen] = useState(false);
  const [activeActionType, setActiveActionType] =
    useState<KnowledgeNetworkActionTypeRecord | null>(null);
  const [actionTypeDetailId, setActionTypeDetailId] = useState<string | null>(null);
  const [networkFormOpen, setNetworkFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadWorkspaceData = useCallback(async () => {
    if (!activeNetworkId) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [
        detailResult,
        objectResult,
        groupResult,
        previewResult,
        objectTypeResult,
        relationTypeResult,
        actionTypeResult,
      ] = await Promise.all([
        getKnowledgeNetwork(activeNetworkId),
        listKnowledgeNetworkRecentObjects(activeNetworkId),
        listKnowledgeNetworkConceptGroups(activeNetworkId),
        getKnowledgeNetworkPreviewGraph(activeNetworkId),
        listKnowledgeNetworkObjectTypes(activeNetworkId),
        listKnowledgeNetworkRelationTypes(activeNetworkId),
        listKnowledgeNetworkActionTypes(activeNetworkId),
      ]);

      setDetail(detailResult);
      setRecentObjects(objectResult);
      setConceptGroups(groupResult);
      setPreviewGraph(previewResult);
      setObjectTypes(objectTypeResult);
      setRelationTypes(relationTypeResult);
      setActionTypes(actionTypeResult);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [activeNetworkId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const navigationItems: WorkspaceNavItem[] = useMemo(
    () => [
      {
        key: "overview",
        label: t("knowledgeNetwork.workspaceOverviewShort"),
        icon: <FileTextOutlined />,
      },
      {
        key: "preview",
        label: t("knowledgeNetwork.workspacePreviewModeling"),
        icon: <ClusterOutlined />,
      },
      {
        key: "object-types",
        label: t("knowledgeNetwork.workspaceObjectTypes"),
        icon: <DatabaseOutlined />,
        count: detail?.statistics.objectTypesTotal ?? 0,
      },
      {
        key: "relation-types",
        label: t("knowledgeNetwork.workspaceRelationTypes"),
        icon: <ApiOutlined />,
        count: detail?.statistics.relationTypesTotal ?? 0,
      },
      {
        key: "action-types",
        label: t("knowledgeNetwork.workspaceActionTypes"),
        icon: <ThunderboltOutlined />,
        count: detail?.statistics.actionTypesTotal ?? 0,
      },
      {
        key: "concept-groups",
        label: t("knowledgeNetwork.workspaceConceptGroups"),
        icon: <ApartmentOutlined />,
        count: detail?.statistics.conceptGroupsTotal ?? 0,
      },
    ],
    [detail, t],
  );

  const reloadConceptGroups = async () => {
    if (!activeNetworkId) {
      return;
    }

    const groupResult = await listKnowledgeNetworkConceptGroups(activeNetworkId);
    setConceptGroups(groupResult);
  };

  const reloadObjectTypes = async () => {
    if (!activeNetworkId) {
      return;
    }

    const objectTypeResult = await listKnowledgeNetworkObjectTypes(activeNetworkId);
    setObjectTypes(objectTypeResult);
  };

  const reloadRelationTypes = async () => {
    if (!activeNetworkId) {
      return;
    }

    const relationTypeResult = await listKnowledgeNetworkRelationTypes(
      activeNetworkId,
    );
    setRelationTypes(relationTypeResult);
  };

  const reloadActionTypes = async () => {
    if (!activeNetworkId) {
      return;
    }

    const actionTypeResult = await listKnowledgeNetworkActionTypes(activeNetworkId);
    setActionTypes(actionTypeResult);
  };

  const recentObjectColumns = useMemo(
    () => [
      {
        dataIndex: "name",
        key: "name",
        title: t("common.name"),
        width: 360,
        render: (_value: string, record: KnowledgeNetworkRecentObject) => (
          <div className={styles.objectTitleBox}>
            <span
              className={styles.objectIconSquare}
              style={{ backgroundColor: record.color }}
            >
              <DatabaseOutlined />
            </span>
            <span>{record.name}</span>
          </div>
        ),
      },
      {
        dataIndex: "tags",
        key: "tags",
        title: t("common.tag"),
        width: 180,
        render: (value: string[]) => (
          <div className={styles.tableTags}>
            {value.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        ),
      },
      {
        dataIndex: "updaterName",
        key: "updaterName",
        title: t("common.updatedBy"),
        width: 180,
      },
      {
        dataIndex: "updateTime",
        key: "updateTime",
        title: t("common.updateTime"),
        width: 220,
      },
    ],
    [t],
  );

  const renderOverview = () => (
    <div className={styles.overviewBox}>
      <div className={styles.overviewHeaderCard}>
        <div className={styles.overviewHeaderTitle}>
          <div className={styles.overviewHeaderTitleLeft}>
            <span
              className={styles.overviewHeaderIcon}
              style={{ backgroundColor: detail?.color ?? "#126ee3" }}
            >
              {renderKnowledgeNetworkIcon(detail?.icon)}
            </span>
            <div className={styles.overviewHeaderName}>{detail?.name}</div>
          </div>
          <div className={styles.overviewHeaderTitleRight}>
            <AppButton
              icon={<EditOutlined />}
              onClick={() => {
                setNetworkFormOpen(true);
              }}
            >
              {t("common.edit")}
            </AppButton>
          </div>
        </div>
        <div className={styles.overviewHeaderComment}>
          {detail?.description || t("knowledgeNetwork.noDescription")}
        </div>
        <div className={styles.overviewHeaderFooter}>
          <UserOutlined />
          <span>{t("common.updatedBy")}:</span>
          <span>{detail?.updaterName || "--"}</span>
          <ClockCircleOutlined />
          <span>{t("common.updateTime")}:</span>
          <span>{detail?.updateTime || "--"}</span>
        </div>
      </div>

      <div className={styles.overviewStatRow}>
        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#126ee3" }}
            >
              <DatabaseOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.objectTypes")}</p>
              <p>{detail?.statistics.objectTypesTotal ?? 0}</p>
            </dd>
          </dl>
          <AppButton
            className={styles.overviewStatAction}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${activeNetworkId}/object-types`,
              );
            }}
            type="link"
          >
            {t("knowledgeNetwork.createObjectTypeEntry")}
          </AppButton>
        </div>

        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#08979c" }}
            >
              <ApiOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.relationTypes")}</p>
              <p>{detail?.statistics.relationTypesTotal ?? 0}</p>
            </dd>
          </dl>
          <AppButton
            className={styles.overviewStatAction}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${activeNetworkId}/relation-types`,
              );
            }}
            type="link"
          >
            {t("knowledgeNetwork.createRelationTypeEntry")}
          </AppButton>
        </div>

        <div className={styles.overviewStatCard}>
          <dl className={styles.overviewStatDefinition}>
            <dt
              className={styles.overviewStatIcon}
              style={{ backgroundColor: "#90c06b" }}
            >
              <ThunderboltOutlined />
            </dt>
            <dd>
              <p>{t("knowledgeNetwork.actionTypes")}</p>
              <p>{detail?.statistics.actionTypesTotal ?? 0}</p>
            </dd>
          </dl>
          <AppButton
            className={styles.overviewStatAction}
            icon={<PlusOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${activeNetworkId}/action-types`,
              );
            }}
            type="link"
          >
            {t("knowledgeNetwork.createActionTypeEntry")}
          </AppButton>
        </div>
      </div>

      <div className={styles.overviewContentCard}>
        <h3 className={styles.overviewContentTitle}>
          {t("knowledgeNetwork.recentlyModifiedObjectTypes")}
        </h3>
        <div className={styles.overviewContentBody}>
          <Table<KnowledgeNetworkRecentObject>
            columns={recentObjectColumns}
            dataSource={recentObjects}
            locale={{
              emptyText: (
                <Empty
                  className={styles.tableEmptyState}
                  description={t("knowledgeNetwork.emptyRecentObjects")}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.previewCanvas")}>
        {previewGraph.nodes.length === 0 ? (
          <Empty description={t("knowledgeNetwork.previewEmpty")} />
        ) : (
          <div className={styles.previewCanvas}>
            <div className={styles.previewNodes}>
              {previewGraph.nodes.map((node) => (
                <div className={styles.previewNode} key={node.id}>
                  <span
                    className={styles.previewNodeDot}
                    style={{ backgroundColor: node.color }}
                  />
                  <span>{node.name}</span>
                </div>
              ))}
            </div>
            <div className={styles.previewEdges}>
              {previewGraph.edges.map((edge) => (
                <div className={styles.previewEdge} key={edge.id}>
                  <strong>{edge.name || t("knowledgeNetwork.defaultEdgeName")}</strong>
                  <span>
                    {edge.sourceId} -&gt; {edge.targetId}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const renderConceptGroups = () => (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.conceptGroupsTitle")}>
        <div className={styles.panelToolbar}>
          <Space wrap>
            <AppButton
              icon={<PlusOutlined />}
              onClick={() => {
                setConceptGroupModalMode("create");
                setActiveConceptGroup(null);
                setConceptGroupFormOpen(true);
              }}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
            <AppButton
              icon={<ImportOutlined />}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.importTitle"),
                  content: t("knowledgeNetwork.importPending"),
                });
              }}
            >
              {t("common.import")}
            </AppButton>
          </Space>
          <span className={styles.metaText}>
            {t("knowledgeNetwork.conceptGroupToolbarHint")}
          </span>
        </div>
        <List
          dataSource={conceptGroups}
          locale={{ emptyText: t("knowledgeNetwork.emptyConceptGroups") }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <AppButton
                  key="detail"
                  onClick={() => {
                    setConceptGroupDetailId(item.id);
                  }}
                  type="link"
                >
                  {t("common.detail")}
                </AppButton>,
                <AppButton
                  icon={<EditOutlined />}
                  key="edit"
                  onClick={() => {
                    void (async () => {
                      const detailRecord = await getKnowledgeNetworkConceptGroup(
                        activeNetworkId,
                        item.id,
                      );

                      setActiveConceptGroup(detailRecord);
                      setConceptGroupModalMode("edit");
                      setConceptGroupFormOpen(true);
                    })();
                  }}
                  type="link"
                >
                  {t("common.edit")}
                </AppButton>,
                <AppButton
                  danger
                  icon={<DeleteOutlined />}
                  key="delete"
                  onClick={() => {
                    void modal.confirm({
                      title: t("knowledgeNetwork.conceptGroupDeleteTitle"),
                      content: t(
                        "knowledgeNetwork.conceptGroupDeleteDescription",
                        {
                          name: item.name,
                        },
                      ),
                      cancelText: t("common.cancel"),
                      okButtonProps: { danger: true },
                      okText: t("common.delete"),
                      onOk: async () => {
                        await deleteKnowledgeNetworkConceptGroup(
                          activeNetworkId,
                          item.id,
                        );
                        void message.success(t("common.success"));
                        await reloadConceptGroups();
                      },
                    });
                  }}
                  type="link"
                >
                  {t("common.delete")}
                </AppButton>,
              ]}
            >
              <List.Item.Meta
                description={item.description || t("knowledgeNetwork.noDescription")}
                title={
                  <div className={styles.listTitleRow}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: item.color ?? "#1677ff" }}
                    />
                    <span>{item.name}</span>
                    {(item.tags ?? []).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                }
              />
              <div className={styles.groupStats}>
                <span>
                  {t("knowledgeNetwork.objectTypes")} {item.objectTypesTotal}
                </span>
                <span>
                  {t("knowledgeNetwork.relationTypes")} {item.relationTypesTotal}
                </span>
                <span>
                  {t("knowledgeNetwork.actionTypes")} {item.actionTypesTotal}
                </span>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  const renderObjectTypes = () => (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.objectTypesTitle")}>
        <div className={styles.panelToolbar}>
          <Space wrap>
            <AppButton
              icon={<PlusOutlined />}
              onClick={() => {
                setObjectTypeModalMode("create");
                setActiveObjectType(null);
                setObjectTypeFormOpen(true);
              }}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
            <AppButton
              icon={<ImportOutlined />}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.objectTypeImportTitle"),
                  content: t("knowledgeNetwork.objectTypeImportPending"),
                });
              }}
            >
              {t("common.import")}
            </AppButton>
          </Space>
          <span className={styles.metaText}>
            {t("knowledgeNetwork.objectTypeToolbarHint")}
          </span>
        </div>
        <List
          dataSource={objectTypes}
          locale={{ emptyText: t("knowledgeNetwork.emptyObjectTypes") }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <AppButton
                  key="detail"
                  onClick={() => {
                    setObjectTypeDetailId(item.id);
                  }}
                  type="link"
                >
                  {t("common.detail")}
                </AppButton>,
                <AppButton
                  icon={<EditOutlined />}
                  key="edit"
                  onClick={() => {
                    setActiveObjectType(item);
                    setObjectTypeModalMode("edit");
                    setObjectTypeFormOpen(true);
                  }}
                  type="link"
                >
                  {t("common.edit")}
                </AppButton>,
                <AppButton
                  danger
                  icon={<DeleteOutlined />}
                  key="delete"
                  onClick={() => {
                    void modal.confirm({
                      title: t("knowledgeNetwork.objectTypeDeleteTitle"),
                      content: t(
                        "knowledgeNetwork.objectTypeDeleteDescription",
                        {
                          name: item.name,
                        },
                      ),
                      cancelText: t("common.cancel"),
                      okButtonProps: { danger: true },
                      okText: t("common.delete"),
                      onOk: async () => {
                        await deleteKnowledgeNetworkObjectType(
                          activeNetworkId,
                          item.id,
                        );
                        void message.success(t("common.success"));
                        await reloadObjectTypes();
                      },
                    });
                  }}
                  type="link"
                >
                  {t("common.delete")}
                </AppButton>,
              ]}
            >
              <List.Item.Meta
                description={item.description || t("knowledgeNetwork.noDescription")}
                title={
                  <div className={styles.listTitleRow}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                    {item.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                    {item.hasIndex ? (
                      <Tag color="green">
                        {t("knowledgeNetwork.objectTypeIndexed")}
                      </Tag>
                    ) : (
                      <Tag>{t("knowledgeNetwork.objectTypeNotIndexed")}</Tag>
                    )}
                  </div>
                }
              />
              <div className={styles.groupStats}>
                <span>
                  {t("knowledgeNetwork.objectTypeConceptGroups")}{" "}
                  {item.conceptGroupNames.length}
                </span>
                <span>{t("knowledgeNetwork.updatedBy", { name: item.updaterName })}</span>
                <span>{item.updateTime}</span>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  const renderRelationTypes = () => (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.relationTypesTitle")}>
        <div className={styles.panelToolbar}>
          <Space wrap>
            <AppButton
              icon={<PlusOutlined />}
              onClick={() => {
                setRelationTypeModalMode("create");
                setActiveRelationType(null);
                setRelationTypeFormOpen(true);
              }}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
            <AppButton
              icon={<ImportOutlined />}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.relationTypeImportTitle"),
                  content: t("knowledgeNetwork.relationTypeImportPending"),
                });
              }}
            >
              {t("common.import")}
            </AppButton>
          </Space>
          <span className={styles.metaText}>
            {t("knowledgeNetwork.relationTypeToolbarHint")}
          </span>
        </div>
        <List
          dataSource={relationTypes}
          locale={{ emptyText: t("knowledgeNetwork.emptyRelationTypes") }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <AppButton
                  key="detail"
                  onClick={() => {
                    setRelationTypeDetailId(item.id);
                  }}
                  type="link"
                >
                  {t("common.detail")}
                </AppButton>,
                <AppButton
                  icon={<EditOutlined />}
                  key="edit"
                  onClick={() => {
                    setActiveRelationType(item);
                    setRelationTypeModalMode("edit");
                    setRelationTypeFormOpen(true);
                  }}
                  type="link"
                >
                  {t("common.edit")}
                </AppButton>,
                <AppButton
                  danger
                  icon={<DeleteOutlined />}
                  key="delete"
                  onClick={() => {
                    void modal.confirm({
                      title: t("knowledgeNetwork.relationTypeDeleteTitle"),
                      content: t(
                        "knowledgeNetwork.relationTypeDeleteDescription",
                        {
                          name: item.name,
                        },
                      ),
                      cancelText: t("common.cancel"),
                      okButtonProps: { danger: true },
                      okText: t("common.delete"),
                      onOk: async () => {
                        await deleteKnowledgeNetworkRelationType(
                          activeNetworkId,
                          item.id,
                        );
                        void message.success(t("common.success"));
                        await reloadRelationTypes();
                      },
                    });
                  }}
                  type="link"
                >
                  {t("common.delete")}
                </AppButton>,
              ]}
            >
              <List.Item.Meta
                description={item.description || t("knowledgeNetwork.noDescription")}
                title={
                  <div className={styles.listTitleRow}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                    {item.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                    <Tag color={item.mappingMode === "direct" ? "blue" : "gold"}>
                      {item.mappingMode === "direct"
                        ? t("knowledgeNetwork.relationTypeDirectMapping")
                        : t("knowledgeNetwork.relationTypeDataViewMapping")}
                    </Tag>
                  </div>
                }
              />
              <div className={styles.groupStats}>
                <span>
                  {item.sourceObjectTypeName} → {item.targetObjectTypeName}
                </span>
                <span>{t("knowledgeNetwork.updatedBy", { name: item.updaterName })}</span>
                <span>{item.updateTime}</span>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  const renderActionTypes = () => (
    <div className={styles.sectionGrid}>
      <Card className={styles.panel} title={t("knowledgeNetwork.actionTypesTitle")}>
        <div className={styles.panelToolbar}>
          <Space wrap>
            <AppButton
              icon={<PlusOutlined />}
              onClick={() => {
                setActionTypeModalMode("create");
                setActiveActionType(null);
                setActionTypeFormOpen(true);
              }}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
            <AppButton
              icon={<ImportOutlined />}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.actionTypeImportTitle"),
                  content: t("knowledgeNetwork.actionTypeImportPending"),
                });
              }}
            >
              {t("common.import")}
            </AppButton>
          </Space>
          <span className={styles.metaText}>
            {t("knowledgeNetwork.actionTypeToolbarHint")}
          </span>
        </div>
        <List
          dataSource={actionTypes}
          locale={{ emptyText: t("knowledgeNetwork.emptyActionTypes") }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <AppButton
                  key="detail"
                  onClick={() => {
                    setActionTypeDetailId(item.id);
                  }}
                  type="link"
                >
                  {t("common.detail")}
                </AppButton>,
                <AppButton
                  icon={<EditOutlined />}
                  key="edit"
                  onClick={() => {
                    setActiveActionType(item);
                    setActionTypeModalMode("edit");
                    setActionTypeFormOpen(true);
                  }}
                  type="link"
                >
                  {t("common.edit")}
                </AppButton>,
                <AppButton
                  danger
                  icon={<DeleteOutlined />}
                  key="delete"
                  onClick={() => {
                    void modal.confirm({
                      title: t("knowledgeNetwork.actionTypeDeleteTitle"),
                      content: t("knowledgeNetwork.actionTypeDeleteDescription", {
                        name: item.name,
                      }),
                      cancelText: t("common.cancel"),
                      okButtonProps: { danger: true },
                      okText: t("common.delete"),
                      onOk: async () => {
                        await deleteKnowledgeNetworkActionType(
                          activeNetworkId,
                          item.id,
                        );
                        void message.success(t("common.success"));
                        await reloadActionTypes();
                      },
                    });
                  }}
                  type="link"
                >
                  {t("common.delete")}
                </AppButton>,
              ]}
            >
              <List.Item.Meta
                description={item.description || t("knowledgeNetwork.noDescription")}
                title={
                  <div className={styles.listTitleRow}>
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                    {item.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                    <Tag color="green">
                      {item.actionKind === "create"
                        ? t("knowledgeNetwork.actionTypeKindCreate")
                        : item.actionKind === "update"
                          ? t("knowledgeNetwork.actionTypeKindUpdate")
                          : item.actionKind === "delete"
                            ? t("knowledgeNetwork.actionTypeKindDelete")
                            : t("knowledgeNetwork.actionTypeKindNotify")}
                    </Tag>
                  </div>
                }
              />
              <div className={styles.groupStats}>
                <span>{item.objectTypeName}</span>
                <span>{t("knowledgeNetwork.updatedBy", { name: item.updaterName })}</span>
                <span>{item.updateTime}</span>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  return (
    <section className={styles.workspace}>
      <div className={styles.workspaceHeader}>
        <button
          aria-label={t("common.back")}
          className={styles.workspaceBackButton}
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            void navigate("/knowledge-network");
          }}
          type="button"
        >
          <LeftOutlined />
        </button>
        <div className={styles.workspaceIdentity}>
          <span
            className={styles.workspaceNameIcon}
            style={{ backgroundColor: detail?.color ?? "#1677ff" }}
          >
            {renderKnowledgeNetworkIcon(detail?.icon)}
          </span>
          <h1 className={styles.workspaceNameTitle}>
            {detail?.name ?? t("knowledgeNetwork.workspaceTitle")}
          </h1>
        </div>
      </div>

      <div className={styles.workspaceLayout}>
        <aside className={styles.workspaceSide}>
          <div className={styles.workspaceSidePrimary}>
            <button
              className={section === "overview" ? styles.sideItemActive : styles.sideItem}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${activeNetworkId}/overview`,
                );
              }}
              type="button"
            >
              <span className={styles.sideItemMeta}>
                <AppstoreOutlined />
                <span>{t("knowledgeNetwork.workspaceOverviewShort")}</span>
              </span>
            </button>
            <button
              className={section === "preview" ? styles.sideItemActive : styles.sideItem}
              onClick={() => {
                void navigate(
                  `/knowledge-network/workspace/${activeNetworkId}/preview`,
                );
              }}
              type="button"
            >
              <span className={styles.sideItemMeta}>
                <EyeOutlined />
                <span>{t("knowledgeNetwork.workspacePreviewModeling")}</span>
              </span>
            </button>
            <div className={styles.sideDivider} />
            <div className={styles.sideTitle}>{t("knowledgeNetwork.workspaceResources")}</div>
            {navigationItems
              .filter(
                (item) =>
                  item.key !== "overview" &&
                  item.key !== "preview" &&
                  item.key !== "concept-groups",
              )
              .map((item) => {
                const isActive = item.key === section;

                return (
                  <button
                    className={isActive ? styles.sideItemActive : styles.sideItem}
                    key={item.key}
                    onClick={() => {
                      void navigate(
                        `/knowledge-network/workspace/${activeNetworkId}/${item.key}`,
                      );
                    }}
                    type="button"
                  >
                    <span className={styles.sideItemMeta}>
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <span className={styles.sideItemCount}>{item.count ?? 0}</span>
                  </button>
                );
              })}
          </div>
          <div className={styles.workspaceSideSecondary}>
            <div className={styles.sideDivider} />
            {navigationItems
              .filter((item) => item.key === "concept-groups")
              .map((item) => {
                const isActive = item.key === section;

                return (
                  <button
                    className={isActive ? styles.sideItemActive : styles.sideItem}
                    key={item.key}
                    onClick={() => {
                      void navigate(
                        `/knowledge-network/workspace/${activeNetworkId}/${item.key}`,
                      );
                    }}
                    type="button"
                  >
                    <span className={styles.sideItemMeta}>
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <span className={styles.sideItemCount}>{item.count ?? 0}</span>
                  </button>
                );
              })}
            <button
              className={styles.sideItem}
              onClick={() => {
                void modal.info({
                  title: t("knowledgeNetwork.workspaceTaskManagement"),
                  content: t("knowledgeNetwork.workspaceTaskPending"),
                });
              }}
              type="button"
            >
              <span className={styles.sideItemMeta}>
                <FileTextOutlined />
                <span>{t("knowledgeNetwork.workspaceTaskManagement")}</span>
              </span>
            </button>
          </div>
        </aside>
        <main className={styles.workspaceContent}>
          {loadError ? (
            <Alert message={loadError} showIcon type="error" />
          ) : loading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : section === "preview" ? (
            renderPreview()
          ) : section === "concept-groups" ? (
            renderConceptGroups()
          ) : section === "object-types" ? (
            renderObjectTypes()
          ) : section === "relation-types" ? (
            renderRelationTypes()
          ) : section === "action-types" ? (
            renderActionTypes()
          ) : (
            renderOverview()
          )}
        </main>
      </div>
      <ConceptGroupFormModal
        mode={conceptGroupModalMode}
        onCancel={() => setConceptGroupFormOpen(false)}
        onSubmit={async (values: ConceptGroupMutationPayload) => {
          if (conceptGroupModalMode === "create") {
            await createKnowledgeNetworkConceptGroup(activeNetworkId, values);
          } else if (activeConceptGroup) {
            await updateKnowledgeNetworkConceptGroup(
              activeNetworkId,
              activeConceptGroup.id,
              values,
            );
          }

          setConceptGroupFormOpen(false);
          void message.success(t("common.success"));
          await reloadConceptGroups();
        }}
        open={conceptGroupFormOpen}
        record={activeConceptGroup}
      />
      <ConceptGroupDetailDrawer
        groupId={conceptGroupDetailId}
        networkId={activeNetworkId}
        onClose={() => setConceptGroupDetailId(null)}
        open={Boolean(conceptGroupDetailId)}
      />
      <ObjectTypeFormModal
        conceptGroups={conceptGroups}
        mode={objectTypeModalMode}
        onCancel={() => setObjectTypeFormOpen(false)}
        onSubmit={async (values: KnowledgeNetworkObjectTypeMutationPayload) => {
          if (objectTypeModalMode === "create") {
            await createKnowledgeNetworkObjectType(activeNetworkId, values);
          } else if (activeObjectType) {
            await updateKnowledgeNetworkObjectType(
              activeNetworkId,
              activeObjectType.id,
              values,
            );
          }

          setObjectTypeFormOpen(false);
          void message.success(t("common.success"));
          await reloadObjectTypes();
        }}
        open={objectTypeFormOpen}
        record={activeObjectType}
      />
      <ObjectTypeDetailDrawer
        networkId={activeNetworkId}
        objectTypeId={objectTypeDetailId}
        onClose={() => setObjectTypeDetailId(null)}
        open={Boolean(objectTypeDetailId)}
      />
      <RelationTypeFormModal
        mode={relationTypeModalMode}
        objectTypes={objectTypes}
        onCancel={() => setRelationTypeFormOpen(false)}
        onSubmit={async (values: KnowledgeNetworkRelationTypeMutationPayload) => {
          if (relationTypeModalMode === "create") {
            await createKnowledgeNetworkRelationType(activeNetworkId, values);
          } else if (activeRelationType) {
            await updateKnowledgeNetworkRelationType(
              activeNetworkId,
              activeRelationType.id,
              values,
            );
          }

          setRelationTypeFormOpen(false);
          void message.success(t("common.success"));
          await reloadRelationTypes();
        }}
        open={relationTypeFormOpen}
        record={activeRelationType}
      />
      <RelationTypeDetailDrawer
        networkId={activeNetworkId}
        onClose={() => setRelationTypeDetailId(null)}
        open={Boolean(relationTypeDetailId)}
        relationTypeId={relationTypeDetailId}
      />
      <ActionTypeFormModal
        mode={actionTypeModalMode}
        objectTypes={objectTypes}
        onCancel={() => setActionTypeFormOpen(false)}
        onSubmit={async (values: KnowledgeNetworkActionTypeMutationPayload) => {
          if (actionTypeModalMode === "create") {
            await createKnowledgeNetworkActionType(activeNetworkId, values);
          } else if (activeActionType) {
            await updateKnowledgeNetworkActionType(
              activeNetworkId,
              activeActionType.id,
              values,
            );
          }

          setActionTypeFormOpen(false);
          void message.success(t("common.success"));
          await reloadActionTypes();
        }}
        open={actionTypeFormOpen}
        record={activeActionType}
      />
      <ActionTypeDetailDrawer
        actionTypeId={actionTypeDetailId}
        networkId={activeNetworkId}
        onClose={() => setActionTypeDetailId(null)}
        open={Boolean(actionTypeDetailId)}
      />
      <KnowledgeNetworkFormModal
        mode="edit"
        onCancel={() => setNetworkFormOpen(false)}
        onSubmit={async (values: KnowledgeNetworkMutationPayload) => {
          await updateKnowledgeNetwork(activeNetworkId, values);
          setNetworkFormOpen(false);
          void message.success(t("common.success"));
          await loadWorkspaceData();
        }}
        open={networkFormOpen}
        record={detail}
      />
    </section>
  );
}
