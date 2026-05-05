---
title: Detailed Analysis — importMemberProduct
hide_table_of_contents: false
view_mode: full
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

export const architectureFlowChart = `
graph TD
    A[Start: importMemberProduct] --> B[Unpack CSV Context Map]
    B --> C{Mandatory Fields Present?}
    C -- No --> D[Return Error: mandatoryFieldMissing]
    C -- Yes --> E[Phase 1: Domain Party Setup]
    
    E --> F{Party Exists?}
    F -- No --> G[Create Party, PartyGroup, PartyRole]
    F -- Yes --> H[Update PartyRole if needed]
    G --> I[Phase 2: Categorization]
    H --> I
    
    I --> J[storeLineCode]
    J --> K{SubLineCode Provided?}
    K -- Yes --> L[storeSubLineCode]
    K -- No --> M[Phase 3: Core Product]
    L --> M
    
    M --> N[storeProduct: Link Part to Party & Category]
    N --> O[Phase 4: Global Brand Mapping & Attributes]
    O --> O1[Map Legacy Brand & Update Core/Movement Flags]
    O1 --> P[Phase 5: Identifications & Packaging]
    P --> Q[Store stdUPC, caseUPC, palletUPC & Dimensions]
    Q --> R[Phase 6: Warranties & Localized Content]
    R --> S[Store Warranty Distances/Times & Translation Texts]
    S --> T[Phase 7: Pricing & Store Overrides]
    T --> U[Store List Price, Item Price, Tiers 1-8]
    U --> V[Phase 8: Solr Indexing]
    V --> W[Push Updates to Solr 'memberproduct' Core]
    W --> X([Complete: Return Success])
`;

export const entityRelationshipChart = `
sequenceDiagram
    participant CSV as importMemberProduct
    participant EE as Entity Engine
    participant SE as Service Engine
    participant Solr as Solr Server
    
    CSV->>EE: Query Party (partDomainId)
    alt Party does not exist
        CSV->>EE: Create Party & PartyGroup
        CSV->>EE: Create PartyRole (DOMAIN_PARTY)
    end
    
    CSV->>SE: storeLineCode (Category)
    SE-->>CSV: return lineCodeId
    
    CSV->>SE: storeProduct
    SE->>EE: Insert/Update Product Table
    SE-->>CSV: return productId
    
    CSV->>EE: Insert LegacyBrandMapping & Attributes
    
    CSV->>EE: Insert GoodIdentification (UPCs)
    CSV->>EE: Insert ProductPackage (CA/PL Dimensions)
    
    CSV->>SE: Insert ProductFeature (Warranties)
    CSV->>SE: Insert ElectronicText (Localized Content)
    
    CSV->>EE: Resolve Currency from ProductStore
    CSV->>EE: Expire Old Prices & Insert ProductPrice (Tiers 1-8)
    
    CSV->>Solr: Update 'memberproduct' Core
    Solr-->>CSV: Acknowledge
`;

# Detailed Analysis: `importMemberProduct`

The `importMemberProduct` service (located in `DataImportServices.java`) is the central workhorse of the AutoCore data import pipeline. While the wrappers and multi-threaded engines handle file parsing, thread safety, and batching, `importMemberProduct` is exclusively responsible for translating a single row of CSV data into the complex, highly-normalized entity graph of Apache OFBiz.

---

## High-Level Architecture Flow

<ZoomableMermaid chart={architectureFlowChart} title="Service Execution Flow" />

---

## Detailed Execution Phases

### 1. Context Unpacking & Validation
The service receives a heavily populated `Map<String, Object> context`. 
It begins by unpacking over 40 potential fields (e.g., `part`, `mfg`, `listprice`, `stdupc`, `qtyminorder`) and converting them from standard strings into strongly typed Java objects (like `BigDecimal` for prices and `Timestamp` for dates).

**Validation Gate:** The service immediately halts and returns an error (`mandatoryFieldMissing = TRUE`) if any of the following critical fields are empty:
*   `partNumber`
*   `partDomainId` (Member ID)
*   `lineCode` (Manufacturer Code)

---

### 2. Domain Party Setup
In OFBiz, every member or data provider must be represented as a `Party`.
*   **Query:** It searches the `PartyRoleDetailAndPartyDetail` view for an existing `PARTY_GROUP` with the exact `partDomainId` and the role `DOMAIN_PARTY`.
*   **Creation:** If it doesn't exist, it uses the Entity Engine (`delegator.create()`) to build a brand new `Party`, `PartyGroup`, and `PartyRole`. 

---

### 3. Categorization (Line Codes)
A product must belong to a manufacturer's line code.
*   **storeLineCode:** It constructs a unique `productCategoryId` using the format `[partyId]_[lineCode]` and triggers the `storeLineCode` service synchronously.
*   **storeSubLineCode:** If a `currentsubline` was provided in the CSV, it repeats this process to build the sub-line hierarchy (`[lineCodeId]_[subLineCode]`).

---

### 4. Core Product Orchestration
This is where the actual part number is registered.
*   **Normalization:** It calls `ProductServices.compressString(partNumber)` to strip out hyphens and special characters, creating a `stdPartNumber` (crucial for exact-match searching later).
*   **storeProduct:** It triggers the OFBiz `storeProduct` service, which creates/updates the `Product` table and establishes the foreign key relationships linking this part to the previously created Domain Party and Line Code Category.

---

### 4.5. Global Brand Mapping & Product Attributes
After the core product is created, the service enriches it with industry-standard mappings:
*   **LegacyBrandMapping:** It checks if the member's line code maps to an AAIA/AutoCare standard brand ID. If so, it flags the product (`isBrandMapExist`, `isGTINMapExist`) and stores features like `AST` or `Appl eCat`.
*   **Attributes:** It stores custom attributes like `CORE_FLAG` and `MOVEMENT_FLAG` as `ProductAttribute` records.

---

### 5. Good Identifications & Packaging
A single part can have multiple barcodes depending on how it is packaged.
*   **Item Level (`stdupc`):** Creates a `GoodIdentification` record for the primary UPC/EAN.
*   **Package Level (`CA` for Case, `PL` for Pallet):** If case or pallet quantities/UPCs are provided, it creates/updates `ProductPackage` records. This robustly stores the exact weight, height, width, and depth metrics for pallets and cases directly against the product.

---

### 6. Warranties & Localized Content
The AutoCore feed supports complex warranty data.
*   **Features:** It stores `WARRANTY_DISTANCE` and `WARRANTY_TIME` (along with their UOMs like miles/months) as `ProductFeature`s.
*   **Localized Content:** It parses `warrantyWd` (English), `warrantyWdEs` (Spanish), and `warrantyWdFr` (French). For each translation, it creates an `ElectronicText` and `DataResource`, wraps it in a `Content` record, and links them via `ContentAssoc` to support multi-lingual storefronts.

---

### 7. Pricing Tiers & Currency Overrides
The AutoCore data feed contains massive pricing matrices.
*   **Currency Resolution:** It dynamically looks up the Member's `ProductStore` (via their `PartyRelationship`) to determine the correct `currencyUomId` (falling back to USD).
*   **Price Ingestion:** It takes fields like `listprice`, `itemprice`, and the 8 tier prices (`currentprice1` through `currentprice8`) and inserts them into the `ProductPrice` table. *Crucially*, if the currency changes, it gracefully expires the old price records (`thruDate = now`) before inserting the new ones.

---

### 8. Solr Search Indexing
At the very top of the execution block, the service initializes an `HttpSolrClient` connected to the `memberproduct` core.
After successfully writing all the highly-normalized data to the relational SQL database, it takes the flattened product representation and pushes it to Apache Solr. This ensures that the moment the import row completes, the product is immediately searchable via the storefront UI without waiting for a nightly batch job.

---

## Entity Relationship Sequence

<ZoomableMermaid chart={entityRelationshipChart} title="Entity Ingestion Sequence" />
