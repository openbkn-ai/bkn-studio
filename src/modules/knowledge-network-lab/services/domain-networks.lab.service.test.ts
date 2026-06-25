import { describe, expect, it } from "vitest";

import {
  getDomainNetwork,
  listDomainNetworks,
} from "@/modules/knowledge-network-lab/services/domain-networks.lab.service";

// vitest 以 VITE_USE_MOCK=true 运行，底层复用 knowledge-network 的 mock（真实数据形状）。
describe("domain network adapter (real-backend shape)", () => {
  it("lists networks in a single call with real statistics", async () => {
    const { records } = await listDomainNetworks();
    expect(records.length).toBeGreaterThan(0);

    const risk = records.find((item) => item.id === "kn-domain-risk");
    expect(risk).toBeDefined();
    expect(risk?.slug).toBe("domain_risk_network");
    expect(risk?.stats.objectTypes).toBeGreaterThan(0);
    expect(risk?.domain).toBeTruthy();
  });

  it("loads full ontology with entity props and relation endpoints", async () => {
    const net = await getDomainNetwork("kn-domain-risk");
    expect(net).not.toBeNull();
    expect(net?.entityClasses.length).toBeGreaterThan(0);
    expect(net?.relationClasses.length).toBeGreaterThan(0);

    const order = net?.entityClasses.find((item) => item.key === "ot-risk-order");
    expect(order).toBeDefined();
    // 明细带属性与布局坐标
    expect(order?.props.length).toBeGreaterThan(0);
    expect(typeof order?.x).toBe("number");

    // 关系类两端解析到实体类
    const relation = net?.relationClasses[0];
    expect(relation?.from).toBeTruthy();
    expect(relation?.to).toBeTruthy();
  });

  it("returns null for an unknown network", async () => {
    const net = await getDomainNetwork("does-not-exist");
    expect(net).toBeNull();
  });
});
