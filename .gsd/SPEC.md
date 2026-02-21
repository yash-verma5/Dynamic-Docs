# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To provide the ADOC development and integration teams with an interactive, comprehensive, and easy-to-understand architectural document for the Moqui `shipping-aggregator` component. It will serve as the definitive "living" guide on how OFBiz communicates with multiple carriers (Forza, C807, Terminal Express, etc.) through the Moqui plugin pattern.

## Goals
1. Convert the existing plain markdown `ARCHITECTURE.md` into a rich, interactive Docusaurus page.
2. Mirror the successful design pattern established in `adoc-webhooks.md`, utilizing admonitions, tabs, and dynamic components.
3. Build an interactive component (e.g., `CarrierConfigSimulator` or `PayloadSimulator`) that allows developers to visualize how payloads and configurations change based on the selected carrier.

## Non-Goals (Out of Scope)
- Modifying the actual Moqui or OFBiz source code.
- Deploying the site to production (this is strictly local setup and integration into the existing Docusaurus framework).

## Users
- OFBiz and Moqui backend developers at ADOC/HotWax.
- External integration partners needing to understand the unified shipping API payload structures.

## Constraints
- Must be built as a Docusaurus page (Client-side interactivity requires React components via `BrowserOnly`).
- Must utilize existing design system components (`@theme/Tabs`, `@theme/Admonition`).

## Success Criteria
- [ ] `src/pages/shipping-aggregator.md` is fully formatted with Docusaurus Markdown (MDX).
- [ ] At least one interactive React component is created and embedded to simulate carrier differences.
- [ ] Existing Mermaid diagrams correctly render on the page.
- [ ] File successfully builds and has the PDF download capability integrated.
