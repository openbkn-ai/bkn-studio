/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const accountEnUS = {
  account: {
    title: "Account",
    description: "View your profile, change your password, and manage API keys.",
    navigation: {
      title: "Account settings",
      backToWorkspace: "Back to workspace",
    },
    sections: {
      profile: {
        title: "Personal information",
        description: "View and maintain your profile and account information.",
      },
      security: {
        title: "Change password",
        description: "Update your login password to keep your account secure.",
      },
      apiKeys: {
        title: "API keys",
        description: "Issue and manage API keys for external systems and agent access.",
      },
    },
    profileSoon: "Profile editing is coming soon.",
    securitySoon: "Self-service password change is coming soon.",
    profile: {
      basicTitle: "Basic info",
      basicHint: "Update your name, email, and phone yourself — takes effect immediately.",
      name: "Name",
      namePlaceholder: "Enter your name",
      nameRequired: "Please enter your name",
      nameMax: "Name must be 255 characters or fewer",
      email: "Email",
      emailPlaceholder: "name@example.com (leave empty to clear)",
      emailInvalid: "Enter a valid bare email address (no display name)",
      telephone: "Phone",
      telephonePlaceholder: "Enter your phone number",
      telephoneMax: "Phone must be 64 characters or fewer",
      submit: "Save changes",
      saved: "Profile updated",
      invalid: "Validation failed, please check and retry",
      saveFailed: "Failed to save. Please try again.",
      accountTitle: "Account info",
      accountHint: "Maintained by an administrator — read-only.",
      account: "Login account",
      accountType: "Account type",
      status: "Status",
      enabled: "Enabled",
      disabled: "Disabled",
      departments: "Departments",
      roles: "Roles",
      updatedAt: "Updated at",
    },
    security: {
      title: "Change password",
      hint: "Takes effect immediately after verifying your current password — no re-login needed.",
      current: "Current password",
      currentPlaceholder: "Enter your current password",
      currentRequired: "Please enter your current password",
      next: "New password",
      nextPlaceholder: "Enter a new password",
      nextRequired: "Please enter a new password",
      nextMin: "New password must be at least 8 characters",
      sameAsOld: "New password must differ from the current one",
      confirm: "Confirm new password",
      confirmPlaceholder: "Re-enter the new password",
      confirmRequired: "Please re-enter the new password",
      mismatch: "The two passwords do not match",
      submit: "Update password",
      success: "Password updated",
      oldWrong: "Current password is incorrect",
      failed: "Failed to change password. Please try again.",
    },
  },
} as const;
