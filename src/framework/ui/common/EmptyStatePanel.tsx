import type { ReactNode } from "react";

import { InboxOutlined } from "@ant-design/icons";

type EmptyStatePanelProps = {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export function EmptyStatePanel({
  action,
  description,
  icon,
  title,
}: EmptyStatePanelProps) {
  return (
    <section className="empty-state-panel">
      <div className="empty-state-illustration" aria-hidden>
        {icon ?? <InboxOutlined />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </section>
  );
}
