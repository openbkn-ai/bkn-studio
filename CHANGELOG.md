# Changelog

## Unreleased

- Trace root-service filters now offer explicitly requested, scoped service candidates while preserving exact manual queries and compatibility with older backends.

- Trace details disclose their bounded Span display window, distinguish estimated totals from loaded counts, and separate display truncation from collection gaps. Authorized users can explicitly browse live pages of up to 100 Spans without appending them to the execution graph. Older backends retain a clear limited-view fallback. (#2158)
