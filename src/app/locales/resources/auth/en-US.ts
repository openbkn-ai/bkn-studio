/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const authEnUS = {
  auth: {
    signInSubtitle: "Sign in to access the business knowledge network console",
    signInButton: "Sign in",
    devTokenToggle: "Sign in with a token (dev mode)",
    signInOtherTabTitle: "Another tab is signing in",
    signInOtherTabHint:
      "Finish signing in there, or use the button below to restart the sign-in from this tab.",
    callbackProcessing: "Completing sign-in…",
    callbackErrorTitle: "Sign-in failed",
    backToSignIn: "Back to sign-in",
    logout: "Sign out",
    devTokenAccessRequired: "Enter an access token",
    devTokenTitle: "Development token configuration",
    devTokenDescription:
      "Remote debugging mode is active and mocks are disabled. Paste the Bearer Token from the test environment to access the API after saving.",
    devTokenEnvPrefix: "You can also set",
    devTokenEnvMiddle: "in",
    devTokenEnvSuffix: "and restart the dev server to apply it automatically.",
    devTokenAccessPlaceholder: "Paste access_token without the Bearer prefix",
    devTokenRefreshLabel: "Refresh token (optional)",
    devTokenRefreshPlaceholder: "Optional token used to refresh expired access tokens",
    devTokenSave: "Save and continue",
  },
} as const;
