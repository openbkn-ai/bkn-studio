<p align="center">
  <img src="assets/logo/light.png" alt="OpenBKN" />
</p>

# BKN Studio

[中文](README.md) | English

BKN Studio is the unified product workspace for OpenBKN. It provides a visual, collaborative, and delivery-ready frontend for enterprise knowledge networks, data resource governance, model resource management, agent debugging, and platform operations.

It is not a collection of isolated feature pages. It is the unified operating interface for business users, implementation teams, data engineers, and AI engineers. Users can model knowledge networks, connect data resources, build indexes, orchestrate tool capabilities, configure models, and debug runtime behavior in one place.

## Product Positioning

BKN Studio focuses on three core goals:

1. **Make business knowledge modelable**
   Transform business objects, relationships, actions, and concept groups into domain knowledge networks that support query, analysis, agent invocation, and business application development.

2. **Make data resources governable, searchable, and usable**
   Use data connections, data catalogs, resource details, and data indexing capabilities to organize databases and data views into resource knowledge networks that can be understood, searched, and bound to business semantics.

3. **Make platform capabilities configurable, operable, and deliverable**
   Productize OpenBKN backend capabilities through model management, execution factory, and agent debugging modules, reducing the cost of integration, validation, and business delivery.

## Core Business Modules

### Domain Knowledge Network

For business modeling and knowledge organization, BKN Studio supports:

- Managing knowledge networks, object types, relationship types, action types, and concept groups.
- Binding business objects to data resource views and establishing mappings between business semantics and data entities.
- Viewing object type, relationship type, and action type details, including related resource information.
- Validating knowledge network behavior in agent retrieval and tool invocation through the ContextLoader debugging console.

### Data Resource Knowledge Network

For data resource governance and retrieval construction, BKN Studio supports:

- Creating and managing data connections.
- Scanning and maintaining data catalogs, data resources, data views, and resource details.
- Configuring full-text and vector indexes on the data catalog side.
- Viewing index build tasks, build status, failure details, and rebuild operations.
- Providing stable data resource binding sources for domain knowledge networks.

### Execution Factory

For tool capability production and integration, BKN Studio supports:

- Managing operators, tools, toolboxes, and capabilities.
- Importing interface capabilities from OpenAPI or cURL.
- Previewing, debugging, publishing, and exporting tool capabilities.
- Connecting to sandbox runtimes to provide executable tools for agents and business workflows.

### Model Management

For unified operation of large and small models, BKN Studio supports:

- Managing large model and small model configurations.
- Testing connections, setting default models, and viewing model monitoring.
- Managing model authorization and API usage guides.
- Configuring model quotas, quota limits, and user-level usage policies.

### Agent / ContextLoader

For agent debugging and retrieval validation, BKN Studio supports:

- Debugging agent conversations and tool calls.
- Viewing tool invocation processes, latency, token usage, and other runtime information.
- Managing MCP tool lists and API keys.
- Verifying whether knowledge networks, data resources, and model configurations can be correctly used by agents.

## Technology Stack

- React
- TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- CSS Modules
- Vitest
- pnpm

## Local Development

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Default development URL:

```text
http://localhost:8000/studio
```

Common commands:

```bash
corepack pnpm lint
corepack pnpm test -- --run
corepack pnpm build
corepack pnpm check
```

## Installation and Deployment

BKN Studio is installed and deployed together with OpenBKN / BKN Foundry. For installation scripts, deployment parameters, and environment preparation, see the [BKN Foundry deployment guide](https://github.com/openbkn-ai/bkn-foundry/blob/main/deploy/README.zh.md).

## 🤝 Join the Community

Scan the QR code to join the community, get support, report issues, and follow the latest updates:

<p align="center">
  <img src="help/qrcode.png" alt="Join the OpenBKN community" width="260" />
</p>

## License

BKN Studio is part of the OpenBKN project. The authoritative license for components and files is defined by this repository's [LICENSE](LICENSE).

- BKN Studio uses the license file distributed with this repository.
- BKN Foundry and BKN SDK are maintained in separate repositories and are governed by the license files distributed with those repositories.

The license applicable to each file is stated in that file's header.
