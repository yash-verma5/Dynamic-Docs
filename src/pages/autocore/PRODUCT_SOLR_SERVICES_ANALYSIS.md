---
title: ProductSolrServices — God Module Analysis
description: 69 edges, 5 Solr cores, zero fallback — deep-dive into the system's single point of failure.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# ProductSolrServices — God Module Analysis

> **69 edges. 5 Solr cores. Zero fallback. This is the system's single point of failure.**

---

## 1. What Does It Index?

`ProductSolrServices` indexes into **5 distinct Solr cores**, not just one:

| Core | Content | Key Caller |
|---|---|---|
| `globalproducts` | FINISHED_GOOD products — brand, category, pricing, images, vehicle applications (YMM) | `createGlobalProductIndex` |
| `memberproduct` | Member-specific product availability and pricing (store-scoped) | `createMemberProductIndex` |
| `part` | Detailed part metadata for B2B part search | `createPartIndex` |
| `partinterchange` / `interchange` | Cross-reference / OE part interchange data | `createInterchangeIndex` |
| `oepart` | OE (Original Equipment) part numbers | `createOEPartIndex` |

**Important nuance:** Vehicle-to-application fitment (ACES) is denormalized **into** the `globalproducts` and `part` cores as flat fields (Year, Make, Model). There is no separate `fitment` Solr core.

export const coreMapChart = `
flowchart TD
    A[ProductSolrServices] --> B[globalproducts core]
    A --> C[memberproduct core]
    A --> D[part core]
    A --> E[partinterchange / interchange core]
    A --> F[oepart core]

    P[PIESSAXServices] -->|createGlobalProductIndex ×2| A
    DI[DataImportServices] -->|createGlobalProductIndex| A
    PS[ProductServices] -->|addIndexes| A

    A -->|refreshGlobalProductIndex| A
    A -->|refreshMemberProductIndex| A
    A -->|refreshPartIndex| A
    A -->|refreshInterchangeIndex| A

    style A fill:#7C3AED,color:#fff
    style B fill:#1e40af,color:#fff
    style C fill:#1e40af,color:#fff
    style D fill:#1e40af,color:#fff
    style E fill:#1e40af,color:#fff
    style F fill:#1e40af,color:#fff
`;

<ZoomableMermaid chart={coreMapChart} title="5 Solr Core Architecture & Caller Map" />

---

## 2. Which Services Call It Most?

### External callers (outside `ProductSolrServices`):

| Caller | Method invoked | Trigger |
|---|---|---|
| `PIESSAXServices` | `createGlobalProductIndex` (×2) | After SAX parsing of PIES XML, per-product |
| `DataImportServices` | `createGlobalProductIndex` | After every product import from CSVs |
| `ProductServices` | `addIndexes` (globalproducts core) | On ad-hoc product updates |

### Self-callers (inside `ProductSolrServices`):

The module is **heavily self-referential** — bulk re-index methods loop through entity queries and call `createGlobalProductIndex` or `createPartIndex` per record via `dispatcher.runSync`. This is the primary source of its 69-edge count.

Key internal orchestrators:
- `refreshGlobalProductIndex` — full catalog rebuild
- `refreshMemberProductIndex` — member-scoped rebuild  
- `refreshPartIndex` — part core rebuild
- `refreshInterchangeIndex` — interchange core rebuild

---

## 3. What Breaks When ProductSolrServices Is Down?

### 🔴 Immediately broken:

| Feature | Why it breaks |
|---|---|
| **B2C Product Search** | `AutoCoreB2CProductServices` queries `globalproducts` core for all catalog search |
| **SAYT Part Search** | `EpicorSearchServices` queries `saytrecommendations` core directly (no service layer fallback) |
| **Interchange Lookup** | `ProductExportServices` queries `interchange` and `partinterchange` cores directly |
| **Member Catalog** | `memberproduct` queries fail — store-specific pricing unavailable |
| **OE Part Lookup** | `oepart` queries fail |
| **New Product Import** | PIES SAX import calls `createGlobalProductIndex` inline — exceptions propagate back into the import transaction, potentially rolling back the entire product write |

### 🟡 Degraded but not broken:

| Feature | Status |
|---|---|
| **Opticat Fitment Search** | Still works — Opticat is an external HTTP API, not Solr-dependent |
| **Entity DB reads** | Still works — VCDb, PIES entities, party data all live in the RDBMS |
| **Order management** | Still works — OFBiz OMS doesn't depend on these Solr cores |

### 🔴 Critical blast radius: **Solr down = B2C storefront is blind.**

export const blastRadiusChart = `
flowchart TD
    SOLR[💥 Solr DOWN] --> G[globalproducts: DARK]
    SOLR --> M[memberproduct: DARK]
    SOLR --> PA[part: DARK]
    SOLR --> IC[interchange: DARK]
    SOLR --> SA[saytrecommendations: DARK]
    SOLR --> OE[oepart: DARK]

    OPT[💥 Opticat DOWN] --> F[ACES Fitment: DARK]

    G & M & PA & IC & SA & OE & F --> BLIND[🚫 Storefront Returns Nothing]

    style SOLR fill:#dc2626,color:#fff
    style OPT fill:#dc2626,color:#fff
    style BLIND fill:#1f2937,color:#fff
`;

<ZoomableMermaid chart={blastRadiusChart} title="Blast Radius: What Goes Dark When Solr Is Down" />

---

## 4. Is EpicorSearchServices an Alternative Search Path?

**No — and yes.** It's more nuanced:

```
EpicorSearchServices.searchEpicorePartsFromSAYT
  └── IndexingServices.getSolrHost(delegator, "saytrecommendations")
  └── HttpSolrClient (direct, no service layer)
  └── Queries: partNumber, description, brandName fields
```

- **Same Solr infrastructure** — `getSolrHost` resolves from the same `IndexingServices` config.
- **Different core** — `saytrecommendations`, not `globalproducts` or `part`.
- **Different population path** — `saytrecommendations` is populated separately; `ProductSolrServices` does **not** write to it.
- **Different purpose** — SAYT typeahead only. Not a catalog replacement.

If you lose Solr, **both paths fail**. There is no fallback to DB for search.

---

## 5. Refactoring Flags

1. **No circuit breaker**: Every `dispatcher.runSync("createGlobalProductIndex")` call during PIES import is inline and blocking. One Solr timeout cascades into import failure.
2. **No async indexing**: All 69 edges are synchronous `runSync`. A bulk re-index of 100k products is single-threaded.
3. **Dual direct-client pattern**: `PIESSAXServices` and `EpicorSearchServices` bypass `ProductSolrServices` entirely and open raw `HttpSolrClient` connections. This means Solr connection pooling config is scattered across 4+ files.
4. **`saytrecommendations` is an orphan**: No Java service indexes into it via the standard service layer. Its write path is either via a separate process or a NiFi flow — verify this.
