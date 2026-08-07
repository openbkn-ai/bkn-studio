/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const authEnUS = {
  auth: {
    signInSubtitle: "Sign in to access the business knowledge network console",
    signInButton: "Sign In",
    devTokenToggle: "Sign in with a token (dev mode)",
    callbackProcessing: "Completing sign-in...",
    callbackErrorTitle: "Sign-in failed",
    backToSignIn: "Back to sign-in",
    logout: "Sign out",
    devTokenAccessRequired: "Enter an Access Token",
    devTokenTitle: "Development Token Configuration",
    devTokenDescription:
      "Remote debugging mode is active and mocks are disabled. Paste the Bearer Token from the test environment to access the API after saving.",
    devTokenEnvPrefix: "You can also set",
    devTokenEnvMiddle: "in",
    devTokenEnvSuffix: "and restart the dev server to apply it automatically.",
    devTokenAccessPlaceholder: "Paste access_token without the Bearer prefix",
    devTokenRefreshLabel: "Refresh Token (optional)",
    devTokenRefreshPlaceholder: "Optional token used to refresh expired access tokens",
    devTokenSave: "Save and Continue",
  },
} as const;
