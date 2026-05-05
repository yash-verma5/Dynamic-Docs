---
title: VCDB / PIES Product Data Integration Analysis
description: Technical analysis of the SKU index bridge between VCDB fitment and PIES product data.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# VCDB (Fitment) & PIES (Product) Integration Analysis

> **Question**: Where does ACES fitment validation (VCDB) integrate with product data (PIES)?
> 
> **Answer**: **None of the above.** The integration is **outsourced to the external Opticat cloud API**. There is no internal service, entity, or import layer that bridges VCDB and PIES.

---

## Evidence Matrix

| Layer | VCDB → PIES? | PIES → VCDB? | Verdict |
|-------|:---:|:---:|---------|
| **Java imports** | `VCDBServices` never imports any PIES class | `PIESServices` never imports any VCDB class | ❌ Zero |
| **Entity model** | `entitymodel_vcdb.xml` — separate file, `autocore.vcdb` package | `entitymodel.xml` — zero VCDb entity references | ❌ Zero foreign keys |
| **DataImportServices** | Never references `BaseVehicle`, `VehicleID`, or any VCDb entity | N/A | ❌ No combined step |
| **dispatcher.runSync** | No call from any VCDB service to any PIES service or vice versa | Same | ❌ No orchestration |

> [!IMPORTANT]
> The two entity models (`entitymodel.xml` and `entitymodel_vcdb.xml`) are **completely isolated schemas** sharing only the OFBiz delegator connection. VCDb entities are all marked `no-auto-stamp="true"` — they are **read-only ACES reference data**, pre-loaded and never written to by the import pipeline.

---

## The Actual Integration: Opticat SKU Bridge

The integration happens in a single method — `AutoCoreB2CVehicleServices.getOpticatSearchResults()`:

<ZoomableMermaid title="Integration Mapping: VCDB to PIES" chart={`
sequenceDiagram
    participant Client as Storefront Client
    participant Vehicle as AutoCoreB2CVehicleServices
    participant VCDb as VCDb Entities (EntityQuery)
    participant Opticat as Opticat Cloud API
    participant Product as AutoCoreB2CProductServices
    participant DB as Product Entities (EntityQuery)

    Note over Client: User selects Year/Make/Model
    Client->>Vehicle: getYears() / getMakes() / getModels()
    Vehicle->>VCDb: EntityQuery BaseVehicleAndType, Make, Model
    VCDb-->>Vehicle: Vehicle DNA
    Vehicle-->>Client: dropdown data

    Note over Client: User clicks "Find Parts"
    Client->>Vehicle: getOpticatSearchResults(baseVehicleId, brands, partTypes)
    Vehicle->>Opticat: HTTP POST getAutoCareSearchResults
    Note over Opticat: Opticat does the<br/>ACES↔PIES join<br/>in their cloud
    Opticat-->>Vehicle: { parts: [{ piesItem: { partNumber, brandCode, subBrandCode } }] }
    
    Note over Vehicle: SKU BRIDGE
    Vehicle->>Vehicle: sku = compress(partNumber) + "-" + brandCode + "-" + subBrandCode
    Vehicle-->>Client: { productSkuList: ["ABC123-BRNX-SUB1", ...] }

    Note over Client: Client calls product API with each SKU
    Client->>Product: getProductDetails(productSku: "ABC123-BRNX-SUB1")
    Product->>DB: EntityQuery Product WHERE allianceProductId = sku
    DB-->>Product: PIES product data
    Product-->>Client: Full product details
`} />

### The SKU Construction

```java
// From AutoCoreB2CVehicleServices.getOpticatSearchResults()
for (Map<String, Object> piesItem : parts) {
    item = UtilGenerics.cast(piesItem.get("piesItem"));
    sku = new StringBuilder();
    // 1. Compressed part number (ACES data, from Opticat)
    String stdPartNumber = ProductServices.compressString((String) item.get("partNumber"));
    sku = sku.append(stdPartNumber).append("-");
    // 2. Brand code (PIES data, from Opticat)
    sku = sku.append((String) item.get("brandCode")).append("-");
    // 3. Sub-brand code (PIES data, from Opticat)
    sku = sku.append((String) item.get("subBrandCode"));
    
    productSkuList.add(sku.toString());
    // This SKU matches Product.allianceProductId in the local entity DB
}
```

> [!CAUTION]
> **The join between "which parts fit this vehicle" (ACES) and "what are the details of this part" (PIES) is performed entirely by Opticat's cloud service.** The local system never correlates VCDb vehicle IDs with Product entity IDs. It trusts Opticat to have already ingested both ACES and PIES data and return the correct part numbers for a given vehicle.

---

## Architectural Implications

### Why this design?

ACdb fitment data (which part fits which vehicle) is enormous and complex — millions of vehicle-to-part mappings with attribute qualifiers (engine, submodel, position). Rather than maintaining this mapping locally, the AutoCore plugin **delegates ACES fitment queries to Opticat** and keeps only the VCDb reference data (vehicle DNA) locally for the Year/Make/Model dropdowns.

### Risks

| Risk | Impact | Likelihood |
|------|--------|------------|
| **Opticat outage** = complete fitment search failure | High — no fallback | Medium |
| **SKU mismatch** between Opticat response and local `Product.allianceProductId` | Part details return empty for valid fitment results | Low but silent |
| **Hardcoded API credentials** in `OpticatSearchServices` | Security vulnerability | Already present |
| **No local ACES fitment cache** | Every fitment query = external HTTP call | Always |

### Source Files

| File | Role |
|------|------|
| `entitymodel_vcdb.xml` | VCDb entity definitions (read-only reference data) |
| `entitymodel.xml` | PIES/Product entity definitions (no VCDb references) |
| `VCDBServices.java` | VCDb admin/CRUD (isolated) |
| `PIESServices.java` | PIES XML import (isolated) |
| `AutoCoreB2CVehicleServices.java` | Vehicle search + **SKU bridge** |
| `OpticatSearchServices.java` | HTTP proxy to Opticat (hardcoded URL + credentials) |
| `AutoCoreB2CProductServices.java` | Product detail retrieval (receives SKU from client) |
