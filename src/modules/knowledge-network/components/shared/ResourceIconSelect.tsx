import { createFromIconfontCN } from "@ant-design/icons";
import { Input, Select, Space } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import legacyIconList from "./resource-iconfont/dip-iconfont.json";
import iconfontObjectScript from "./resource-iconfont/iconfont-dip-object.js?url";
import styles from "./ResourceIconSelect.module.css";

const { Search } = Input;

const ResourceIconFont = createFromIconfontCN({
  scriptUrl: iconfontObjectScript,
});

type LegacyIconGlyph = {
  font_class: string;
  icon_id: string;
  name: string;
};

const ICON_PREFIX = legacyIconList.css_prefix_text;
const ICON_GLYPHS = legacyIconList.glyphs as LegacyIconGlyph[];

export type ResourceIconValue = string;

export const DEFAULT_RESOURCE_ICON = `${ICON_PREFIX}${ICON_GLYPHS[0].font_class}`;

const COMPAT_ICON_TYPE_BY_VALUE: Record<string, string> = {
  appstore: "icon-yingyongguanli",
  database: "icon-shujuku",
  "deployment-unit": "icon-tubiaozhutu",
  hdd: "icon-fuwuqi",
  "share-alt": "icon-wangluo",
  shop: "icon-dianpu",
  team: "icon-huiyuan",
  user: "icon-user",
};

function resolveIconType(icon?: string) {
  if (!icon) {
    return undefined;
  }

  if (COMPAT_ICON_TYPE_BY_VALUE[icon]) {
    return COMPAT_ICON_TYPE_BY_VALUE[icon];
  }

  if (icon.startsWith("icon-")) {
    return icon;
  }

  return undefined;
}

export function renderResourceIcon(icon?: string, size = 16) {
  const type = resolveIconType(icon) ?? DEFAULT_RESOURCE_ICON;
  return <ResourceIconFont style={{ fontSize: size }} type={type} />;
}

export const RESOURCE_ICON_OPTIONS = ICON_GLYPHS.map((glyph) => ({
  label: glyph.name,
  value: `${ICON_PREFIX}${glyph.font_class}`,
}));

type ResourceIconSelectProps = {
  inModal?: boolean;
  onChange?: (value: string) => void;
  value?: string;
};

export function ResourceIconSelect({
  inModal = true,
  onChange,
  value,
}: ResourceIconSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<React.ComponentRef<typeof Select>>(null);

  const filteredGlyphs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return ICON_GLYPHS;
    }

    return ICON_GLYPHS.filter((glyph) =>
      glyph.name.toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword]);

  useEffect(() => {
    if (!value) {
      onChange?.(DEFAULT_RESOURCE_ICON);
    }
  }, [onChange, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const selectElement = selectRef.current?.nativeElement;

      if (
        open &&
        selectElement &&
        !selectElement.contains(target) &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const displayType = resolveIconType(value) ?? DEFAULT_RESOURCE_ICON;

  const prefix = (
    <Space>
      <ResourceIconFont style={{ fontSize: 16 }} type={displayType} />
    </Space>
  );

  const popupRender = () => (
    <div className={styles.panel} ref={containerRef} tabIndex={-1}>
      <Search
        allowClear
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="输入关键词筛选图标"
        style={{ marginBottom: 8 }}
        value={keyword}
      />
      <div className={styles.iconBox}>
        {filteredGlyphs.map((glyph) => {
          const iconType = `${ICON_PREFIX}${glyph.font_class}`;
          const selected = value === iconType;

          return (
            <button
              className={styles.iconItem}
              key={glyph.icon_id}
              onClick={() => {
                onChange?.(iconType);
                setKeyword("");
                setOpen(false);
              }}
              style={{ color: selected ? "#1677ff" : "#000" }}
              title={glyph.name}
              type="button"
            >
              <ResourceIconFont style={{ fontSize: 20 }} type={iconType} />
              <p className={styles.iconLabel}>{glyph.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Select
      getPopupContainer={() => {
        if (inModal) {
          const modal = document.querySelector(".ant-modal-wrap");
          if (modal) {
            return modal as HTMLElement;
          }
        }

        return document.getElementById("root") ?? document.body;
      }}
      onChange={onChange}
      onOpenChange={setOpen}
      open={open}
      popupRender={popupRender}
      prefix={prefix}
      ref={selectRef}
      style={{ width: "100%" }}
    />
  );
}
