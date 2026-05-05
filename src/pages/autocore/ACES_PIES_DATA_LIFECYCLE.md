---
title: ACES/PIES Data Lifecycle — End-to-End Service Trace
description: Tracing the end-to-end data flow from ACES/PIES import to B2C retrieval in the AutoCore plugin.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreTraceSimulator from '@site/src/components/AutoCoreTraceSimulator';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# ACES/PIES Data Lifecycle — End-to-End Service Trace

> A complete, numbered trace of how ACES/PIES automotive catalog data flows through the AutoCore plugin: from import → indexing → B2C retrieval.

---

## Interactive Lifecycle Trace

<AutoCoreTraceSimulator />

---

## Architecture Overview


<ZoomableMermaid title="End-to-End Data Flow Architecture" chart={`
graph TB
    subgraph "1. IMPORT — Legacy ERP Ingestion"
        A["DataImportWrapperServices<br/>(Orchestrator)"] --> B["DataImportServices<br/>(Entity Writer)"]
        B --> C[("OFBiz Entity DB<br/>Product, ProductCategory,<br/>ProductAssoc, ProductFeature,<br/>GoodIdentification, ProductPackage")]
    end

    subgraph "2. INDEX — Solr Population"
        D["ProductSolrServices<br/>(Document Builder)"] --> E["IndexingServices.addIndexes<br/>(Solr Writer)"]
        E --> F[("Solr Cores<br/>globalproducts, parts,<br/>interchange")]
    end

    subgraph "3. RETRIEVE — B2C API"
        G["AutoCoreB2CProductServices<br/>(Product Detail + Availability)"]
        H["AutoCoreB2CVehicleServices<br/>(Vehicle DNA Lookup)"]
        I["OpticatSearchServices<br/>(External ACES Fitment)"]
    end

    C --> D
    C --> G
    C --> H
    H --> I
    I --> J(("Opticat API<br/>webservice.opticatonline.com"))
    G -->|"checkPartAvailability"| K(("AES Inventory<br/>(External)"))

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#16213e,stroke:#ffc107,color:#fff
    style E fill:#16213e,stroke:#ffc107,color:#fff
    style G fill:#0f3460,stroke:#00d4ff,color:#fff
    style H fill:#0f3460,stroke:#00d4ff,color:#fff
    style I fill:#0f3460,stroke:#00d4ff,color:#fff
`} />


---

## Phase 1: Data Import (ACES/PIES → Entity DB)

> **Entry point**: `DataImportWrapperServices` → `DataImportServices`
>
> **Pattern**: `dispatcher.runSync("serviceName", context)` chains

### Numbered Flow

| Step | Service | Method | What It Does |
|------|---------|--------|-------------|
| **1.1** | `DataImportWrapperServices` | `importGlobalProducts()` | **Orchestrator**. Reads raw import rows from `DataImportGlobalProduct`, iterates in batches, calls Step 1.2 for each record. Tracks pass/fail scorecard. |
| **1.2** | `DataImportServices` | `importGlobalProducts()` | **Entity Writer**. For a single import row, fans out to 10 sub-services via `dispatcher.runSync`: |
| 1.2a | `DataImportServices` | → `storeBrand` | Creates/updates `ProductCategory` (type=`AAIA_BRAND`) |
| 1.2b | `DataImportServices` | → `storeSubBrand` | Creates/updates `ProductCategory` (type=`AAIA_SUB_BRAND`) |
| 1.2c | `DataImportServices` | → `storeTerminology` | Creates/updates `ProductCategory` (type=`AAIA_TERMINOLOGY`) — ACES part type hierarchy |
| 1.2d | `DataImportServices` | → `storeNPC` | Stores Normalized Part Code metadata |
| 1.2e | `DataImportServices` | → `storeProduct` | Creates/updates `Product` entity — core PIES item record |
| 1.2f | `DataImportServices` | → `storeProductName` | Creates content record for `PRODUCT_NAME` |
| 1.2g | `DataImportServices` | → `storeProductFeature` | Creates `ProductFeature` + `ProductFeatureAppl` for SAT/PADB attributes |
| 1.2h | `DataImportServices` | → `storeProductCategoryMember` | Links product to terminology/brand/sub-brand categories |
| 1.2i | `DataImportServices` | → `storeGoodIdentification` | Stores EAN/UPCA/UPC identifiers in `GoodIdentification` |
| 1.2j | `DataImportServices` | → `createProductPackage` | Stores PIES package dimensions (weight, height, width, GTIN) |
| **1.3** | `DataImportWrapperServices` | `importMemberProduct()` | Same pattern for member-specific parts. Calls `DataImportServices.importMemberProduct()` → `storeProduct`, `storeProductPrice`, etc. |
| **1.4** | `DataImportWrapperServices` | `importParts()` | Imports interchange/association data. Calls `DataImportServices.importParts()` → `storeProductAssoc` (OE_SUBSTITUTE, COMPETITIVE_SUBSTT). |

> [!IMPORTANT]
> **All imports are synchronous** (`dispatcher.runSync`). A single `importGlobalProducts` wrapper call can trigger 10+ nested sync calls *per row*. This is the primary reason import is the slowest phase.

---

## Phase 2: Solr Indexing (Entity DB → Solr Cores)

> **Entry point**: `ProductSolrServices` → `IndexingServices`
>
> **Pattern**: Build `SolrInputDocument` in Java → `IndexingServices.addIndexes()` → HTTP push to Solr

### Numbered Flow

| Step | Service | Method | What It Does |
|------|---------|--------|-------------|
| **2.1** | `ProductSolrServices` | `createGlobalProductIndex()` | Reads `Product` entities, builds `SolrInputDocument` with fields: `productId`, `partNumber`, `stdPartNumber`, `brandId`, `subBrandId`, `terminologyId`, images, prices, features. |
| **2.2** | `IndexingServices` | `addIndexes()` | Receives `List<SolrInputDocument>` and core name `globalproducts`. Opens `HttpSolrClient`, calls `client.add(docs)` + `client.commit()`. **Target**: Solr core `globalproducts`. |
| **2.3** | `ProductSolrServices` | `createPartIndex()` | Builds member/part-specific Solr docs from `Product` + `ProductAssoc` + `ProductPrice`. Includes facility, inventory, and availability metadata. |
| **2.4** | `IndexingServices` | `addIndexes()` | Pushes part docs → Solr core `parts`. |
| **2.5** | `ProductSolrServices` | `createPartInterchangeIndex()` | Builds interchange docs from `ProductAssoc` (type=`OE_SUBSTITUTE` / `COMPETITIVE_SUBSTT`). Maps OE numbers, competitive cross-references. |
| **2.6** | `IndexingServices` | `addInterchangeIndexes()` | Pushes interchange docs → Solr core interchange (separate host/core config via `getInterchageSolrHost()`). |

> [!NOTE]
> **Solr host resolution** uses `EntityUtilProperties` — the Solr URL is read from `import.properties` per-core, not hardcoded. `getSolrHost()` and `getInterchageSolrHost()` are separate methods, meaning interchange can be on a different Solr instance entirely.

### Delete Operations

| Service | Method | Purpose |
|---------|--------|---------|
| `IndexingServices` | `deleteIndexByIdList()` | Removes specific docs by ID list before re-index |
| `IndexingServices` | `deleteIndexByQuery()` | Bulk purge by Solr query (e.g., full reindex scenarios) |

---

## Phase 3: B2C API Retrieval (Storefront → Data)

This phase has **two parallel paths** depending on what the consumer is asking for:

### Path A: Product Details & Availability (PIES data)

| Step | Service | Method | What It Does |
|------|---------|--------|-------------|
| **3A.1** | `AutoCoreB2CProductServices` | `getProductDetails()` | **Entry point**. Takes `productSku`, queries `Product` entity directly (NOT Solr). Hydrates a full product map: |
| 3A.1a | — | → `EntityQuery("Product")` | Resolves `allianceProductId` → `productId` |
| 3A.1b | — | → `EntityQuery("ProductCategory")` | Fetches brand (AAIA_BRAND), sub-brand, terminology hierarchy |
| 3A.1c | — | → `EntityQuery("ProductCategoryRollupDetails")` | Walks category → subcategory → terminology tree |
| 3A.1d | — | → `EntityQuery("GoodIdentification")` | Fetches EAN/UPCA GTIN |
| 3A.1e | — | → `EntityQuery("ProductContentAndInfo")` | Images (ACA_DEF_THU, ACA_DEF_IMAGE, DIGITAL_ASSET, P04, LGO, MSD) |
| 3A.1f | — | → `EntityQuery("ProductPrice")` | Price waterfall: ZAP → LST → JOBBER → QOT → USR → WD1 → fallback `1234.56` |
| 3A.1g | — | → `EntityQuery("ProductFeatureAndAppl")` | SAT_ATTRIBUTE and PADB_ATTRIBUTE features |
| 3A.1h | — | → `EntityQuery("ProductPackage")` | Package dimensions + GTIN |
| 3A.1i | — | → `EntityQuery("ProductAssoc")` | Part interchange (OE_SUBSTITUTE, COMPETITIVE_SUBSTT) |
| 3A.1j | — | → `dispatcher.runSync("getBrandImageUrl")` | Fetches brand logo URLs (logo_100, logo_400) |
| **3A.2** | `AutoCoreB2CProductServices` | `checkProductAvailability()` | Takes `partNumber` + `manufacturerCode` + `locationId`. |
| 3A.2a | — | → `dispatcher.runSync("checkPartAvailability")` | **External call to AES** (Alliance Inventory System). Sends JSON basket, receives real-time inventory: `quantityAvailable`, `unitCostPrice`. |
| **3A.3** | `AutoCoreB2CProductServices` | `checkSITMOptionAvailability()` | Checks if "Ship It To Me" is enabled for any facility in the product store. Reads `FacilityShipmentSetting` for `SHIP_IT_TO_ME` method type. |
| **3A.4** | `AutoCoreB2CProductServices` | `getSITMInventoryAvailability()` | Aggregates SITM inventory across all non-store-locator facilities. Also calls `checkPartAvailability` (AES). |

### Path B: Vehicle Fitment & ACES Search

| Step | Service | Method | What It Does |
|------|---------|--------|-------------|
| **3B.1** | `AutoCoreB2CVehicleServices` | `getYears()` | Queries `BaseVehicleAndType` → returns distinct years for region + vehicle type. **Direct EntityQuery, no Solr.** |
| **3B.2** | `AutoCoreB2CVehicleServices` | `getMakes()` | Queries `BaseVehicleAndType` + `Make` → returns makes for year/region/type. |
| **3B.3** | `AutoCoreB2CVehicleServices` | `getModels()` | Queries `BaseVehicleAndType` + `Model` → returns models for year/make/region/type. |
| **3B.4** | `AutoCoreB2CVehicleServices` | `getBaseVehicleID()` | Queries `BaseVehicle` → resolves Y/M/M to `BaseVehicleID`. |
| **3B.5** | `AutoCoreB2CVehicleServices` | `getSubModels()` | Queries `Vehicle` + `Submodel` → returns submodels for baseVehicleId. |
| **3B.6** | `AutoCoreB2CVehicleServices` | `getEngineConfigurations()` | Queries `Vehicle` → `VehicleToEngineConfig` → `EngineConfigAndTypeDescription` → `FuelDeliveryConfig` → `FuelSystemDesign`. Builds human-readable engine string (e.g., "V6 3.5L 3458cc Gas DI Naturally Aspirated"). |
| **3B.7** | `AutoCoreB2CVehicleServices` | `testFitmentForPart()` | **Fitment validation**. Calls `OpticatSearchServices.sendOpticatSearchRequest()` with `getAutoCareSearchResults`. Returns `fitmentStatus: True/False`. |
| **3B.8** | `AutoCoreB2CVehicleServices` | `getOpticatSearchResults()` | **Full fitment search**. Calls Opticat twice: first for total count, then with `includeParts=true` + facets. Returns `productSkuList` + `fitmentFacets`. |
| **3B.9** | `AutoCoreB2CVehicleServices` | `getOpticatPartApplicationDetails()` | **Part application details**. Calls `OpticatSearchServices.sendOpticatSearchRequest()` with `getAutoCarePartApplications`. Parses ACES attributes, notes, positions, engine base applications. |
| **3B.10** | `OpticatSearchServices` | `sendOpticatSearchRequest()` | **HTTP proxy to Opticat**. Static POST to `webservice.opticatonline.com/autocare/v1/services/Catalog.jsonEndpoint`. Uses Basic Auth + API key. Returns parsed JSON response. |

> [!WARNING]
> **Vehicle DNA queries (steps 3B.1–3B.6) read directly from the VCDb entity tables**, not from Solr. The VCDb data (BaseVehicle, Make, Model, Submodel, EngineConfig) is a separate dataset from the product catalog — it's the ACES reference database for vehicle identification.

---

## Summary: Two Worlds, One Plugin

<ZoomableMermaid title="PIES vs ACES Service Domains" chart={`
graph LR
    subgraph "PIES World (Product Data)"
        direction TB
        P1["Import: DataImportServices"] --> P2["Store: OFBiz Entities"]
        P2 --> P3["Index: ProductSolrServices"]
        P3 --> P4["Retrieve: AutoCoreB2CProductServices"]
        P4 --> P5(("Entity DB<br/>Direct Query"))
    end

    subgraph "ACES World (Fitment Data)"
        direction TB
        A1["VCDb Reference Data<br/>(BaseVehicle, Make, Model)"] --> A2["AutoCoreB2CVehicleServices"]
        A2 --> A3["OpticatSearchServices"]
        A3 --> A4(("Opticat Cloud API"))
    end

    P2 -.- A1

    style P1 fill:#e94560,color:#fff
    style P3 fill:#ffc107,color:#000
    style P4 fill:#00d4ff,color:#000
    style A2 fill:#00d4ff,color:#000
    style A3 fill:#845EC2,color:#fff
`} />


| Dimension | PIES (Product) | ACES (Fitment) |
|-----------|---------------|----------------|
| **Import** | `DataImportServices` → entity DB | VCDb reference tables (pre-loaded) |
| **Index** | `ProductSolrServices` → Solr cores | **Not indexed** — queries external Opticat API |
| **Retrieve** | `AutoCoreB2CProductServices` → entity DB direct | `AutoCoreB2CVehicleServices` → entity DB + Opticat HTTP |
| **External dependency** | AES (inventory check) | Opticat (`webservice.opticatonline.com`) |
| **Coupling** | Zero cross-talk with ACES services | Zero cross-talk with PIES services |

> [!CAUTION]
> **The integration between ACES and PIES happens exclusively at the data/entity level**, not at the service level. There is no `dispatcher.runSync` call between `VCDBServices`/`AutoCoreB2CVehicleServices` and `DataImportServices`/`AutoCoreB2CProductServices`. The SKU generated by `getOpticatSearchResults` (step 3B.8) is the bridge: `stdPartNumber-brandCode-subBrandCode` — this SKU is then used client-side to call `getProductDetails` (step 3A.1) for the full PIES product data.
