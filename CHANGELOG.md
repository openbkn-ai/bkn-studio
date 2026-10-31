# Changelog

## Unreleased

- Align data-property and logic-property display names with the backend's 128-Unicode-character limit, including visible counts and validation without silent truncation. (#1105)

- Clear the login session when token refresh fails or a refreshed token is rejected, including disabled accounts; ordinary permission denials keep the user signed in.

- Preserve independent Trace HTTP error reasons in shared request handling and local list/detail alerts, retaining shared Error fallback rules and clearing stale errors on retry. (bkn-foundry#2511)

- Trace root-service filters now offer explicitly requested, scoped service candidates while preserving exact manual queries and compatibility with older backends.

- Trace details disclose their bounded Span display window, distinguish estimated totals from loaded counts, and separate display truncation from collection gaps. Authorized users can explicitly browse live pages of up to 100 Spans without appending them to the execution graph. Older backends retain a clear limited-view fallback. (#2158)
