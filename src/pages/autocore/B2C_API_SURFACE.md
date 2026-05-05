---
title: B2C API Surface Map
description: Two God Nodes, two distinct domains — a complete map of AutoCore's B2C-facing API surface across Products and Party.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# B2C API Surface Map

> Two God Nodes, two distinct domains: **Products** (what you buy) and **Party** (where you buy it from).

---

## 1. What Does AutoCoreB2CProductServices Expose?

42 methods across 5 functional domains:

### A. Catalog & Part Lookup
| Method | Purpose |
|---|---|
| `getProductDetails` | Returns full PIES product metadata by SKU (`allianceProductId`) — brand, sub-brand, part terminology, category, images, attributes |
| `getWDProductDetail` | WD-scoped product detail with pricing and member-specific inventory |
| `getWDProductUpdatedPrices` | Price refresh for WD products |
| `getValidatedParts` | Returns B2C-visible parts that have passed the saleability gate |
| `getProductDigitalAssets` | Returns media assets (images, PDFs) for a product |

### B. SAYT / Typeahead Search
| Method | Purpose |
|---|---|
| `getSAYTRecommendations` | Search-As-You-Type via Epicor's `saytrecommendations` Solr core |
| `getSAYTByKeyword` | Keyword-based SAYT; delegates to `EpicorSearchServices` |

### C. Inventory & Availability
| Method | Purpose |
|---|---|
| `checkProductAvailability` | Checks qty available at a specific facility. Delegates to `checkPartAvailability` service (AES/WD layer) |
| `checkSITMOptionAvailability` | Checks if Ship-It-To-Me is available for the product+store combo |
| `getSITMInventoryAvailability` | SITM inventory count at nearest stores |
| `checkSITMInventoryAtNearestStores` | Geo-radius SITM store check |
| `getPartAvailabilityAtInventoryLocations` | Multi-location inventory sweep |
| `updateWDProductInventory` | Push updated inventory from WD feed |
| `decrementWDProductInventory` | Decrement inventory post-order |
| `resetWDProductsInventory` | Reset WD inventory to zero (WD feed restart) |

### D. Saleability / Lifecycle Management (Admin APIs)
| Method | Purpose |
|---|---|
| `configureProductAsSaleable` | Gates a product into the B2C store — sets it as visible/buyable |
| `configureProductAsNonSaleable` | Removes a product from B2C store |
| `autoConfigureProductsAsNonSaleable` | Bulk job to retire stale products |
| `validateProduct` | Pre-flight check before saleability config |
| `cleanProductsFromB2CStore` | Removes specific product associations |
| `cleanB2CStore` | Full B2C store purge (admin reset) |

### E. Order Fulfillment Config
| Method | Purpose |
|---|---|
| `placeAESOrderV2` | Places an AES (Automotive Exchange System) order |
| `postStoreDeliveryConfig` / `getStoreDeliveryConfig` / `deleteStoreDeliveryConfig` | Delivery config per store |
| `postStoreDeliverySchedule` / `deleteStoreDeliverySchedule` | Delivery schedule management |
| `getProductAdditionalFee` / `setAdditionalFeeProductGeo` | Eco/core fees geo-mapping |
| `getNearestStore` | Geo-lookup for nearest store with inventory |

### F. Selling Location & Price Region Management
| Method | Purpose |
|---|---|
| `storeSellingLocationGroup` / `getSellingLocationGroups` | Manage logical groups of store locations |
| `getPriceRegionGroups` / `addSellingLocationToPriceRegionGroup` | Price region assignment |
| `getDefaultPriceRegionGroup` / `storeDefaultPriceRegionGroup` | Default pricing tier |

export const b2cSurfaceChart = `
flowchart LR
    SF[B2C Storefront]

    SF -->|getProductDetails| PD[RDBMS: Product Entity]
    SF -->|checkProductAvailability| WD[AES / WD External API]
    SF -->|getSAYTByKeyword| SAYT[Solr: saytrecommendations]
    SF -->|getMemberStoreOrDistributionCenter| PP[RDBMS: Party Graph]
    SF -->|getFitmentResults| OPT[Opticat External API]

    subgraph AutoCore B2C Layer
        PD
        WD
        SAYT
        PP
    end

    style SF fill:#7C3AED,color:#fff
    style WD fill:#1e40af,color:#fff
    style SAYT fill:#1e40af,color:#fff
    style OPT fill:#065f46,color:#fff
`;

<ZoomableMermaid chart={b2cSurfaceChart} title="B2C Data Plane Overview" />

---

## 2. What Does "Party" Mean in B2C Context?

**Not the end consumer.** In AutoCore's B2C context, "Party" = **a physical store location or warehouse** in the alliance supply chain.

The `AutoCoreB2CPartyServices` hierarchy resolves like this:

```
ProductStore (storeId)
  └── payToPartyId → MEMBER (e.g., "Bumper-to-Bumper" franchise)
        └── DOMAIN_PARTY (franchise territory parent)
              ├── PART_STORE (individual retail location with physical inventory)
              └── DISTRIBUTOR (warehouse / distribution center)
```

**LiferayId** = the external CMS identifier for a store party. The B2C storefront sends `liferayId` instead of internal `partyId` — `AutoCoreB2CPartyServices` translates this on every request.

### What AutoCoreB2CPartyServices exposes:

| Method Group | Functions |
|---|---|
| **Store Discovery** | `getMemberStoreOrDistributionCenter`, `getMemberActiveStores`, `getSITMActiveStores` |
| **Location Detail** | `getFacilityLocation` — the core resolver: returns address, hours, SITM/pickup flags, price region, tax config |
| **Transfer Logistics** | `storeTransferSchedule`, `getTransferSchedule`, `storeTransferLocation`, `getTransferLocations`, `getTransferLocationsInvAndSchedule` |
| **AES Config** | `postAESConfig`, `getAESConfig` — WD ordering credentials per store |
| **Tax Config** | `addTaxConfigForCores`, `addTaxConfigForDeliveryFee`, `addTaxConfigForEnvironmentalFee`, `checkTaxOn*`, `storeCustomTaxConfig` |
| **WD Blacklist** | `getWDBlacklist` — stores that are banned from ordering via WD |
| **Availability** | `bulkCheckTransferAvailabilityForProducts` |
| **Shipping** | `getAvailableShippingOptions` |

---

## 3. Sequence Diagrams

### Flow A: Product Detail Page (`getProductDetails`)

export const flowAChart = `
sequenceDiagram
    participant SF as B2C Storefront
    participant SVC as AutoCoreB2CProductServices
    participant DB as RDBMS

    SF->>SVC: GET getProductDetails(productSku)
    SVC->>DB: EntityQuery: Product WHERE allianceProductId = sku
    SVC->>DB: EntityQuery: ProductCategory (brand / sub-brand / terminology)
    SVC->>DB: EntityQuery: ProductCategoryRollupDetails (hierarchy)
    SVC->>DB: EntityQuery: ProductContent (images, attributes)
    SVC-->>SF: JSON product response

    Note over SVC,DB: Pure DB reads. Zero Solr, zero external API.
`;

<ZoomableMermaid chart={flowAChart} title="Flow A: Product Detail — Pure RDBMS Read" />

---

### Flow B: Inventory Check (`checkProductAvailability`)

export const flowBChart = `
sequenceDiagram
    participant SF as B2C Storefront
    participant SVC as AutoCoreB2CProductServices
    participant DB as RDBMS
    participant WD as AES / WD External

    SF->>SVC: POST checkProductAvailability(partNumber, liferayId, qty)
    SVC->>DB: EntityQuery: Party WHERE externalId = liferayId → partyId
    SVC->>DB: EntityQuery: Facility WHERE ownerPartyId = partyId → facilityId
    SVC->>WD: runSync("checkPartAvailability", {facilityId, partsBasket})
    WD-->>SVC: quantityAvailable, unitCostPrice per line
    SVC-->>SF: JSON availability response
`;

<ZoomableMermaid chart={flowBChart} title="Flow B: Inventory Check — DB + External WD Layer" />

---

### Flow C: Store Locator (`getMemberStoreOrDistributionCenter`)

export const flowCChart = `
sequenceDiagram
    participant SF as B2C Storefront
    participant PSvc as AutoCoreB2CPartyServices
    participant DB as RDBMS

    SF->>PSvc: GET getMemberStoreOrDistributionCenter(storeId, roleType)
    PSvc->>DB: ProductStore WHERE productStoreId = storeId → memberId
    PSvc->>DB: PartyRelationship WHERE partyIdFrom = memberId → domainPartyId
    PSvc->>DB: PartyRelationshipAndPartyDetail (PART_STORE | DISTRIBUTOR list)
    loop For each store party
        PSvc->>DB: Facility WHERE ownerPartyId = storePartyId → facilityId
        PSvc->>PSvc: runSync("getFacilityLocation", {facilityId})
        Note right of PSvc: Resolves address, hours, SITM flags, tax config, lat/lng
    end
    PSvc-->>SF: Sorted list of stores
`;

<ZoomableMermaid chart={flowCChart} title="Flow C: Store Locator — Recursive Party Graph Resolution" />

---

### Flow D: SAYT Typeahead (`getSAYTByKeyword`)

export const flowDChart = `
sequenceDiagram
    participant SF as B2C Storefront
    participant SVC as AutoCoreB2CProductServices
    participant ESvc as EpicorSearchServices
    participant SOLR as Solr: saytrecommendations

    SF->>SVC: GET getSAYTByKeyword(keyword)
    SVC->>ESvc: runSync("searchEpicorePartsFromSAYT", {keyword})
    ESvc->>SOLR: IndexingServices.getSolrHost() → HttpSolrClient.query(keyword)
    SOLR-->>ESvc: partNumber, description, brandName matches
    ESvc-->>SVC: results
    SVC-->>SF: JSON SAYT response

    Note over ESvc,SOLR: Direct Solr client — bypasses ProductSolrServices entirely
`;

<ZoomableMermaid chart={flowDChart} title="Flow D: SAYT Typeahead — Direct Solr Client" />

---

## 4. Key Insight: Two Planes of Truth

| Plane | Source of Truth | Used by |
|---|---|---|
| **Product catalog** (what is it?) | RDBMS entity layer | `getProductDetails`, `getWDProductDetail` |
| **Product availability** (can I buy it?) | External WD/AES API via `checkPartAvailability` | `checkProductAvailability` |
| **Search** (find it) | Solr (`globalproducts`, `saytrecommendations`) | B2C search, SAYT |
| **Store network** (where from?) | RDBMS party/facility graph | All `AutoCoreB2CPartyServices` methods |
| **Fitment** (fits my car?) | External Opticat API | `AutoCoreB2CVehicleServices` |

**The B2C layer never does a full-join across all five planes simultaneously.** Each API call touches only one or two planes — the storefront UI assembles the complete picture on the client side by making multiple parallel API calls.
