---
title: AutoCore Import Triangle Analysis
description: Technical analysis of the relationship between DataImportWrapperServices, DataImportServices, and PartyServices.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# AutoCore Import Triangle Analysis: DIS → DIWS → PartyServices

## The Mental Model

<ZoomableMermaid title="AutoCore Import Architecture: Batch CSV Routing" chart={`
graph TD
    CSV["CSV Files from ERP/ADW"] --> WRAPPER["DataImportWrapperServices<br/>(43 wrapper methods)"]
    
    subgraph "WRAPPER = Batch CSV Router"
        WRAPPER --> |"importMemberProductWrapper"| DIS_PROD["DataImportServices.importMemberProduct"]
        WRAPPER --> |"importGlobalProductsWrapper"| DIS_GLOB["DataImportServices.importGlobalProducts"]
        WRAPPER --> |"importOrganizationDataWrapper"| DIS_ORG["DataImportServices.importOrganizationData"]
        WRAPPER --> |"importEmployeeDataWrapper"| DIS_EMP["DataImportServices.importEmployeeData"]
        WRAPPER --> |"importAdwMemberPartiesWrapper"| DIS_PARTY["DataImportServices.importAdwMemberParties"]
        WRAPPER --> |"importAAIABrandsWrapper"| DIS_BRAND["DataImportServices.importAAIABrands"]
        WRAPPER --> |"importCategoriesWrapper"| DIS_CAT["DataImportServices.importCategories"]
        WRAPPER --> |"importAPWProductsWrapper"| DIS_APW["DataImportServices.importAPWProducts"]
    end
    
    DIS_PROD --> ENTITY["OFBiz Entities<br/>(Product, ProductFacility)"]
    DIS_ORG --> PARTY_ENT["OFBiz Entities<br/>(Party, PartyGroup, PartyRole)"]
    DIS_EMP --> PARTY_ENT
    DIS_PARTY --> PARTY_ENT
    
    style WRAPPER fill:#1a1a2e,stroke:#e94560,color:#fff
    style ENTITY fill:#0f3460,stroke:#16213e,color:#fff
    style PARTY_ENT fill:#0f3460,stroke:#16213e,color:#fff
`} />



---

## 1. What data does each service import?

### DataImportServices (God Module)
**Imports: Legacy ERP/ADW product catalog data via CSV**
- **Member Products**: Site-specific inventory/price.
- **Global Products**: Master catalog definitions.
- **Organizational Data**: Store groups, retail locations, warehouses.
- **Employee Data**: Staff records for alliance members.

> [!IMPORTANT]
> **This pipeline does NOT handle industry-standard XML.**
> - **PIES XML** is handled by `PIESServices`.
> - **ACES/VCDb** is pre-loaded reference data, never imported through this CSV route.

### DataImportWrapperServices (Batch Router)
Every method follows an identical batch pattern:
1. Parse CSV header → map to service fields.
2. Iterate rows → catch/log errors individually.
3. `dispatcher.runSync` target service row-by-row.
4. Capture scorecard metrics (Total, Success, Error).

### PartyServices (Supply Chain Hierarchy)
Manages the "Actors" in the system. "Party" = any business entity:
- `MEMBER`: Auto parts store group.
- `PART_STORE`: Individual retail shop.
- `BRAND_OWNER`: Product line owner.
- `DOMAIN_PARTY`: Catalog domain (e.g., AutoCore vs. NAPA).

---

## 2. Why "Party" appears in an import pipeline

In this automotive context, **a product doesn't exist in isolation**.

The `wdPartyId` (Warehouse Distributor Party ID) is the **Context Owner**. Every product import requires a `wdPartyId` to:
- Resolve brand mappings.
- Scope category hierarchies (Categories are often Party-prefixed).
- Document facility ownership (ProductFacility).

**Hierarchical Flow**: `Wrapper` → `DataImport` → `PartyServices`.

---

## 3. Refactoring Opportunity
All 43 wrapper methods in `DataImportWrapperServices` are copy-pasted implementations with only the target service name changed.
**Recommendation**: Replace with a single generic `importCsvWrapper(serviceName, ...)` logic to reduce code entropy.
