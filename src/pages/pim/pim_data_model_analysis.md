---
title: PIM Data Architecture & Graph Analysis
hide_table_of_contents: false
view_mode: full
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import PimBackButton from '@site/src/components/PimBackButton';

<PimBackButton />

export const piesErd = `
erDiagram
    %% Core Entities
    Item {
        string itemId PK
        string partNumber "e.g. BXD-1029"
        string brandAaiaId
        date itemEffectiveDate
        string maintenanceType
        string itemLevelGTIN
        string partTerminologyID
    }
    
    PartAttribute {
        string productAttributeId PK
        string attributeId "e.g. Length, Weight"
        string attributeValue
        boolean padbAttribute
        string maintenanceType
    }
    
    ExtendedProductInformation {
        string extendedInformationId PK
        string expiCode
        string extendedProductInformation
        string languageCode
        string maintenanceType
    }
    
    Package {
        string packageId PK
        string packageUOM
        int quantityofEaches
        string packageLevelGTIN
        decimal weights
    }
    
    DigitalAsset {
        string digitalAssetId PK
        string fileName
        string uri
        string assetType
        int resolution
        string fileType
    }
    
    Pricing {
        string pricingId PK
        date effectiveDate
        decimal price
        string currencyCode
        string priceSheetNumber
        string priceType
    }
    
    KitComponent {
        string kitComponentId PK
        string componentPartNumber
        int quantityInKit
        string componentBrand
        string description
    }
    
    PartInterchange {
        string partInterchangeId PK
        string itemIdTo "Cross-Reference"
        string brandAaiaId
        string partNumber
        string interchangeQuantity
    }

    ItemDescription {
        string descriptionId PK
        string itemId FK
    }

    %% Relationships
    Item ||--o{ PartAttribute : "Has Attributes"
    Item ||--o{ ExtendedProductInformation : "Has EXPI"
    Item ||--o{ Package : "Has Packages"
    Item ||--o{ DigitalAsset : "Has Assets"
    Item ||--o{ Pricing : "Has Pricing"
    Item ||--o{ KitComponent : "Has Kit Components"
    Item ||--o{ PartInterchange : "Has Interchanges"
    Item ||--o{ ItemDescription : "Has Descriptions"
`;

export const acesErd = `
erDiagram
    %% Base Items
    AcesItem {
        id acesItemId PK
        id-long part
        id partType "Terminology ID"
        short-varchar mfrLabel
    }

    ItemVehicleAssoc {
        id itemVehicleAssocId PK
        id baseVehicleId FK
        id vehicleId FK
        id subModelId FK
    }

    %% The Grand Aggregator
    ItemVehicleConfig {
        id itemVehicleConfigId PK
        id itemVehicleEngineAssocId FK
        id itemVehicleBrakeAssocId FK
        id itemVehicleTransmissionAssocId FK
    }

    %% Sub-Configurations
    ItemVehicleEngineAssoc {
        id itemVehicleEngineAssocId PK
        id engineBaseId
        id engineBlockId
        id mfrId
    }

    ItemVehicleBrakeAssoc {
        id itemVehicleBrakeAssocId PK
        id frontBrakeTypeId
        id rearBrakeTypeId
    }

    ItemVehicleTransmissionAssoc {
        id itemVehicleTransmissionAssocId PK
        id transmissionBaseId
        id transmissionTypeId
    }

    %% Relationships
    AcesItem ||--o{ ItemVehicleAssoc : "IVA_ACESITEM"
    ItemVehicleAssoc ||--o{ ItemVehicleConfig : "Aggregates"
    
    ItemVehicleConfig ||--o| ItemVehicleEngineAssoc : "IVC_IVEA"
    ItemVehicleConfig ||--o| ItemVehicleBrakeAssoc : "IVC_IVBA"
    ItemVehicleConfig ||--o| ItemVehicleTransmissionAssoc : "IVC_IVTA"

    ItemVehicleAssoc ||--o{ ItemVehicleEngineAssoc : "IVEA_IVA"
    ItemVehicleAssoc ||--o{ ItemVehicleBrakeAssoc : "IVBA_IVA"
    ItemVehicleAssoc ||--o{ ItemVehicleTransmissionAssoc : "IVTA_IVA"
`;

# 🏆 PIM Data Architecture & Graph Analysis
> A high-fidelity, premium map of the PIM (Product Information Management) backend data models, orchestrations, and fitment pipelines.

This document serves as the "God Eye" architectural blueprint for the OFBiz PIM plugin, leveraging deep structural insights extracted from the **Graphify Knowledge Graph**. It details how raw PIES/ACES automotive data is ingested, standardized, and orchestrated before hitting the downstream applications (like AutoCore).

---

## 1. 🏮 The "God Nodes" (Core Orchestration)
The PIM backend is driven by a highly cohesive set of Java services. Based on our latest network graph analysis, the system operates across **23 strict communities**, governed by the following core abstractions:

> [!IMPORTANT]
> **Architectural Law**: Any new integration or API endpoint must route through these established God Nodes. Bypassing these hubs (e.g., writing raw SQL instead of using \`PIMUtil\`) will fracture the knowledge graph and create technical debt.

* **\`PIMUtil\` (71 Edges)**: The ultimate cross-community bridge. Responsible for global operations, caching, and entity-agnostic validations.
* **\`PIESImportServices\` (41 Edges) - *Community 0 (The Inbound Hub)***: The beating heart of product ingestion. Parses raw PIES XML/CSV and orchestrates the massive \`Item\` entity graph.
* **\`ACESImportServices\` / \`ACESScorecard\` - *Community 5 (The Fitment Hub)***: Handles vehicle-to-part applicability, scoring data quality against Auto Care Association standards.
* **\`PIMPartyHelper\` (39 Edges)**: Central authority for Supplier, Manufacturer, and internal Party abstractions.

---

## 2. 📦 The PIES Data Model (Product Structure)
The PIES model is centered around the massive \`Item\` entity. Unlike standard OFBiz \`Product\`, the \`Item\` entity is heavily denormalized for high-speed PIES extraction and validation.

### PIES Entity Relationship Diagram

<ZoomableMermaid chart={piesErd} title="PIES Entity Relationship Diagram" />

> [!NOTE]
> **Performance Optimization**: The \`Item\` entity relies heavily on composite indexes (e.g., \`PART_BRAND_IDX\` on \`partNumber + brandAaiaId\`) to ensure lightning-fast \`O(1)\` lookups during massive bulk imports.

---

## 3. 🏎️ The ACES Data Model (Fitment & VCDB)
While PIES defines *what* the part is, ACES defines *where* the part fits. The PIM system uses a highly granular relational model mapping the \`AcesItem\` directly to the **Vehicle Configuration Database (VCDB)**.

### ACES Engine & Fitment ERD

<ZoomableMermaid chart={acesErd} title="ACES Engine & Fitment ERD" />

> [!WARNING]
> **Complexity Alert**: The \`ItemVehicleConfig\` acts as an intermediary aggregator. A single part might fit thousands of vehicles, but only specific Engine/Transmission combinations. Queries to the ACES model must use \`JOIN FETCH\` or highly optimized Solr indexing to avoid N+1 latency cascades.

---

## 4. 🔗 The PIM to AutoCore Bridge
The data lifecycle flows linearly from PIM -> AutoCore. 

1. \`PIESImportServices\` (PIM) ingests supplier data into the \`Item\` entity.
2. \`ACESImportServices\` (PIM) ingests fitment data into \`AcesItem\`.
3. The PIM Export Engine pushes a standardized payload to the downstream systems.
4. Downstream (AutoCore), the `importMemberProduct` service translates these master records into the localized `Product`, `ProductFacility`, and `LegacyBrandMapping` entities optimized for high-speed POS retrieval.

> **Design Ethos**: PIM is the absolute source of truth (Gold Standard Data). AutoCore is the highly-available, high-speed transactional boundary.
