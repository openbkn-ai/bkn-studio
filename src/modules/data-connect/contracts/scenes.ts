export type DataConnectListSceneProps = {
  defaultConnectorType?: string;
  defaultKeyword?: string;
  onCreate?: () => void;
  onEdit?: (recordId: string) => void;
  onOpenDetail?: (recordId: string) => void;
  onOpenScans?: (recordId?: string) => void;
};

export type DataConnectFormSceneProps = {
  mode: "create" | "edit";
  recordId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type DataConnectScanSceneProps = {
  catalogId?: string;
  onBackToConnections?: () => void;
  onCatalogIdChange?: (catalogId?: string) => void;
};
