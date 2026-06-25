import { describe, expect, it } from "vitest";

import {
  buildMetricQueryRequest,
  listSandboxMetrics,
  runMetricQuery,
} from "@/modules/knowledge-network-lab/services/sandbox.lab.service";

// vitest 以 VITE_USE_MOCK=true 运行，指标试算复用 knowledge-network 的 mock 实现。
describe("sandbox metric query (ontology-query)", () => {
  it("builds an ontology-query metric-data request", () => {
    const request = buildMetricQueryRequest("kn-domain-risk", "metric-risk-hit-rate", {
      mode: "instant",
      timeRange: "last_24h",
      limit: 100,
      fillNull: true,
    });
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "/ontology-query/v1/knowledge-networks/kn-domain-risk/metrics/metric-risk-hit-rate/data",
    );
    expect(request.body).toMatchObject({ mode: "instant", time_range: "last_24h", limit: 100 });
  });

  it("lists the network's metrics", async () => {
    const metrics = await listSandboxMetrics("kn-domain-risk");
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0]?.id).toBe("metric-risk-hit-rate");
  });

  it("runs an instant metric query and returns columns + rows", async () => {
    const result = await runMetricQuery("kn-domain-risk", "metric-risk-hit-rate", {
      mode: "instant",
      timeRange: "last_24h",
      limit: 100,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.columns.length).toBeGreaterThan(0);
      expect(result.result.rows.length).toBeGreaterThan(0);
    }
  });

  it("runs a trend metric query", async () => {
    const result = await runMetricQuery("kn-domain-risk", "metric-risk-hit-rate", {
      mode: "trend",
      timeRange: "last_7d",
      limit: 100,
    });
    expect(result.ok).toBe(true);
  });
});
