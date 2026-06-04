import { useParams } from "react-router-dom";

import { DataConnectFormScene } from "@/modules/data-connect/scenes/DataConnectFormScene";

type DataConnectFormPageProps = {
  mode: "create" | "edit";
};

export function DataConnectFormPage({ mode }: DataConnectFormPageProps) {
  const { recordId } = useParams<{ recordId: string }>();

  return <DataConnectFormScene mode={mode} recordId={recordId} />;
}
