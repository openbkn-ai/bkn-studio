/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Empty, Input, Space, Table, Typography, type TableProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EventClassFormDrawer } from "@/modules/knowledge-network/components/event-class/EventClassFormDrawer";
import { readEventClassIntent } from "@/modules/knowledge-network/components/event-class/event-class-navigation";
import { knowledgeNetworkReturnState } from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import { describeSchedule } from "@/modules/knowledge-network/components/event-class/event-schedule";
import { useEventClassDelete } from "@/modules/knowledge-network/components/event-class/useEventClassDelete";
import { useKnEventTypes } from "@/modules/knowledge-network/hooks/useKnEventTypes";
import {
  useKnVersioned,
  useKnVersionView,
} from "@/modules/knowledge-network/hooks/useKnVersionView";
import {
  checkKnEventType,
  listKnEventRuleChecks,
} from "@/modules/knowledge-network/services/event-type.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";
import type { KnEventRuleCheck, KnEventType } from "@/modules/knowledge-network/types/event-type";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type EventClassListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  networkId: string;
  /** An event class was saved or deleted: the draft of a versioned network may have changed. */
  onDefinitionsChanged?: () => void;
};

const PREFIX = "knowledgeNetwork.eventClasses";

/**
 * The event classes of a network, under its dynamic model: where their events come from, what they
 * are about, how and when they are recognized, and the last check. Classes are created, edited,
 * deleted and checked here; the object type list only shows them.
 */
export function EventClassListPanel({
  canDelete,
  canModify,
  networkId,
  onDefinitionsChanged,
}: EventClassListPanelProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const location = useLocation();
  const navigate = useNavigate();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const eventTypes = useKnEventTypes(networkId, refreshVersion);
  const eventClassIds = useMemo(() => new Set(eventTypes.byClassId.keys()), [eventTypes.byClassId]);
  const versioned = useKnVersioned(networkId);
  const [versionView] = useKnVersionView(networkId);
  // An event class is written like any definition: on a network without versions, or the draft.
  const writable = !versioned || versionView === "draft";
  const mayModify = canModify && writable;
  const mayDelete = canDelete && writable;
  const [keyword, setKeyword] = useState("");
  const [subjectNames, setSubjectNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [checks, setChecks] = useState<ReadonlyMap<string, KnEventRuleCheck> | null>(null);
  const [checking, setChecking] = useState<string>();
  const [checkTick, setCheckTick] = useState(0);
  const [form, setForm] = useState<{ eventType?: KnEventType; open: boolean }>({ open: false });
  const deleteEventClass = useEventClassDelete();

  useEffect(() => {
    let cancelled = false;
    void listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true })
      .then((items) => {
        if (!cancelled) {
          setSubjectNames(new Map(items.map((item) => [item.id, item.name || item.id])));
        }
      })
      .catch(() => {
        if (!cancelled) setSubjectNames(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, refreshVersion]);

  useEffect(() => {
    let cancelled = false;
    // The last checks need `query_data` on the network; without it they are not shown.
    void listKnEventRuleChecks(networkId)
      .then((entries) => {
        if (!cancelled) setChecks(new Map(entries.map((item) => [item.event_type, item])));
      })
      .catch(() => {
        if (!cancelled) setChecks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [checkTick, networkId, refreshVersion]);

  const changed = () => {
    onDefinitionsChanged?.();
    setRefreshVersion((current) => current + 1);
  };

  const remove = (eventType: KnEventType) => {
    void deleteEventClass(networkId, eventType, { versioned }).then((deleted) => {
      if (deleted) changed();
    });
  };

  const checkNow = async (eventType: KnEventType) => {
    setChecking(eventType.code);
    try {
      // The platform runs the schedule in the background: the answer is that it started.
      await checkKnEventType(networkId, eventType.code);
      void message.success(t(`${PREFIX}.recognition.checkStarted`));
      setCheckTick((current) => current + 1);
    } catch {
      // The request layer has shown why.
    } finally {
      setChecking(undefined);
    }
  };

  // Another page sent the user here to see, edit or delete a class.
  const intent = readEventClassIntent(location.state);
  useEffect(() => {
    if (!intent || eventTypes.loading) return;
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    const eventType = eventTypes.types.find((item) => item.code === intent.code);
    if (!eventType) return;
    setKeyword(eventType.code);
    if (intent.action === "edit" && mayModify) setForm({ eventType, open: true });
    if (intent.action === "delete" && mayDelete) remove(eventType);
    // Handled once: the state is cleared above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.action, intent?.code, eventTypes.loading]);

  const visible = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return eventTypes.types;
    return eventTypes.types.filter(
      (item) => item.name.toLowerCase().includes(text) || item.code.toLowerCase().includes(text),
    );
  }, [eventTypes.types, keyword]);

  const placeholder = <Typography.Text type="secondary">--</Typography.Text>;
  const isRule = (item: KnEventType) => item.source === "rule";
  const recognized = (item: KnEventType) => isRule(item) && Boolean(item.recognition_action_id);

  /** The class's own detail page; its data tab lists the events, one per object a check hit. */
  const openDetail = (item: KnEventType, tab?: "data") =>
    void navigate(
      `/knowledge-network/workspace/${encodeURIComponent(networkId)}/object-types/${encodeURIComponent(item.code)}/detail${tab ? `?tab=${tab}` : ""}`,
      { state: knowledgeNetworkReturnState(`${location.pathname}${location.search}`) },
    );

  const lastCheck = (item: KnEventType) => {
    if (!isRule(item) || !checks) return placeholder;
    const check = checks.get(item.code);
    if (!check) return t(`${PREFIX}.recognition.neverChecked`);
    const when = check.time ? `${formatTimestamp(check.time)} · ` : "";
    if (check.status !== "ok") return `${when}${t(`${PREFIX}.list.lastCheckFailed`)}`;
    const hits = check.hits ?? 0;
    if (!hits) return `${when}${t(`${PREFIX}.recognition.lastCheckOk`, { count: 0 })}`;
    return (
      <span>
        {when}
        <Typography.Link onClick={() => openDetail(item, "data")}>
          {t(`${PREFIX}.recognition.lastCheckOk`, { count: hits })}
        </Typography.Link>
      </span>
    );
  };

  const columns: NonNullable<TableProps<KnEventType>["columns"]> = [
    {
      key: "name",
      title: t(`${PREFIX}.list.name`),
      width: 240,
      render: (_value, item) => (
        <Space direction="vertical" size={0}>
          <Typography.Link onClick={() => openDetail(item)} strong>
            {item.name}
          </Typography.Link>
          <Typography.Text code type="secondary">
            {item.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      key: "source",
      title: t(`${PREFIX}.recognition.source`),
      width: 110,
      render: (_value, item) => t(`${PREFIX}.source.${item.source}`),
    },
    {
      key: "subject",
      title: t(`${PREFIX}.recognition.subject`),
      width: 160,
      render: (_value, item) =>
        item.subject ? (
          <AppButton
            onClick={() =>
              void navigate(
                `/knowledge-network/workspace/${networkId}/object-types/${item.subject}/detail`,
              )
            }
            size="small"
            type="link"
          >
            {subjectNames.get(item.subject) ?? item.subject}
          </AppButton>
        ) : (
          placeholder
        ),
    },
    {
      key: "basis",
      title: t(`${PREFIX}.recognition.basis`),
      width: 120,
      render: (_value, item) =>
        recognized(item) && item.recognition_basis
          ? t(`${PREFIX}.recognition.bases.${item.recognition_basis}`)
          : placeholder,
    },
    {
      key: "schedule",
      title: t(`${PREFIX}.recognition.schedule`),
      width: 180,
      render: (_value, item) =>
        recognized(item) && item.check_schedule
          ? describeSchedule(item.check_schedule.cron, t, item.check_schedule.timezone)
          : placeholder,
    },
    {
      key: "nextCheck",
      title: t(`${PREFIX}.recognition.nextCheck`),
      width: 170,
      render: (_value, item) =>
        recognized(item) && item.next_check_at ? formatTimestamp(item.next_check_at) : placeholder,
    },
    {
      key: "lastCheck",
      title: t(`${PREFIX}.recognition.lastCheck`),
      width: 220,
      render: (_value, item) => lastCheck(item),
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 200,
      fixed: "right",
      render: (_value, item) => (
        <Space size={0} wrap>
          {mayModify ? (
            <AppButton
              onClick={() => setForm({ eventType: item, open: true })}
              size="small"
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          ) : null}
          {mayModify && recognized(item) ? (
            <AppButton
              loading={checking === item.code}
              onClick={() => void checkNow(item)}
              size="small"
              type="link"
            >
              {t(`${PREFIX}.recognition.checkNow`)}
            </AppButton>
          ) : null}
          {mayDelete ? (
            <AppButton danger onClick={() => remove(item)} size="small" type="link">
              {t("common.delete")}
            </AppButton>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <section className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {mayModify && eventTypes.available ? (
              <AppButton
                className={styles.toolbarButton}
                icon={<PlusOutlined />}
                onClick={() => setForm({ open: true })}
                type="primary"
              >
                {t(`${PREFIX}.create`)}
              </AppButton>
            ) : null}
          </div>
          <div className={styles.toolbarRight}>
            <Input
              allowClear
              aria-label={t(`${PREFIX}.list.searchPlaceholder`)}
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t(`${PREFIX}.list.searchPlaceholder`)}
              prefix={<SearchOutlined className={styles.searchIcon} />}
              value={keyword}
            />
          </div>
        </div>
        <div className={styles.tableCard}>
          <Table<KnEventType>
            columns={columns}
            dataSource={visible}
            loading={eventTypes.loading}
            locale={{
              emptyText: (
                <Empty
                  className={styles.emptyPanel}
                  description={
                    eventTypes.available || eventTypes.loading
                      ? t(`${PREFIX}.list.empty`)
                      : t("common.requestFailed")
                  }
                />
              ),
            }}
            pagination={false}
            rowKey="code"
            scroll={{ x: 1400 }}
          />
        </div>
      </section>
      <EventClassFormDrawer
        eventClassIds={eventClassIds}
        eventType={form.eventType}
        networkId={networkId}
        onClose={() => setForm({ open: false })}
        onSaved={() => {
          setForm({ open: false });
          changed();
        }}
        open={form.open}
        versioned={versioned}
      />
    </>
  );
}
