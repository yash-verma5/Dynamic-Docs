---
title: PIM PIES XML Import Technical Trace
hide_table_of_contents: false
view_mode: full
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import PimBackButton from '@site/src/components/PimBackButton';

<PimBackButton />

export const pipelineChart = `
flowchart TD
    A[Stage 1: uploadAndImportFile] -->|File Upload & Scheduling| B[Stage 2: importDataFromSAXParser]
    B -->|Config Resolution & Flags| C[Stage 3: importPIESSAX]
    C -->|Init Parser & Scorecards| D[Stage 4: SaxHandler]
    D -->|Streaming Event Parse| E[Stage 5: storePIESItemSegmentSAX]
    
    style A fill:#111,stroke:#ff0000,stroke-width:2px,color:#ffd700
    style B fill:#111,stroke:#ff0000,stroke-width:2px,color:#ffd700
    style C fill:#111,stroke:#ff0000,stroke-width:2px,color:#ffd700
    style D fill:#111,stroke:#ff0000,stroke-width:2px,color:#ffd700
    style E fill:#111,stroke:#ff0000,stroke-width:4px,color:#fff
`;

export const ingestionSequenceChart = `
sequenceDiagram
    participant Sax as SaxHandler
    participant Val as Header Validation
    participant Item as Item Update
    participant Seg as Segment Processing
    participant Hist as Item History

    Sax->>Val: Dispatch storePIESItemSegmentSAX
    activate Val
    Val->>Val: Validate Mandatory Fields & Alliances
    Val->>Val: Lookup Canonical Item
    Val-->>Item: Validation Passed
    deactivate Val
    
    activate Item
    Item->>Item: Field Matching & Delta Tracking
    Item->>Item: Execute updateItem (if mutated)
    Item-->>Seg: Proceed to Segments
    deactivate Item
    
    activate Seg
    Seg->>Seg: storeEXPIs
    Seg->>Seg: storeDescriptions
    Seg->>Seg: storeProductAttributes
    Seg->>Seg: storeDigitalAssets
    Seg->>Seg: storePartInterchanges
    Seg->>Seg: storePackages
    Seg->>Seg: storePricings
    Seg-->>Hist: Segments Complete
    deactivate Seg
    
    activate Hist
    Hist->>Hist: createItemHistory
    Hist-->>Sax: Transaction Complete
    deactivate Hist
`;

export const loggingFlowChart = `
stateDiagram-v2
    [*] --> Init
    Init --> Metrics : Create DataManagerLog (SERVICE_PENDING)
    Metrics --> Scorecard : Store TOTAL_ITEM stats
    Scorecard --> ErrorHandling : Generate Brand/GTIN stats
    ErrorHandling --> NiFiExport : Log Exceptions to CSV (Not DB)
    NiFiExport --> [*] : Trigger Apache NiFi Sync (if enabled)
`;

# 🚀 PIM PIES XML Import Technical Trace

This document traces the technical implementation of the PIES XML import pipeline within the PIM ecosystem, focusing on the five-stage pipeline from file upload to database persistence.

## Technical Summary

The PIES import uses a SAX-based event-driven architecture to parse and process large XML product catalogs efficiently.

### 1. Architectural Choice: SAX vs. DOM
- **Performance:** SAX (Simple API for XML) is a **streaming parser**.
- **Memory Footprint:** Designed to handle very large PIES files without loading the entire XML tree into memory, mitigating `OutOfMemoryError` risks during peak loads.

---

### 2. End-to-End Pipeline Architecture
The pipeline consists of five tightly coupled stages:

<ZoomableMermaid chart={pipelineChart} title="End-to-End Import Pipeline" />

| Stage | Service / Class | Responsibility |
|-------|-----------------|----------------|
| 1 | `uploadAndImportFile` | File upload via multipart request, MIME type detection (Apache Tika), `DataManagerLog` creation, and async/sync job scheduling. |
| 2 | `importDataFromSAXParser`| Config-based resolution (e.g., config `IMPORT_PIES_DATA`), forwards import flags, handles final status updates, and NiFi auto-export. |
| 3 | `importPIESSAX` | Initializes SAX parser, sets up detailed scorecard tracking structures, tallies final results, generates Error CSV and triggers image SFTP jobs. |
| 4 | `SaxHandler` | Event-driven XML streaming parse. Accumulates tags into structured maps (e.g., `itemMap`) and dispatches per-item execution. |
| 5 | `storePIESItemSegmentSAX`| Per-item validation, DB writes, and segment processing delegation (Pricing, Descriptions, Assets, etc.). |

---

### 3. Transaction Boundary & Execution
- **Granularity:** Each `<Item>` block is executed in its **own unique transaction**.
- **Evidence:** `SaxHandler` dispatches `dispatcher.runSync("storePIESItemSegmentSAX", itemMap, 72000, Boolean.TRUE)`. The `TRUE` flag enforces a new transaction for every single item, ensuring isolation. The `72000` is the timeout in seconds (~20 hours) per item to accommodate large image downloads via SFTP.
- **Keep-Alive:** Every 500 items, the handler runs a dummy query against `DataManagerConfig` to prevent MySQL `wait_timeout` from closing the persistent DB connection during long imports.

### 4. Failure Handling & Rollback
- **Failure Sensitivity:** The import is **non-atomic at the file level**.
- **Scenario:** If a specific item encounters a fatal validation error or throws a `GenericServiceException`:
    1. The exception is caught.
    2. The item transaction is rolled back.
    3. The error is appended to the `errorRecordsAsCSV` list.
    4. The parser **continues** seamlessly to the next `<Item>`.
- **Image Import Errors:** Image fetching failures via SFTP are explicitly non-fatal and do not abort item processing.

### 5. Import Modes
- **Standard:** Creates or updates records processing all 7 PIES segment types.
- **Replace (`toReplace=true`):** Calls `removePIESItemSegment` to wipe existing item data before re-importing fresh data.
- **Image / Root Image (`imageImport=true` or `rootImageImport=true`):** Specifically bypasses standard processing to handle digital asset segments exclusively via internal SFTP servers.

---

## Global Product Ingestion Sequence (`storePIESItemSegmentSAX`)

Inside a single item transaction, the following sequential execution occurs:

<ZoomableMermaid chart={ingestionSequenceChart} title="Global Product Ingestion Sequence" />

### 1. Header Validation & Identity Lookup
- **Mandatory Fields:** Hard validates presence of `brandAaiaId`, `partTerminologyId`, and `partNumber`.
- **Reference Validation:** Checks `brandAaiaId` against `ProductCategory` (`AAIA_BRAND` type) and `partTerminologyId` against the `Parts` reference table.
- **Alliance Brands:** Uses `isAllianceBrand()` logic. For Alliance partners (e.g., DMKW, HBTM), `subBrandAaiaId` is mandatory to guarantee uniqueness alongside part number.
- **Lookup:** Locates the canonical master item using `cleanPartNumber` + `brandAaiaId` (+ `subBrandAaiaId` if applicable).
- **INTC Conversion:** Identifies and tracks if the item was previously imported via National Part Catalog (source="INTC") and is now being promoted to full PIES.

### 2. Item Creation / Update
- **Field Matching:** Validates field sizes, parses dates, and sanitizes numeric values (e.g., `itemQuantitySize`).
- **Delta Tracking:** Iterates over the `Item` entity model. If an existing record matches the incoming data, it's counted as "skipped". Only mutated fields are submitted to the `updateItem` service.
- **Counters:** Aggregates metrics for the scorecard (Added, Updated, Removed, Skipped).

### 3. Segment Processing
Following header committal, data enrichment segments execute sequentially. A failure in one halts the item processing.

| Service | PIES Segment | Action |
|---|---|---|
| `storeEXPIs` | `<ExtendedProductInformation>` | Stores EXPI key-value pairs. |
| `storeDescriptions` | `<Descriptions>` | Item descriptions like DES (Description), SHO (Short), MKT (Marketing). |
| `storeProductAttributes` | `<ProductAttributes>` | First checks `attribute.alliance.import.enable` to generate custom Alliance attributes, then stores standard attributes. |
| `storeDigitalAssets` | `<DigitalAssets>` | Handles URL-based assets. Automatically attaches `aca_DefaultThumbnail` / `aca_DefaultImage` if Alliance defaults exist. |
| `storePartInterchanges` | `<PartInterchangeInfo>` | Cross-references and competitive interchanges. |
| `storePackages` | `<Packages>` | Dimension, weights, and UOM storage. |
| `storePricings` | `<Pricing>` | Price sheets and dynamic price types. |

*(Note: If `imageImport` is active, it skips all segments and directly invokes `storeDigitalAssetsFromFTP`)*

### 4. Item History Creation
Upon successful completion of all segments, it invokes `createItemHistory`, persisting a human-readable audit trail indicating exactly how many attributes were modified.

---

## Scorecard & Logging Infrastructure

<ZoomableMermaid chart={loggingFlowChart} title="DataManagerLog Flow" />

### `DataManagerLog` Flow
1. **Init:** `DataManagerLog` is created during upload with status `SERVICE_PENDING`.
2. **Metrics:** `TOTAL_ITEM`, `TOTAL_ITEM_SUCCESS`, and `TOTAL_ITEM_ERROR` are stored as `DataManagerLogItem` entities.
3. **Scorecard Processing:** Generates distribution statistics on Brand, Duplicate GTINs, Terminology updates, and individual attribute modifications (e.g., `B15` for Part Number).
4. **Error Handling:** Errors are not persisted directly into granular database tables. Instead, an `errorRecordsAsCSV` payload creates a CSV file containing `[part-number, brand-id, sub-brand-id, error-description]` which is linked via Content/DataResource mapping.
5. **NiFi Export:** If `nifiConfig.export.enable=Y`, successful completion of an import triggers a dispatch to Apache NiFi for downstream synchronization.

---

## Data Model Mapping

Based on the PIES entity definitions (`entitymodel_pies.xml`) and the pipeline source logic:

| XML Tag / Concept | PIM Entity / System Key | Description |
|-------------------|--------------------------|-------------|
| `<Item>` Header | `Item` | Canonical product record. |
| `<PartNumber>` | `Item.partNumber` | Cleaned via `compressString()` into `cleanPartNumber` for lookups. |
| `<BrandAAIAID>` | `Item.brandAaiaId` | Corresponds to `ProductCategory` definition for brands. |
| `<SubBrandAAIAID>`| `Item.subBrandAaiaId` | Corresponds to `ProductCategory` definition for sub-brands. |
| `<PartTerminologyID>`| `Item.partTerminologyId` | Validation against the `Parts` entity. |
| `<ItemLevelGTIN>` | `Item.itemLevelGtin` | Direct storage; scorecard tracks duplicates across files. |
| *Alliance Product ID* | `Item.allianceProductId` | Filtered and extracted from `<ProductAttributes>` when applicable. |
| `<DigitalAssets>` | `DigitalAssets` / `BrandAssets` | Assets can be bound to items or directly to a brand. |
| `<ExtendedInformation>`| `ItemExpi` | Key-value store for extended product data. |

## Lookup Key Summary (PIM Pipeline)

| Key | XML Source | Use Case |
|---|---|---|
| `cleanPartNumber` | `<PartNumber>` | Normalized matching key (spaces/special chars removed) |
| `brandAaiaId` | `<BrandAAIAID>` | Core identity scoping |
| `subBrandAaiaId` | `<SubBrandAAIAID>`| Required for uniqueness in Alliance/Private Label contexts |
| `importSource` | System Assigned | Tracked as "PIES" to prevent collision with "INTC" (Interchange) imports |
