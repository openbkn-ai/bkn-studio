/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Settings for the standalone graph viewer (/studio/graph-view.html), loaded before its
// bundle. The build ships this no-op; a deployment replaces the file (helm ConfigMap /
// docker mount) to give the viewer a fixed token, so a page that only shows a graph can be
// opened without a Studio login — for example by an agent client that hands over a link:
//   window.__BKN_GRAPH_VIEW__ = { token: "bak_...", layout: "chain" };
// `layout` is the default the page opens with — force, chain, dagre, radial, circular or grid —
// and a link carrying its own `layout` still wins.
// Without it the viewer takes a `token` query parameter, or the Studio session cookie when
// the browser is already signed in on this host.
window.__BKN_GRAPH_VIEW__ = window.__BKN_GRAPH_VIEW__ || {};
