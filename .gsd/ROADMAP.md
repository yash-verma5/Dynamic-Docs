# ROADMAP.md

> **Current Phase**: Finalized
> **Milestone**: v1.0

## Must-Haves (from SPEC)
- [x] Add `shipping-aggregator.md` to the site (`src/pages`).
- [x] Include native Mermaid diagrams for the architecture flows.
- [x] Include interactive Tabs/Admonitions for easier reading.
- [x] Create a `CarrierConfigSimulator` React component.
- [x] Ensure PDF download functionality works for the new page.

## Phases

### Phase 1: Foundation
**Status**: ✅ Complete
**Objective**: Setup the core markdown file and copy the base content.
**Requirements**: Move `ARCHITECTURE.md` to `src/pages/shipping-aggregator.md` with standard frontmatter and structural admoitions.

### Phase 2: Core Interactivity
**Status**: ✅ Complete
**Objective**: Develop the interactive `CarrierConfigSimulator`.
**Requirements**: Build a component that swaps JSON configurations (Forza, C807, Terminal Express) in a live CodeBlock.

### Phase 3: Integration
**Status**: ✅ Complete
**Objective**: Embed interactive elements and verify PDF downloads.
**Requirements**: Place the Simulator in the `.md` file, wrap the content for `DownloadPdfWrapper`, and format Tabs.
