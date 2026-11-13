/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import type { TFunction } from "i18next";

import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  MAX_PROJECT_PACKAGE_BYTES,
  type ProjectCatalog,
} from "@/modules/bkn-project/types/project";

export const MAX_PACKAGE_MB = Math.floor(MAX_PROJECT_PACKAGE_BYTES / (1024 * 1024));

/** Why managing a project was refused, in words the person can act on. */
export function manageFailureText(t: TFunction, error: unknown, fallbackKey: string) {
  switch (projectErrorCode(error)) {
    case "Project.NotOwner":
      return t("bknProject.manage.notOwner");
    case "Project.NotFound":
      return t("bknProject.manage.notFound");
    case "Project.InvalidName":
      return t("bknProject.create.nameRequired");
    case "Project.ReleasePublishing":
      return t("bknProject.manage.releasePublishing");
    default:
      return requestFailureText(t, error, fallbackKey);
  }
}

export type CatalogMapping = Record<string, string | undefined>;

/**
 * Pairs each package catalog with a catalog of this environment: the one with the same id, else
 * the one with the same name, else none. A pairing already chosen is kept.
 */
export function prefillCatalogMapping(
  packageCatalogs: ProjectCatalog[],
  catalogs: ProjectCatalog[],
  chosen: CatalogMapping = {},
): CatalogMapping {
  const ids = new Set(catalogs.map((catalog) => catalog.id));
  return Object.fromEntries(
    packageCatalogs.map((item) => [
      item.id,
      chosen[item.id] ??
        (ids.has(item.id) ? item.id : catalogs.find((catalog) => catalog.name === item.name)?.id),
    ]),
  );
}

/** Why a package could not be read or imported, in the person's terms. */
export function importFailureText(t: TFunction, error: unknown) {
  switch (projectErrorCode(error)) {
    case "Project.InvalidPackage":
      return t("bknProject.import.errors.invalidPackage");
    case "Project.UnsupportedPackageVersion":
      return t("bknProject.import.errors.unsupportedVersion");
    case "Project.PackageTooLarge":
      return t("bknProject.import.errors.tooLarge", { max: MAX_PACKAGE_MB });
    case "Project.InvalidCatalogMapping":
      return t("bknProject.import.errors.catalogMapping");
    case "Project.CatalogMissing":
      return t("bknProject.import.errors.catalogMissing");
    case "Project.VersioningForbidden":
      return t("bknProject.create.versioningForbidden");
    default:
      // A gateway may refuse a large body before bkn-project reads it.
      if (axios.isAxiosError(error) && error.response?.status === 413) {
        return t("bknProject.import.errors.tooLarge", { max: MAX_PACKAGE_MB });
      }
      return manageFailureText(t, error, "bknProject.import.failed");
  }
}
