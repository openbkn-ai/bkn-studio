import type { PropsWithChildren } from "react";

export function PageContainer({ children }: PropsWithChildren) {
  return <section className="page-container">{children}</section>;
}

