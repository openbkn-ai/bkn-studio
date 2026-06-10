import { Alert, Modal, Select, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { formatCount } from "@/modules/data-catalog/lib/format";
import { previewCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourcePreviewResult,
} from "@/modules/data-catalog/types/data-catalog";

import styles from "./DataPreviewModal.module.css";

type DataPreviewModalProps = {
  onClose: () => void;
  open: boolean;
  resource: CatalogResource;
};

const PAGE_SIZES = [20, 50, 100];

function isNumericType(type: string) {
  const lowered = type.toLowerCase();
  return (
    lowered.startsWith("int") ||
    lowered.startsWith("bigint") ||
    lowered.startsWith("decimal") ||
    lowered.startsWith("numeric") ||
    lowered.startsWith("float") ||
    lowered.startsWith("double")
  );
}

export function DataPreviewModal({ onClose, open, resource }: DataPreviewModalProps) {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(20);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ResourcePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextOffset: number, nextLimit: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await previewCatalogResource(resource.id, {
          limit: nextLimit,
          offset: nextOffset,
        });
        setResult(data);
      } catch (loadError) {
        setError(extractRequestErrorMessage(loadError));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [resource.id],
  );

  useEffect(() => {
    if (open) {
      setOffset(0);
      setPageSize(20);
      void load(0, 20);
    }
  }, [load, open]);

  const total = result?.total ?? 0;
  const rows = result?.rows ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  const changePage = (nextOffset: number) => {
    setOffset(nextOffset);
    void load(nextOffset, pageSize);
  };

  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setOffset(0);
    void load(0, nextSize);
  };

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      title={`${t("dataCatalog.preview.title")} · ${resource.name}`}
      width="min(1240px, calc(100vw - 64px))"
    >
      <div className={styles.metaRow}>
        <span>
          {t("dataCatalog.preview.summary", {
            count: rows.length,
            total: formatCount(total) as never,
          })}
        </span>
        <span className={styles.endpointChip}>
          POST /resources/{resource.id}/data · limit={pageSize} offset={offset}
        </span>
      </div>
      {error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <Spin spinning={loading}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={[styles.rowIndexHead, styles.rowIndex].join(" ")}>#</th>
                  {resource.schema.map((field) => (
                    <th key={field.name}>
                      {field.name}
                      <small>{field.type}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={offset + rowIndex}>
                    <td className={styles.rowIndex}>{offset + rowIndex + 1}</td>
                    {resource.schema.map((field) => {
                      const value = row[field.name];
                      const isNull = value === null || value === undefined;
                      const text = isNull ? "NULL" : String(value);
                      return (
                        <td
                          className={[
                            isNumericType(field.type) ? styles.numericCell : "",
                            isNull ? styles.nullCell : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={field.name}
                        >
                          {text.length > 60 ? (
                            <Tooltip title={text}>
                              <span>{text}</span>
                            </Tooltip>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={resource.schema.length + 1} style={{ textAlign: "center" }}>
                      {t("dataCatalog.preview.empty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Spin>
      )}
      <div className={styles.pagination}>
        <Select
          onChange={changePageSize}
          options={PAGE_SIZES.map((size) => ({
            label: t("dataCatalog.preview.pageSize", { size }),
            value: size,
          }))}
          size="small"
          style={{ width: 110 }}
          value={pageSize}
        />
        <AppButton disabled={!hasPrev || loading} onClick={() => changePage(Math.max(0, offset - pageSize))} size="small">
          {t("dataCatalog.preview.prev")}
        </AppButton>
        <span>
          {formatCount(total === 0 ? 0 : offset + 1)} –{" "}
          {formatCount(Math.min(offset + pageSize, total))}
        </span>
        <AppButton disabled={!hasNext || loading} onClick={() => changePage(offset + pageSize)} size="small">
          {t("dataCatalog.preview.next")}
        </AppButton>
      </div>
    </Modal>
  );
}
