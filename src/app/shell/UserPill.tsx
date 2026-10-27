/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { UserOutlined } from "@ant-design/icons";
import { Dropdown, Popover } from "antd";
import type { MenuProps } from "antd";

type Props = {
  menuItems: MenuProps["items"];
  name: string | null;
  roles: string[];
};

export function UserPill({ menuItems, name, roles }: Props) {
  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={["click"]}>
      <button className="console-user-pill" type="button">
        <span className="console-user-avatar" aria-hidden>
          <UserOutlined />
        </span>
        <span className="console-user-copy">
          <strong title={name ?? undefined}>{name}</strong>
          {roles.length > 0 ? (
            <Popover
              content={
                <div className="console-user-roles-list" role="list">
                  {roles.map((role, index) => (
                    <div key={`${role}-${index}`} role="listitem">
                      {role}
                    </div>
                  ))}
                </div>
              }
              placement="bottomRight"
              trigger="hover"
            >
              <span className="console-user-roles-summary">{roles.join("、")}</span>
            </Popover>
          ) : null}
        </span>
      </button>
    </Dropdown>
  );
}
