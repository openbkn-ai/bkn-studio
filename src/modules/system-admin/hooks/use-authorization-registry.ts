/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getAuthorizationRegistry,
  mockAuthorizationRegistry,
  resetAuthorizationRegistryCache,
  type AuthorizationRegistry,
  usesMockAuthorizationRegistry,
} from "@/modules/system-admin/services/authorization-registry.service";

export type CatalogOperationOption = {
  description?: string;
  key: string;
  label: string;
  requires: string[];
};

export function useAuthorizationRegistry() {
  const { i18n, t } = useTranslation();
  const [catalog, setCatalog] = useState<AuthorizationRegistry | undefined>(() =>
    usesMockAuthorizationRegistry ? mockAuthorizationRegistry() : undefined,
  );
  const [error, setError] = useState<unknown>();
  const [requestRevision, setRequestRevision] = useState(0);

  useEffect(() => {
    if (catalog) {
      return;
    }
    let active = true;
    void getAuthorizationRegistry().then(
      (nextCatalog) => {
        if (active) {
          setCatalog(nextCatalog);
        }
      },
      (nextError: unknown) => {
        if (active) {
          setError(nextError);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [catalog, requestRevision]);

  const retryAuthorizationRegistry = useCallback(() => {
    resetAuthorizationRegistryCache();
    setError(undefined);
    setRequestRevision((revision) => revision + 1);
  }, []);

  const operationsForType = useCallback((type: string): CatalogOperationOption[] => {
    const resourceType = catalog?.resourceTypes.find((item) => item.id === type);
    return (resourceType?.operations ?? []).map((operation) => {
      const typeLabelKey = `systemAdmin.resourceCatalog.operations.${type}.${operation.id}`;
      const labelKey = `systemAdmin.resourceCatalog.operations.${operation.id}`;
      const localizedName = i18n.exists(typeLabelKey)
        ? t(typeLabelKey)
        : i18n.exists(labelKey)
          ? t(labelKey)
          : undefined;
      const label = (localizedName ?? operation.name) || operation.id;

      const typeDescriptionKey = `systemAdmin.resourceCatalog.operationDescriptions.${type}.${operation.id}`;
      const description = i18n.exists(typeDescriptionKey)
        ? t(typeDescriptionKey)
        : (operation.description ?? localizedName ?? operation.name) || operation.id;

      return {
        description,
        key: operation.id,
        label,
        requires: operation.requires,
      };
    });
  }, [catalog, i18n, t]);

  const resourceTypeOptions = useCallback((types?: readonly string[]) => {
    const allowed = types ? new Set(types) : undefined;
    return (catalog?.resourceTypes ?? [])
      .filter((resourceType) => !allowed || allowed.has(resourceType.id))
      .map((resourceType) => ({
        label: i18n.exists(`systemAdmin.resourceCatalog.resources.${resourceType.id}`)
          ? t(`systemAdmin.resourceCatalog.resources.${resourceType.id}`)
          : resourceType.name,
        value: resourceType.id,
      }));
  }, [catalog, i18n, t]);

  return {
    catalog,
    catalogError: error,
    // Consumers use this as a "catalog is not ready" guard. Keep authoring
    // controls disabled after an error until the user explicitly retries.
    catalogLoading: !catalog,
    operationsForType,
    resourceTypeOptions,
    retryAuthorizationRegistry,
  };
}
