/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  BookOutlined,
  CompressOutlined,
  DeleteOutlined,
  DisconnectOutlined,
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
import { Alert, Checkbox, Dropdown, Empty, Input, Popover, Radio, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  memo,
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
  listObjectTypeResourceFields,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
  ObjectTypeResourceField,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  canBeDisplayKey,
  canBePrimaryKey,
  DATA_PROPERTY_NAME_PATTERN,
  validateObjectTypeDataProperties,
} from "./constants";
import { ObjectTypeDataAttributeFormDrawer } from "./ObjectTypeDataAttributeFormDrawer";
import styles from "./ObjectTypeDataAttributeEditor.module.css";
import { ObjectTypeDataAttributePickModal } from "./ObjectTypeDataAttributePickModal";
import { ObjectTypeResourceSelectModal } from "./ObjectTypeResourceSelectModal";
import { FieldTypeIcon } from "./FieldTypeIcon";
import {
  applyDisplayKeySelection,
  applyPrimaryKeySelection,
  areConnectionsEqual,
  areDataPropertiesEqual,
  areDataSourcesEqual,
  areStringArraysEqualAsSets,
  type ConnectionPoint,
} from "./object-type-data-attribute-editor.utils";

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

const VIEW_PANEL_POS = { x: 150, y: 30 };
const DATA_PANEL_POS = { x: 760, y: 30 };
const PANEL_WIDTH = 360;
const PANEL_HEADER_HEIGHT = 49;
const PANEL_SEARCH_HEIGHT = 57;
const PANEL_ROW_HEIGHT = 52;
const PANEL_EMPTY_HEIGHT = 96;
const CANVAS_MIN_HEIGHT = 560;
const CANVAS_STAGE_WIDTH = 1400;

type KeySelectOption = {
  label: string;
  value: string;
};

type PrimaryKeySelectProps = {
  onChange: (names: string[]) => void;
  options: KeySelectOption[];
  placeholder: string;
  value: string[];
};

type DisplayKeySelectProps = {
  onChange: (name: string) => void;
  options: KeySelectOption[];
  placeholder: string;
  value: string | null;
};

const PrimaryKeyPanel = memo(function PrimaryKeyPanel({
  onChange,
  options,
  placeholder,
  value,
}: PrimaryKeySelectProps) {
  if (options.length === 0) {
    return <div className={styles.keyPanelEmpty}>{placeholder}</div>;
  }

  return (
    <div className={styles.keyPopover}>
      <ul className={styles.keyPanelList}>
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <li key={option.value}>
              <label className={styles.keyPanelItem}>
                <Checkbox
                  checked={checked}
                  onChange={(event) => {
                    const nextValue = event.target.checked
                      ? [...value, option.value]
                      : value.filter((item) => item !== option.value);
                    onChange(nextValue);
                  }}
                />
                <span>{option.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

const DisplayKeyPanel = memo(function DisplayKeyPanel({
  onChange,
  options,
  placeholder,
  value,
}: DisplayKeySelectProps) {
  if (options.length === 0) {
    return <div className={styles.keyPanelEmpty}>{placeholder}</div>;
  }

  return (
    <div className={styles.keyPopover}>
      <Radio.Group
        className={styles.keyPanelRadioGroup}
        onChange={(event) => onChange(String(event.target.value))}
        value={value ?? ""}
      >
        <ul className={styles.keyPanelList}>
          <li key="__none__">
            <Radio value="">{placeholder}</Radio>
          </li>
          {options.map((option) => (
            <li key={option.value}>
              <Radio value={option.value}>{option.label}</Radio>
            </li>
          ))}
        </ul>
      </Radio.Group>
    </div>
  );
});

function isSupportedResourceFieldName(name: string) {
  return !name.startsWith("_") && !name.startsWith("@");
}

function normalizeProperties(properties: ObjectTypeDataProperty[]) {
  return properties.filter((item) => item.name.trim() && item.displayName.trim());
}

function buildMappedPropertiesFromViewFields(
  fields: ObjectTypeResourceField[],
  existingProperties: ObjectTypeDataProperty[] = [],
): ObjectTypeDataProperty[] {
  const existingByName = new Map(existingProperties.map((item) => [item.name, item]));
  const usedExistingNames = new Set<string>();

  const mappedProperties = fields.map((field) => {
    const existing = existingByName.get(field.name);
    if (existing) {
      usedExistingNames.add(existing.name);

      return {
        ...existing,
        incrementalKey: false,
        mappedField:
          existing.type === field.type
            ? {
                displayName: field.displayName,
                name: field.name,
                type: field.type,
              }
            : undefined,
      };
    }

    return {
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
    };
  });

  const preservedProperties = existingProperties
    .filter((item) => !usedExistingNames.has(item.name))
    .map((item) => ({
      ...item,
      incrementalKey: false,
      mappedField: undefined,
    }));

  return [...mappedProperties, ...preservedProperties];
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

  const [viewFields, setViewFields] = useState<ObjectTypeResourceField[]>([]);
  const [selectedViewId, setSelectedViewId] = useState(dataSource?.id ?? "");
  const [pendingViewField, setPendingViewField] = useState<ObjectTypeResourceField | null>(
    null,
  );
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionPoint[]>([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<ObjectTypeDataProperty | undefined>();
  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [primaryKeyPopoverOpen, setPrimaryKeyPopoverOpen] = useState(false);
  const [displayKeyPopoverOpen, setDisplayKeyPopoverOpen] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const validProperties = useMemo(
    () => normalizeProperties(dataProperties),
    [dataProperties],
  );

  const logicNameSet = useMemo(() => new Set(logicPropertyNames), [logicPropertyNames]);

  const selectedResource = useMemo(() => dataSource, [dataSource]);

  const primaryKeyNames = useMemo(
    () => validProperties.filter((item) => item.primaryKey).map((item) => item.name),
    [validProperties],
  );

  const displayKeyName = useMemo(
    () => validProperties.find((item) => item.displayKey)?.name ?? "",
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
      const normalized = nextProperties.map((item) => ({ ...item, incrementalKey: false }));
      const resolvedDataSource = nextDataSource ?? dataSource;

      if (
        areDataPropertiesEqual(dataProperties, normalized) &&
        areDataSourcesEqual(dataSource, resolvedDataSource)
      ) {
        return;
      }

      onChange({
        dataProperties: normalized,
        dataSource: resolvedDataSource,
      });
    },
    [dataProperties, dataSource, onChange],
  );

  const clearPendingViewField = useCallback(() => {
    setPendingViewField(null);
    setAlertMessage((current) =>
      current === t("knowledgeNetwork.objectTypeClickToConnect") ? "" : current,
    );
  }, [t]);

  const loadViewFields = useCallback(
    async (viewId: string) => {
      if (!viewId) {
        setViewFields([]);
        return [];
      }

      const fields = await listObjectTypeResourceFields(networkId, viewId);
      const filteredFields = fields
        .filter((item) => isSupportedResourceFieldName(item.name))
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
      setConnections((current) => (current.length === 0 ? current : []));
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

    setConnections((current) =>
      areConnectionsEqual(current, nextConnections) ? current : nextConnections,
    );
  }, [validProperties]);

  useEffect(() => {
    recalculateConnections();
    const timer = window.setTimeout(() => {
      recalculateConnections();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [recalculateConnections, filteredProperties, filteredViewFields, zoom, pan]);

  const handlePrimaryKeysChange = useCallback(
    (names: string[]) => {
      if (areStringArraysEqualAsSets(names, primaryKeyNames)) {
        return;
      }
      const { changed, nextProperties } = applyPrimaryKeySelection(dataProperties, names);
      if (!changed) {
        return;
      }
      updateProperties(nextProperties);
    },
    [dataProperties, primaryKeyNames, updateProperties],
  );

  const handleDisplayKeyChange = useCallback(
    (name: string) => {
      if (name === displayKeyName) {
        return;
      }
      const { changed, nextProperties } = applyDisplayKeySelection(dataProperties, name);
      if (!changed) {
        return;
      }
      updateProperties(nextProperties);
    },
    [dataProperties, displayKeyName, updateProperties],
  );

  const primaryKeyPopoverContent = useMemo(
    () => (
      <PrimaryKeyPanel
        onChange={handlePrimaryKeysChange}
        options={primaryKeyOptions}
        placeholder={t("knowledgeNetwork.objectTypeKeyNotConfigured")}
        value={primaryKeyNames}
      />
    ),
    [handlePrimaryKeysChange, primaryKeyOptions, primaryKeyNames, t],
  );

  const displayKeyPopoverContent = useMemo(
    () => (
      <DisplayKeyPanel
        onChange={handleDisplayKeyChange}
        options={displayKeyOptions}
        placeholder={t("knowledgeNetwork.objectTypeKeyNotConfigured")}
        value={displayKeyName || null}
      />
    ),
    [displayKeyName, displayKeyOptions, handleDisplayKeyChange, t],
  );

  useEffect(() => {
    const handleResize = () => recalculateConnections();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [recalculateConnections]);

  useEffect(() => {
    if (!pendingViewField) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      clearPendingViewField();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearPendingViewField, pendingViewField]);

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

  const handleSelectResource = async (view: ObjectTypeDataSource) => {
    setSelectedViewId(view.id);
    setPendingViewField(null);
    setResourceModalOpen(false);

    const filteredFields = await loadViewFields(view.id);
    const mappedProperties = buildMappedPropertiesFromViewFields(filteredFields, dataProperties);

    updateProperties(mappedProperties, view);
  };

  const handleClearResource = useCallback(() => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeClearResourceTitle"),
      content: t("knowledgeNetwork.objectTypeClearResourceDescription"),
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
  }, [dataProperties, modal, t, updateProperties]);

  const selectPendingViewField = (field: ObjectTypeResourceField) => {
    if (pendingViewField?.name === field.name) {
      clearPendingViewField();
      return;
    }
    setPendingViewField(field);
    setAlertMessage(t("knowledgeNetwork.objectTypeClickToConnect"));
  };

  const disconnectPropertyMapping = (name: string, event: React.MouseEvent) => {
    event.stopPropagation();
    updateProperties(
      dataProperties.map((item) =>
        item.name === name ? { ...item, mappedField: undefined } : item,
      ),
    );
    void message.success(t("knowledgeNetwork.objectTypeMappingCleared"));
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
    clearPendingViewField();
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
    }));

    updateProperties([{ ...property, incrementalKey: false }, ...nextProperties]);
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
          };
        }

        return {
          ...property,
          incrementalKey: false,
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

  const handleClearAllProperties = useCallback(() => {
    void modal.confirm({
      title: t("knowledgeNetwork.objectTypeClearAllPropertiesTitle"),
      content: t("knowledgeNetwork.objectTypeClearAllPropertiesDescription"),
      cancelText: t("common.cancel"),
      okText: t("common.ok"),
      onOk: () => {
        updateProperties([]);
      },
    });
  }, [modal, t, updateProperties]);

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

  const viewPanelMenu = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "replace",
        label: t("knowledgeNetwork.objectTypeReplaceResource"),
      },
      {
        key: "clear",
        label: t("knowledgeNetwork.objectTypeClearResource"),
      },
    ],
    [t],
  );

  const handleViewPanelMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === "replace") {
        setResourceModalOpen(true);
      }
      if (key === "clear") {
        handleClearResource();
      }
    },
    [handleClearResource],
  );

  const viewPanelMenuConfig = useMemo<MenuProps>(
    () => ({
      items: viewPanelMenu,
      onClick: handleViewPanelMenuClick,
    }),
    [handleViewPanelMenuClick, viewPanelMenu],
  );

  const dataPanelAddMenu = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "add",
        label: t("knowledgeNetwork.objectTypeManualCreateProperty"),
      },
      {
        disabled: !selectedViewId,
        key: "pick",
        label: t("knowledgeNetwork.objectTypeSyncResourceFields"),
      },
    ],
    [selectedViewId, t],
  );

  const handleDataPanelAddMenuClick = useCallback(({ key }: { key: string }) => {
    if (key === "add") {
      setEditingProperty(undefined);
      setDrawerOpen(true);
    }
    if (key === "pick") {
      setPickModalOpen(true);
    }
  }, []);

  const dataPanelAddMenuConfig = useMemo<MenuProps>(
    () => ({
      items: dataPanelAddMenu,
      onClick: handleDataPanelAddMenuClick,
    }),
    [dataPanelAddMenu, handleDataPanelAddMenuClick],
  );

  const dataPanelMoreMenu = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "clearAll",
        label: t("knowledgeNetwork.objectTypeClearAllProperties"),
      },
    ],
    [t],
  );

  const handleDataPanelMoreMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === "clearAll") {
        handleClearAllProperties();
      }
    },
    [handleClearAllProperties],
  );

  const dataPanelMoreMenuConfig = useMemo<MenuProps>(
    () => ({
      items: dataPanelMoreMenu,
      onClick: handleDataPanelMoreMenuClick,
    }),
    [dataPanelMoreMenu, handleDataPanelMoreMenuClick],
  );

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
        <Alert
          banner
          closable
          message={alertMessage}
          onClose={() => {
            if (alertMessage === t("knowledgeNetwork.objectTypeClickToConnect")) {
              clearPendingViewField();
              return;
            }
            setAlertMessage("");
          }}
          type={
            alertMessage === t("knowledgeNetwork.objectTypeClickToConnect") ? "info" : "error"
          }
        />
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
              content={primaryKeyPopoverOpen ? primaryKeyPopoverContent : null}
              destroyOnHidden
              onOpenChange={setPrimaryKeyPopoverOpen}
              open={primaryKeyPopoverOpen}
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
              content={displayKeyPopoverOpen ? displayKeyPopoverContent : null}
              destroyOnHidden
              onOpenChange={setDisplayKeyPopoverOpen}
              open={displayKeyPopoverOpen}
              trigger="click"
            >
              {renderKeyValue(
                validProperties.find((item) => item.name === displayKeyName)?.displayName ??
                  displayKeyName,
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
                  {selectedResource?.name ?? t("knowledgeNetwork.objectTypeResource")}
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
                    <Dropdown menu={viewPanelMenuConfig} trigger={["click"]}>
                      <EllipsisOutlined className={styles.panelActionIcon} />
                    </Dropdown>
                  </>
                ) : (
                  <PlusOutlined
                    className={styles.panelActionIcon}
                    onClick={() => setResourceModalOpen(true)}
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
                        onClick={() => selectPendingViewField(field)}
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
                <Dropdown menu={dataPanelAddMenuConfig} trigger={["click"]}>
                  <PlusOutlined className={styles.panelActionIcon} />
                </Dropdown>
                <Dropdown menu={dataPanelMoreMenuConfig} trigger={["click"]}>
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
                          {property.displayKey ? (
                            <StarFilled className={styles.infoKeyIconTitle} />
                          ) : null}
                          {property.primaryKey ? (
                            <BookOutlined className={styles.infoKeyIconPrimary} />
                          ) : null}
                        </div>
                        <div className={styles.itemIconsActions}>
                          {property.mappedField ? (
                            <Tooltip title={t("knowledgeNetwork.objectTypeClearMapping")}>
                              <DisconnectOutlined
                                className={styles.rowActionIcon}
                                onClick={(event) =>
                                  disconnectPropertyMapping(property.name, event)
                                }
                              />
                            </Tooltip>
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

      <ObjectTypeResourceSelectModal
        networkId={networkId}
        onCancel={() => setResourceModalOpen(false)}
        onOk={(view) => {
          void handleSelectResource(view);
        }}
        open={resourceModalOpen}
        selectedId={selectedViewId}
      />
    </div>
  );
});
