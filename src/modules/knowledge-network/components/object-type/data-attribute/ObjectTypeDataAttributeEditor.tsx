import {
  BookOutlined,
  CompressOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  InfoCircleFilled,
  MinusOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Empty, Input, Popover, Select, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  DEFAULT_RESOURCE_COLOR,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  renderResourceIcon,
} from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  listObjectTypeDataViewFields,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
  ObjectTypeDataViewField,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  canBeDisplayKey,
  canBeIncrementalKey,
  canBePrimaryKey,
  DATA_PROPERTY_NAME_PATTERN,
  validateObjectTypeDataProperties,
} from "./constants";
import { ObjectTypeDataAttributeFormDrawer } from "./ObjectTypeDataAttributeFormDrawer";
import styles from "./ObjectTypeDataAttributeEditor.module.css";
import { ObjectTypeDataAttributePickModal } from "./ObjectTypeDataAttributePickModal";
import { ObjectTypeDataViewSelectModal } from "./ObjectTypeDataViewSelectModal";
import { FieldTypeIcon } from "./FieldTypeIcon";

type ObjectTypeBasicInfo = {
  color: string;
  icon?: string;
  name: string;
};

type ObjectTypeDataAttributeEditorProps = {
  basicValue: ObjectTypeBasicInfo;
  dataProperties: ObjectTypeDataProperty[];
  dataSource?: ObjectTypeDataSource;
  logicPropertyNames?: string[];
  networkId: string;
  onChange: (value: {
    dataProperties: ObjectTypeDataProperty[];
    dataSource?: ObjectTypeDataSource;
  }) => void;
};

export type ObjectTypeDataAttributeEditorHandle = {
  getDataProperties: () => Promise<{
    dataProperties: ObjectTypeDataProperty[];
    dataSource?: ObjectTypeDataSource;
  }>;
  validateFields: () => Promise<{
    dataProperties: ObjectTypeDataProperty[];
    dataSource?: ObjectTypeDataSource;
  }>;
};

type ConnectionPoint = {
  propertyName: string;
  viewFieldName: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

const VIEW_PANEL_POS = { x: 150, y: 30 };
const DATA_PANEL_POS = { x: 760, y: 30 };
const PANEL_WIDTH = 360;
const PANEL_HEADER_HEIGHT = 49;
const PANEL_SEARCH_HEIGHT = 57;
const PANEL_ROW_HEIGHT = 52;
const PANEL_EMPTY_HEIGHT = 96;
const CANVAS_MIN_HEIGHT = 560;
const CANVAS_STAGE_WIDTH = 1400;

function isSupportedDataViewFieldName(name: string) {
  return !name.startsWith("_") && !name.startsWith("@");
}

function normalizeProperties(properties: ObjectTypeDataProperty[]) {
  return properties.filter((item) => item.name.trim() && item.displayName.trim());
}

function buildMappedPropertiesFromViewFields(
  fields: ObjectTypeDataViewField[],
  existingProperties: ObjectTypeDataProperty[] = [],
): ObjectTypeDataProperty[] {
  const existingByName = new Map(existingProperties.map((item) => [item.name, item]));

  return fields.map((field) => {
    const existing = existingByName.get(field.name);

    return {
      displayKey: existing?.displayKey ?? false,
      displayName: field.displayName,
      incrementalKey: existing?.incrementalKey ?? false,
      mappedField: {
        displayName: field.displayName,
        name: field.name,
        type: field.type,
      },
      name: field.name,
      primaryKey: existing?.primaryKey ?? false,
      type: field.type,
    };
  });
}

export const ObjectTypeDataAttributeEditor = forwardRef<
  ObjectTypeDataAttributeEditorHandle,
  ObjectTypeDataAttributeEditorProps
>(function ObjectTypeDataAttributeEditor(
  {
    basicValue,
    dataProperties,
    dataSource,
    logicPropertyNames = [],
    networkId,
    onChange,
  },
  ref,
) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewHandleRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const propertyHandleRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const [viewFields, setViewFields] = useState<ObjectTypeDataViewField[]>([]);
  const [selectedViewId, setSelectedViewId] = useState(dataSource?.id ?? "");
  const [pendingViewField, setPendingViewField] = useState<ObjectTypeDataViewField | null>(
    null,
  );
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionPoint[]>([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ObjectTypeDataProperty | undefined>();
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [dataViewModalOpen, setDataViewModalOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const validProperties = useMemo(
    () => normalizeProperties(dataProperties),
    [dataProperties],
  );

  const logicNameSet = useMemo(() => new Set(logicPropertyNames), [logicPropertyNames]);

  const selectedDataView = useMemo(() => dataSource, [dataSource]);

  const primaryKeyNames = useMemo(
    () => validProperties.filter((item) => item.primaryKey).map((item) => item.name),
    [validProperties],
  );

  const displayKeyName = useMemo(
    () => validProperties.find((item) => item.displayKey)?.name ?? "",
    [validProperties],
  );

  const incrementalKeyName = useMemo(
    () => validProperties.find((item) => item.incrementalKey)?.name ?? "",
    [validProperties],
  );

  const primaryKeyOptions = useMemo(
    () =>
      validProperties
        .filter((item) => canBePrimaryKey(item.type))
        .map((item) => ({
          label: item.displayName || item.name,
          value: item.name,
        })),
    [validProperties],
  );

  const displayKeyOptions = useMemo(
    () =>
      validProperties
        .filter((item) => canBeDisplayKey(item.type))
        .map((item) => ({
          label: item.displayName || item.name,
          value: item.name,
        })),
    [validProperties],
  );

  const incrementalKeyOptions = useMemo(
    () =>
      validProperties
        .filter((item) => canBeIncrementalKey(item.type))
        .map((item) => ({
          label: item.displayName || item.name,
          value: item.name,
        })),
    [validProperties],
  );

  const filteredViewFields = useMemo(() => {
    const keyword = fieldSearch.trim().toLowerCase();
    if (!keyword) {
      return viewFields;
    }

    return viewFields.filter(
      (item) =>
        item.displayName.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword),
    );
  }, [fieldSearch, viewFields]);

  const filteredProperties = useMemo(() => {
    const keyword = propertySearch.trim().toLowerCase();
    if (!keyword) {
      return dataProperties;
    }

    return dataProperties.filter(
      (item) =>
        item.displayName.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword),
    );
  }, [dataProperties, propertySearch]);

  const updateProperties = useCallback(
    (nextProperties: ObjectTypeDataProperty[], nextDataSource?: ObjectTypeDataSource) => {
      onChange({
        dataProperties: nextProperties,
        dataSource: nextDataSource ?? dataSource,
      });
    },
    [dataSource, onChange],
  );

  const loadViewFields = useCallback(
    async (viewId: string) => {
      if (!viewId) {
        setViewFields([]);
        return [];
      }

      const fields = await listObjectTypeDataViewFields(networkId, viewId);
      const filteredFields = fields
        .filter((item) => isSupportedDataViewFieldName(item.name))
        .map((item) => ({
          ...item,
          name: item.name.replace(/\./g, "_"),
        }));
      setViewFields(filteredFields);
      return filteredFields;
    },
    [networkId],
  );

  useEffect(() => {
    if (dataSource?.id) {
      setSelectedViewId(dataSource.id);
      void loadViewFields(dataSource.id);
    }
  }, [dataSource?.id, loadViewFields]);

  const recalculateConnections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setConnections([]);
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const nextConnections: ConnectionPoint[] = [];

    validProperties.forEach((property) => {
      if (!property.mappedField) {
        return;
      }

      const viewHandle = viewHandleRefs.current[property.mappedField.name];
      const propertyHandle = propertyHandleRefs.current[property.name];
      if (!viewHandle || !propertyHandle) {
        return;
      }

      const viewRect = viewHandle.getBoundingClientRect();
      const propertyRect = propertyHandle.getBoundingClientRect();

      nextConnections.push({
        propertyName: property.name,
        viewFieldName: property.mappedField.name,
        x1: viewRect.left + viewRect.width / 2 - canvasRect.left,
        y1: viewRect.top + viewRect.height / 2 - canvasRect.top,
        x2: propertyRect.left + propertyRect.width / 2 - canvasRect.left,
        y2: propertyRect.top + propertyRect.height / 2 - canvasRect.top,
      });
    });

    setConnections(nextConnections);
  }, [validProperties]);

  useLayoutEffect(() => {
    recalculateConnections();
    const timer = window.setTimeout(() => {
      recalculateConnections();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [recalculateConnections, filteredProperties, filteredViewFields, zoom, pan, dataProperties]);

  useEffect(() => {
    const handleResize = () => recalculateConnections();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [recalculateConnections]);

  useImperativeHandle(
    ref,
    () => ({
      getDataProperties: () =>
        Promise.resolve({
          dataProperties,
          dataSource,
        }),
      validateFields: () =>
        new Promise((resolve, reject) => {
          setFieldSearch("");
          setPropertySearch("");

          const result = validateObjectTypeDataProperties(dataProperties);
          if (!result.valid) {
            setAlertMessage(t(`knowledgeNetwork.${result.messageKey}`));
            reject(new Error(result.messageKey));
            return;
          }

          setAlertMessage("");
          resolve({
            dataProperties: result.value,
            dataSource,
          });
        }),
    }),
    [dataProperties, dataSource, t],
  );

  const handleSelectDataView = async (view: ObjectTypeDataSource) => {
    setSelectedViewId(view.id);
    setPendingViewField(null);
    setDataViewModalOpen(false);

    const filteredFields = await loadViewFields(view.id);
    const mappedProperties = buildMappedPropertiesFromViewFields(filteredFields, dataProperties);
    const manualProperties = dataProperties.filter(
      (item) => !filteredFields.some((field) => field.name === item.name),
    );

    updateProperties([...mappedProperties, ...manualProperties], view);
  };

  const handleClearDataView = () => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeClearDataViewTitle"),
      content: t("knowledgeNetwork.objectTypeClearDataViewDescription"),
      cancelText: t("common.cancel"),
      okText: t("common.ok"),
      onOk: () => {
        setSelectedViewId("");
        setViewFields([]);
        setPendingViewField(null);
        updateProperties(
          dataProperties.map((item) => ({ ...item, mappedField: undefined })),
          undefined,
        );
      },
    });
  };

  const setPrimaryKeys = (names: string[]) => {
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        primaryKey: names.includes(item.name) && canBePrimaryKey(item.type),
      })),
    );
  };

  const setDisplayKey = (name: string) => {
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        displayKey: item.name === name && canBeDisplayKey(item.type),
      })),
    );
  };

  const setIncrementalKey = (name: string) => {
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        incrementalKey: item.name === name && canBeIncrementalKey(item.type),
      })),
    );
  };

  const connectProperty = (property: ObjectTypeDataProperty) => {
    if (logicNameSet.has(property.name)) {
      return;
    }

    if (!pendingViewField) {
      setEditingProperty(property);
      setDrawerOpen(true);
      return;
    }

    if (property.type !== pendingViewField.type) {
      void message.error(t("knowledgeNetwork.objectTypePropertyTypeMismatch"));
      return;
    }

    const duplicated = validProperties.some(
      (item) =>
        item.name !== property.name && item.mappedField?.name === pendingViewField.name,
    );
    if (duplicated) {
      void message.error(t("knowledgeNetwork.objectTypePropertyDuplicateMapping"));
      return;
    }

    updateProperties(
      dataProperties.map((item) =>
        item.name === property.name
          ? {
              ...item,
              mappedField: {
                displayName: pendingViewField.displayName,
                name: pendingViewField.name,
                type: pendingViewField.type,
              },
            }
          : item,
      ),
    );
    setPendingViewField(null);
    setAlertMessage("");
  };

  const handleAddProperty = (property: ObjectTypeDataProperty) => {
    if (dataProperties.some((item) => item.name === property.name)) {
      void message.error(t("knowledgeNetwork.objectTypePropertyDuplicateName"));
      return;
    }
    if (dataProperties.some((item) => item.displayName === property.displayName)) {
      void message.error(t("knowledgeNetwork.objectTypePropertyDuplicateDisplayName"));
      return;
    }

    const nextProperties = dataProperties.map((item) => ({
      ...item,
      displayKey: property.displayKey && item.displayKey ? false : item.displayKey,
      incrementalKey: property.incrementalKey && item.incrementalKey ? false : item.incrementalKey,
    }));

    updateProperties([property, ...nextProperties]);
  };

  const handleUpdateProperty = (property: ObjectTypeDataProperty, previousName: string) => {
    if (
      dataProperties.some(
        (item) => item.name !== previousName && item.displayName === property.displayName,
      )
    ) {
      void message.error(t("knowledgeNetwork.objectTypePropertyDuplicateDisplayName"));
      return;
    }

    const previous = dataProperties.find((item) => item.name === previousName);
    const typeChanged = previous?.type !== property.type;

    updateProperties(
      dataProperties.map((item) => {
        if (item.name !== previousName) {
          return {
            ...item,
            displayKey: property.displayKey && item.displayKey ? false : item.displayKey,
            incrementalKey:
              property.incrementalKey && item.incrementalKey ? false : item.incrementalKey,
          };
        }

        return {
          ...property,
          mappedField: typeChanged ? undefined : property.mappedField ?? item.mappedField,
        };
      }),
    );
  };

  const handleAutoLine = () => {
    let addedCount = 0;
    const nextProperties = dataProperties.map((property) => {
      if (property.mappedField || logicNameSet.has(property.name)) {
        return property;
      }

      const matchedField = viewFields.find(
        (field) =>
          field.name === property.name &&
          field.displayName === property.displayName &&
          field.type === property.type,
      );

      if (!matchedField) {
        return property;
      }

      addedCount += 1;
      return {
        ...property,
        mappedField: {
          displayName: matchedField.displayName,
          name: matchedField.name,
          type: matchedField.type,
        },
      };
    });

    if (addedCount === 0) {
      return;
    }

    updateProperties(nextProperties);
    void message.success(
      t("knowledgeNetwork.objectTypeAutoLineSuccess", { count: addedCount }),
    );
  };

  const handleDeleteProperty = (name: string) => {
    updateProperties(dataProperties.filter((item) => item.name !== name));
  };

  const handlePickAttributes = (fieldNames: string[]) => {
    const existingNames = new Set(dataProperties.map((item) => item.name));
    const pickedFields = viewFields.filter((item) => fieldNames.includes(item.name));
    const nextProperties = [...dataProperties];

    pickedFields.forEach((field) => {
      if (existingNames.has(field.name)) {
        return;
      }

      nextProperties.push({
        displayKey: false,
        displayName: field.displayName,
        incrementalKey: false,
        mappedField: {
          displayName: field.displayName,
          name: field.name,
          type: field.type,
        },
        name: field.name,
        primaryKey: false,
        type: field.type,
      });
    });

    updateProperties(nextProperties);
    setPickModalOpen(false);
  };

  const handleClearAllProperties = () => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeClearAllPropertiesTitle"),
      content: t("knowledgeNetwork.objectTypeClearAllPropertiesDescription"),
      cancelText: t("common.cancel"),
      okText: t("common.ok"),
      onOk: () => {
        updateProperties([]);
      },
    });
  };

  const handleDeletePropertyFromRow = (name: string, event: React.MouseEvent) => {
    event.stopPropagation();
    handleDeleteProperty(name);
  };

  const togglePropertyPrimaryKey = (name: string, event: React.MouseEvent) => {
    event.stopPropagation();
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        primaryKey:
          item.name === name
            ? !item.primaryKey && canBePrimaryKey(item.type)
            : item.primaryKey,
      })),
    );
  };

  const togglePropertyDisplayKey = (name: string, event: React.MouseEvent) => {
    event.stopPropagation();
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        displayKey:
          item.name === name ? !item.displayKey && canBeDisplayKey(item.type) : false,
      })),
    );
  };

  const togglePropertyIncrementalKey = (name: string, event: React.MouseEvent) => {
    event.stopPropagation();
    updateProperties(
      dataProperties.map((item) => ({
        ...item,
        incrementalKey:
          item.name === name
            ? !item.incrementalKey && canBeIncrementalKey(item.type)
            : false,
      })),
    );
  };

  const renderKeyValue = (value: string, emptyText: string) =>
    value ? (
      <span className={styles.infoValue}>{value}</span>
    ) : (
      <span className={styles.infoValueEmpty}>{emptyText}</span>
    );

  const renderInfoHint = (messageKey: string) => (
    <Tooltip title={t(messageKey)}>
      <QuestionCircleOutlined className={styles.infoHintIcon} />
    </Tooltip>
  );

  const viewPanelMenu: MenuProps["items"] = [
    {
      key: "replace",
      label: t("knowledgeNetwork.objectTypeReplaceDataView"),
    },
    {
      key: "clear",
      label: t("knowledgeNetwork.objectTypeClearDataView"),
    },
  ];

  const dataPanelAddMenu: MenuProps["items"] = [
    {
      key: "add",
      label: t("knowledgeNetwork.objectTypeManualCreateProperty"),
    },
    {
      disabled: !selectedViewId,
      key: "pick",
      label: t("knowledgeNetwork.objectTypeSyncDataViewFields"),
    },
  ];

  const dataPanelMoreMenu: MenuProps["items"] = [
    {
      key: "clearAll",
      label: t("knowledgeNetwork.objectTypeClearAllProperties"),
    },
  ];

  const showViewSearch = viewFields.length > 0 || fieldSearch.length > 0;
  const showDataSearch = dataProperties.length > 0 || propertySearch.length > 0;
  const viewPanelHeight =
    PANEL_HEADER_HEIGHT +
    (showViewSearch ? PANEL_SEARCH_HEIGHT : 0) +
    (filteredViewFields.length > 0
      ? filteredViewFields.length * PANEL_ROW_HEIGHT
      : PANEL_EMPTY_HEIGHT);
  const dataPanelHeight =
    PANEL_HEADER_HEIGHT +
    (showDataSearch ? PANEL_SEARCH_HEIGHT : 0) +
    (filteredProperties.length > 0
      ? filteredProperties.length * PANEL_ROW_HEIGHT
      : PANEL_EMPTY_HEIGHT);
  const canvasStageHeight = Math.max(
    CANVAS_MIN_HEIGHT,
    VIEW_PANEL_POS.y + Math.max(viewPanelHeight, dataPanelHeight) + 40,
  );

  return (
    <div className={styles.root}>
      {alertMessage ? (
        <Alert banner closable message={alertMessage} onClose={() => setAlertMessage("")} type="error" />
      ) : null}

      <div className={styles.infoBar}>
        <div className={styles.infoMain}>
          <span
            className={styles.infoIcon}
            style={{ backgroundColor: basicValue.color ?? DEFAULT_RESOURCE_COLOR }}
          >
            {renderResourceIcon(basicValue.icon)}
          </span>
          <span className={styles.infoName}>{basicValue.name}</span>
        </div>
        <div className={styles.infoRight}>
          <div className={styles.infoItem}>
            <BookOutlined className={styles.infoKeyIconPrimary} />
            <span className={styles.infoLabel}>{t("knowledgeNetwork.objectTypePrimaryKey")}</span>
            {renderInfoHint("knowledgeNetwork.objectTypePrimaryKeyTip")}
            <span className={styles.infoLabel}>:</span>
            <Popover
              content={
                <Select
                  allowClear
                  className={styles.keyPopover}
                  mode="multiple"
                  onChange={(value) => setPrimaryKeys(value)}
                  options={primaryKeyOptions}
                  placeholder={t("knowledgeNetwork.objectTypeKeyNotConfigured")}
                  value={primaryKeyNames}
                />
              }
              trigger="click"
            >
              {primaryKeyNames.length > 1 ? (
                <span className={styles.countBadge}>{primaryKeyNames.length}</span>
              ) : (
                renderKeyValue(
                  validProperties.find((item) => item.name === primaryKeyNames[0])?.displayName ??
                    primaryKeyNames[0],
                  t("knowledgeNetwork.objectTypeKeyNotConfigured"),
                )
              )}
            </Popover>
          </div>
          <span className={styles.infoDivider} />
          <div className={styles.infoItem}>
            <StarFilled className={styles.infoKeyIconTitle} />
            <span className={styles.infoLabel}>{t("knowledgeNetwork.objectTypeDisplayKeyShort")}</span>
            {renderInfoHint("knowledgeNetwork.objectTypeDisplayKeyTip")}
            <span className={styles.infoLabel}>:</span>
            <Popover
              content={
                <Select
                  allowClear
                  className={styles.keyPopover}
                  onChange={(value) => setDisplayKey(value ?? "")}
                  options={displayKeyOptions}
                  placeholder={t("knowledgeNetwork.objectTypeKeyNotConfigured")}
                  value={displayKeyName || undefined}
                />
              }
              trigger="click"
            >
              {renderKeyValue(
                validProperties.find((item) => item.name === displayKeyName)?.displayName ??
                  displayKeyName,
                t("knowledgeNetwork.objectTypeKeyNotConfigured"),
              )}
            </Popover>
          </div>
          <span className={styles.infoDivider} />
          <div className={styles.infoItem}>
            <span className={styles.infoKeyIconIncremental} />
            <span className={styles.infoLabel}>{t("knowledgeNetwork.objectTypeIncrementalKeyShort")}</span>
            {renderInfoHint("knowledgeNetwork.objectTypeIncrementalKeyTip")}
            <span className={styles.infoLabel}>:</span>
            <Popover
              content={
                <Select
                  allowClear
                  className={styles.keyPopover}
                  onChange={(value) => setIncrementalKey(value ?? "")}
                  options={incrementalKeyOptions}
                  placeholder={t("knowledgeNetwork.objectTypeKeyNotConfigured")}
                  value={incrementalKeyName || undefined}
                />
              }
              trigger="click"
            >
              {renderKeyValue(
                validProperties.find((item) => item.name === incrementalKeyName)?.displayName ??
                  incrementalKeyName,
                t("knowledgeNetwork.objectTypeKeyNotConfigured"),
              )}
            </Popover>
          </div>
        </div>
      </div>

      <div
        className={styles.canvas}
        onMouseDown={(event) => {
          if (event.button !== 0 || event.target !== event.currentTarget) {
            return;
          }
          setIsPanning(true);
          panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
          };
        }}
        onMouseLeave={() => setIsPanning(false)}
        onMouseMove={(event) => {
          if (!isPanning) {
            return;
          }
          setPan({
            x: panStartRef.current.panX + event.clientX - panStartRef.current.x,
            y: panStartRef.current.panY + event.clientY - panStartRef.current.y,
          });
        }}
        onMouseUp={() => setIsPanning(false)}
        ref={canvasRef}
      >
        <svg
          className={styles.connectionLayer}
          style={{ height: canvasStageHeight, width: CANVAS_STAGE_WIDTH }}
        >
          {connections.map((item) => {
            const connectionId = `${item.viewFieldName}::${item.propertyName}`;
            const midX = (item.x1 + item.x2) / 2;
            const path = `M ${item.x1} ${item.y1} C ${midX} ${item.y1}, ${midX} ${item.y2}, ${item.x2} ${item.y2}`;
            return (
              <path
                className={
                  hoveredConnection === connectionId
                    ? `${styles.connectionLine} ${styles.connectionLineHover}`
                    : styles.connectionLine
                }
                d={path}
                key={connectionId}
                onMouseEnter={() => setHoveredConnection(connectionId)}
                onMouseLeave={() => setHoveredConnection(null)}
              />
            );
          })}
        </svg>

        <div
          className={styles.canvasViewport}
          ref={viewportRef}
          style={{
            height: canvasStageHeight,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: CANVAS_STAGE_WIDTH,
          }}
        >
          <div
            className={styles.panelNode}
            style={{ left: VIEW_PANEL_POS.x, top: VIEW_PANEL_POS.y, width: PANEL_WIDTH }}
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleBox}>
                <span className={`${styles.panelIcon} ${styles.panelIconView}`}>
                  <TableOutlined />
                </span>
                <span className={styles.panelTitle}>
                  {selectedDataView?.name ?? t("knowledgeNetwork.objectTypeDataView")}
                </span>
                <span className={styles.panelCount}>{viewFields.length}</span>
              </div>
              <div className={styles.panelActions}>
                {viewFields.length > 0 ? (
                  <>
                    <Tooltip title={t("knowledgeNetwork.objectTypeSmartMatchingConnection")}>
                      <NodeIndexOutlined
                        className={styles.panelActionIcon}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAutoLine();
                        }}
                      />
                    </Tooltip>
                    <Dropdown
                      menu={{
                        items: viewPanelMenu,
                        onClick: ({ key }) => {
                          if (key === "replace") {
                            setDataViewModalOpen(true);
                          }
                          if (key === "clear") {
                            handleClearDataView();
                          }
                        },
                      }}
                      trigger={["click"]}
                    >
                      <EllipsisOutlined className={styles.panelActionIcon} />
                    </Dropdown>
                  </>
                ) : (
                  <PlusOutlined
                    className={styles.panelActionIcon}
                    onClick={() => setDataViewModalOpen(true)}
                  />
                )}
              </div>
            </div>

            {showViewSearch ? (
              <div className={styles.panelSearch}>
                <Input
                  allowClear
                  onChange={(event) => setFieldSearch(event.target.value)}
                  placeholder={t("knowledgeNetwork.objectTypeSearchProperty")}
                  suffix={<SearchOutlined />}
                  value={fieldSearch}
                />
              </div>
            ) : null}

            {viewFields.length > 0 ? (
              <div className={styles.panelContent}>
                {filteredViewFields.length > 0 ? (
                  filteredViewFields.map((field) => {
                    const isActive = pendingViewField?.name === field.name;
                    const isMapped = validProperties.some(
                      (item) => item.mappedField?.name === field.name,
                    );
                    return (
                      <div
                        className={[
                          styles.panelItem,
                          styles.panelItemView,
                          isActive ? styles.panelItemHighlighted : "",
                          isMapped ? styles.panelItemMapped : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={field.name}
                        onClick={() => {
                          setPendingViewField(field);
                          setAlertMessage(t("knowledgeNetwork.objectTypeClickToConnect"));
                        }}
                      >
                        <div className={styles.itemContent}>
                          <FieldTypeIcon type={field.type} />
                          <div>
                            <div className={styles.itemName}>{field.displayName}</div>
                            <div className={styles.itemTechName}>{field.name}</div>
                          </div>
                        </div>
                        <span
                          className={`${styles.panelHandle} ${styles.panelHandleRight}`}
                          ref={(node) => {
                            viewHandleRefs.current[field.name] = node;
                          }}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.panelEmpty}>
                    <Empty description={t("knowledgeNetwork.objectTypePropertySearchEmpty")} />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div
            className={styles.panelNode}
            style={{ left: DATA_PANEL_POS.x, top: DATA_PANEL_POS.y, width: PANEL_WIDTH }}
          >
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleBox}>
                <span
                  className={styles.panelIcon}
                  style={{ backgroundColor: basicValue.color ?? DEFAULT_RESOURCE_COLOR, borderRadius: 4, color: "#fff", fontSize: 14, height: 20, width: 20 }}
                >
                  {renderResourceIcon(basicValue.icon)}
                </span>
                <span className={styles.panelTitle}>{basicValue.name}</span>
                <span className={styles.panelCount}>{validProperties.length}</span>
              </div>
              <div className={styles.panelActions}>
                <Dropdown
                  menu={{
                    items: dataPanelAddMenu,
                    onClick: ({ key }) => {
                      if (key === "add") {
                        setEditingProperty(undefined);
                        setDrawerOpen(true);
                      }
                      if (key === "pick") {
                        setPickModalOpen(true);
                      }
                    },
                  }}
                  trigger={["click"]}
                >
                  <PlusOutlined className={styles.panelActionIcon} />
                </Dropdown>
                <Dropdown
                  menu={{
                    items: dataPanelMoreMenu,
                    onClick: ({ key }) => {
                      if (key === "clearAll") {
                        handleClearAllProperties();
                      }
                    },
                  }}
                  trigger={["click"]}
                >
                  <EllipsisOutlined className={styles.panelActionIcon} />
                </Dropdown>
              </div>
            </div>

            {showDataSearch ? (
              <div className={styles.panelSearch}>
                <Input
                  allowClear
                  onChange={(event) => setPropertySearch(event.target.value)}
                  placeholder={t("knowledgeNetwork.objectTypeSearchProperty")}
                  suffix={<SearchOutlined />}
                  value={propertySearch}
                />
              </div>
            ) : null}

            {dataProperties.length > 0 ? (
              <div className={styles.panelContent}>
                {filteredProperties.length > 0 ? (
                  filteredProperties.map((property) => {
                    const isMapped = Boolean(property.mappedField);
                    const hasInvalidName =
                      Boolean(property.name) && !DATA_PROPERTY_NAME_PATTERN.test(property.name);
                    return (
                      <div
                        className={[
                          styles.panelItem,
                          isMapped ? styles.panelItemMapped : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={property.name || property.displayName}
                        onClick={() => connectProperty(property)}
                      >
                        <span
                          className={`${styles.panelHandle} ${styles.panelHandleLeft}`}
                          ref={(node) => {
                            if (property.name) {
                              propertyHandleRefs.current[property.name] = node;
                            }
                          }}
                        />
                        <div className={styles.itemContent}>
                          <FieldTypeIcon type={property.type} />
                          <div>
                            <div className={styles.itemName}>
                              {property.displayName || property.name || "-"}
                            </div>
                            <div className={styles.itemTechName}>
                              <span>{property.name || "-"}</span>
                              {hasInvalidName ? (
                                <Tooltip
                                  title={t("knowledgeNetwork.objectTypeDataPropertyNamePattern")}
                                >
                                  <InfoCircleFilled className={styles.invalidNameIcon} />
                                </Tooltip>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      <div className={styles.itemIcons}>
                        <div className={styles.itemIconsStatus}>
                          {property.incrementalKey ? (
                            <span className={styles.infoKeyIconIncremental} />
                          ) : null}
                          {property.displayKey ? (
                            <StarFilled className={styles.infoKeyIconTitle} />
                          ) : null}
                          {property.primaryKey ? (
                            <BookOutlined className={styles.infoKeyIconPrimary} />
                          ) : null}
                        </div>
                        <div className={styles.itemIconsActions}>
                          {canBeIncrementalKey(property.type) ? (
                            <span
                              className={
                                property.incrementalKey
                                  ? styles.rowActionIconActiveIncremental
                                  : styles.rowActionIcon
                              }
                              onClick={(event) =>
                                togglePropertyIncrementalKey(property.name, event)
                              }
                              style={{
                                background: property.incrementalKey ? "#52c41a" : "transparent",
                                border: property.incrementalKey
                                  ? "none"
                                  : "1px solid rgba(0,0,0,0.25)",
                                borderRadius: "50%",
                                display: "inline-block",
                                height: 10,
                                width: 10,
                              }}
                            />
                          ) : null}
                          {canBeDisplayKey(property.type) ? (
                            property.displayKey ? (
                              <StarFilled
                                className={styles.rowActionIconActiveTitle}
                                onClick={(event) =>
                                  togglePropertyDisplayKey(property.name, event)
                                }
                              />
                            ) : (
                              <StarOutlined
                                className={styles.rowActionIcon}
                                onClick={(event) =>
                                  togglePropertyDisplayKey(property.name, event)
                                }
                              />
                            )
                          ) : null}
                          {canBePrimaryKey(property.type) ? (
                            <BookOutlined
                              className={
                                property.primaryKey
                                  ? styles.rowActionIconActivePrimary
                                  : styles.rowActionIcon
                              }
                              onClick={(event) => togglePropertyPrimaryKey(property.name, event)}
                            />
                          ) : null}
                          <DeleteOutlined
                            className={styles.rowActionIcon}
                            onClick={(event) => handleDeletePropertyFromRow(property.name, event)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                  })
                ) : (
                  <div className={styles.panelEmpty}>
                    <Empty description={t("knowledgeNetwork.objectTypePropertySearchEmpty")} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.canvasControls}>
          <button
            aria-label="zoom in"
            className={styles.canvasControlButton}
            onClick={() => setZoom((current) => Math.min(2, current + 0.1))}
            type="button"
          >
            <PlusOutlined />
          </button>
          <button
            aria-label="zoom out"
            className={styles.canvasControlButton}
            onClick={() => setZoom((current) => Math.max(0.3, current - 0.1))}
            type="button"
          >
            <MinusOutlined />
          </button>
          <button
            aria-label="fit view"
            className={styles.canvasControlButton}
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            type="button"
          >
            <CompressOutlined />
          </button>
        </div>
      </div>

      <ObjectTypeDataAttributeFormDrawer
        onClose={() => {
          setDrawerOpen(false);
          setEditingProperty(undefined);
        }}
        onSubmit={(value) => {
          if (editingProperty) {
            handleUpdateProperty(value, editingProperty.name);
            return;
          }
          handleAddProperty(value);
        }}
        open={drawerOpen}
        property={editingProperty}
      />

      <ObjectTypeDataAttributePickModal
        fields={viewFields}
        onCancel={() => setPickModalOpen(false)}
        onOk={handlePickAttributes}
        open={pickModalOpen}
      />

      <ObjectTypeDataViewSelectModal
        networkId={networkId}
        onCancel={() => setDataViewModalOpen(false)}
        onOk={(view) => {
          void handleSelectDataView(view);
        }}
        open={dataViewModalOpen}
        selectedId={selectedViewId}
      />
    </div>
  );
});
