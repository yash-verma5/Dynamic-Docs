---
title: AutoCore Data Model — Complete Entity-by-Entity Mapping
hide_table_of_contents: false
view_mode: full
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

export const fullErdChart = `
erDiagram
    Party ||--o{ PartyRole : "plays"
    Party ||--o{ LegacyBrandMapping : "owns (domainPartyId)"
    Party ||--o{ Agreement : "party to"
    Party ||--o{ Facility : "owns"

    LegacyBrandMapping }|--|| Product : "resolves brand for"

    Product ||--o{ ProductCategoryMember : "belongs to"
    Product ||--o{ ProductPackage : "has packaging"
    Product ||--o{ ProductFacility : "stocked at"
    Product ||--o{ ProductPrice : "priced at"
    Product ||--o{ ProductFeatureAppl : "has feature applied"
    Product ||--o{ ProductAttribute : "has attribute"
    Product ||--o{ GoodIdentification : "identified by"
    Product ||--o{ ProductContent : "has content"
    Product ||--o{ ProductAssoc : "associated to"

    ProductAssoc }|--|| Product : "links to (productIdTo)"

    ProductCategory ||--o{ ProductCategoryMember : "contains"
    ProductCategory ||--o{ ProductCategoryRollup : "child of"

    ProductFeature ||--o{ ProductFeatureAppl : "applied via"
    ProductFeatureType ||--o{ ProductFeature : "classifies"
    ProductPackageType ||--o{ ProductPackage : "typed by"

    Facility ||--o{ ProductFacility : "hosts"

    Agreement ||--o{ ProductPrice : "governs (NAP)"

    Product {
        string productId PK
        string partNumber
        string aaiaBrandId
        string domainPartyId
        string internalName
        string isHazardousMaterial
        string minimumOrderQuantity
        string minimumOrderQuantityUomId
        string harmonizedTariffCode
        string nationalPopularityCode
        string acesApplications
        string inventoryMessage
        string statusId
        string isHawkIndexed
        string primaryProductCategoryId
        string isVirtual
        string isVariant
    }

    LegacyBrandMapping {
        string domainPartyId PK
        string mfrLineCode PK
        string mfrSubLineCode PK
        string aaiaBrandId
    }

    ProductFacility {
        string productId PK
        string facilityId PK
        string isPrimaryFacility
        decimal invDemand
        decimal quantityOnHand
        decimal posUnits
        datetime lastInventoryDate
    }

    ProductPackage {
        string productId PK
        string productPackageTypeId PK
        datetime fromDate PK
        string gtinId
        decimal quantityIncluded
        decimal weight
        string weightUomId
        decimal height
        string heightUomId
        decimal width
        string widthUomId
        decimal packageDepth
        string depthUomId
    }

    ProductPrice {
        string productId PK
        string productPricePurposeId PK
        string productPriceTypeId PK
        string productStoreGroupId PK
        datetime fromDate PK
        decimal price
        string currencyUomId
    }

    ProductFeature {
        string productFeatureId PK
        string productFeatureTypeId
        string description
        string idCode
    }

    ProductAttribute {
        string productId PK
        string attrName PK
        string attrValue
        string attrType
    }

    GoodIdentification {
        string productId PK
        string goodIdentificationTypeId PK
        string idValue
    }

    ProductCategory {
        string productCategoryId PK
        string productCategoryTypeId
        string categoryName
        string description
        string primaryParentCategoryId
    }
`;

export const acesVehicleHierarchyChart = `
erDiagram
    BaseVehicle ||--o{ Vehicle : "has variants (PRODUCT_VARIANT)"
    Vehicle ||--o{ VehicleConfig : "has configs (PRODUCT_VARIANT)"
    VehicleConfig ||--o{ VehiclePart : "fits parts (VEHICLE_APPL)"
    VehicleConfig ||--o{ ProductFeatureGroupProductAppl : "configured with"
    ProductFeatureGroup ||--o{ ProductFeatureGroupProductAppl : "applied to"
    ProductFeatureGroup }|--|| ProductFeatureGroupType : "typed by"
    Vehicle ||--o{ ProductGeo : "region-scoped by"
    Vehicle ||--o{ ProductFeatureAppl : "has sub-model"
    BaseVehicle ||--o{ ProductCategoryMember : "classified by Make/Model/Year"

    BaseVehicle {
        string productId PK
        string productName
        string internalName
        string isVirtual
        string isVariant
    }

    Vehicle {
        string productId PK
        string productName
        string internalName
        string isVirtual
        string isVariant
    }

    VehicleConfig {
        string productId PK
        string internalName
        string isVirtual
        string isVariant
    }

    ProductGeo {
        string productId PK
        string geoId PK
        string description
    }

    ProductFeatureGroupType {
        string productFeatureGroupTypeId PK
        string description
    }
`;

export const importWorkflowChart = `
sequenceDiagram
    participant CSV as Member Product CSV
    participant WRAP as importMemberProductWrapper
    participant LBM as LegacyBrandMapping
    participant PROD as Product Entity
    participant PKG as ProductPackage
    participant PRICE as ProductPrice
    participant FEAT as ProductFeature
    participant INV as ProductFacility (JDBC)
    participant SCORE as Scorecard

    CSV->>WRAP: Single-threaded batch row
    WRAP->>LBM: Resolve aaiaBrandId from mfrLineCode
    LBM-->>WRAP: aaiaBrandId resolved
    WRAP->>PROD: Upsert Product (B-Segment & E-Segment PIES)
    WRAP->>PKG: Upsert ProductPackage (dimensions, GTIN)
    WRAP->>PRICE: Upsert ProductPrice (P1-P8, MSR, CORE, etc.)
    WRAP->>FEAT: Apply ProductFeatures (PAdb, PADB_ATTRIBUTE)
    WRAP->>INV: JDBC batch update ProductFacility (invDemand, QOH)
    WRAP->>SCORE: Update scorecard (newPartsAdded, LBM match, GTIN status)
`;

# AutoCore Data Model — Complete Entity-by-Entity Mapping

> **Source of truth**: Every entity and field below is derived from actual production data files in `autocore/data/`, `entitydef/entitymodel.xml`, and `entitydef/entitymodel_vcdb.xml`.

---

> [!IMPORTANT]
> **Single-Threaded Processing for Member Products**
> While standard OFBiz data imports (like `ImportDataFromCSV1`) utilize multi-threading, **Member Product CSV imports (`configId=8005`) run via a Single-Threaded route (`importMemberProductWrapper`)** in production.
> This is because importing a member product orchestrates a complex entity graph (Product → Pricing → Inventory → Features → Category Membership), uses raw JDBC batching for high-frequency `ProductFacility` changes, and maintains global scorecard state (`newPartsAdded`, `globalLBMMapCount`). Multi-threading would cause race conditions and database deadlocks across these interdependent writes.

---

## Part 1 — The PIES Domain (Product Information)

### 1.1 `Product` (Extended OFBiz Entity)

The **hub** of the entire data model. Every other entity connects here.

**Dual-key identity:**
| Key Path | Fields |
|---|---|
| Legacy ERP | `domainPartyId` + `mfrLineCode` + `mfrSubLineCode` + `partNumber` |
| AAIA Standard | `domainPartyId` + `aaiaBrandId` + `aaiaSubBrandId` + `partNumber` |

**Field Mapping (from production data):**

| Field | Example Value | Description |
|---|---|---|
| `productId` | `10000004` | Internal OFBiz surrogate key |
| `partNumber` | `CF4757` | Manufacturer's part number |
| `internalName` | `BGBTCF4757` | Brand prefix + partNumber (search key) |
| `domainPartyId` | `AutoCore` | Tenant/organization partition |
| `aaiaBrandId` | `32439` | AAIA brand identifier |
| `allianceProductId` | `12372` | Aftermarket Alliance network ID |
| `primaryProductCategoryId` | `22061` | FK → ProductCategory hierarchy |
| `isHazardousMaterial` | `Y` / `N` | Boolean (PIES Segment B03) |
| `minimumOrderQuantity` | `1.000000` | PIES Segment B55 |
| `minimumOrderQuantityUomId` | `CA` | Case / EA / etc. (from `AutoCoreTypeData.xml` Uom table) |
| `harmonizedTariffCode` | `8421230000` | Schedule B tariff code |
| `nationalPopularityCode` | `NPC_Z` | AAIA Popularity Code (PIES E10-NPC) |
| `acesApplications` | `Y` / `N` | Has ACES fitment records? |
| `inventoryMessage` | `PBActive` | Lifecycle/inventory status |
| `isHawkIndexed` | `Y` / `N` | Synced to Hawk Search engine? |
| `hawkIndexedDate` | `2019-01-04 00:14:38.0` | Last Hawk sync timestamp |
| `autoCreateKeywords` | `N` | Auto-generate search keywords |
| `statusId` | `PRODUCT_STS_C` | PIES EXPI status (see below) |

**PIES EXPI Status Codes** (from `AutoCoreTypeData.xml`):

| `statusId` | `statusCode` | Description |
|---|---|---|
| `PRODUCT_STS_0` | `0` | Proposed |
| `PRODUCT_STS_1` | `1` | Released |
| `PRODUCT_STS_C` | `C` | Current |
| `PRODUCT_STS_5` | `5` | Temporarily Unavailable |
| `PRODUCT_STS_7` | `7` | Superseded |
| `PRODUCT_STS_8` | `8` | Discontinued |
| `PRODUCT_STS_9` | `9` | Obsolete |

---

### 1.2 `LegacyBrandMapping`

**Purpose**: Translates legacy ERP line codes into modern AAIA brand IDs. This is the **first operation** performed by `importMemberProductWrapper` before any product record can be resolved or upserted.

| Field | Example Value | Description |
|---|---|---|
| `aaiaBrandId` | `29370`, `32123`, `29372` | Modern AAIA brand ID (FK → AAIA standard) |
| `domainPartyId` | `1666` | Tenant partition |
| `mfrLineCode` | `1666_LIS` | Legacy manufacturer line code |
| `mfrSubLineCode` | `1666_LIS_LIS` | Legacy manufacturer sub-line code |

**Import service**: `configId=8009` → `importLegacyBrandMapping`

---

### 1.3 `ProductCategory` & `ProductCategoryType`

The AutoCore model uses a very specific category type hierarchy (from `AutoCoreTypeData.xml`):

| `productCategoryTypeId` | Description |
|---|---|
| `AAIA` | Root AAIA category type |
| `AAIA_BRAND` | Brand-level category |
| `AAIA_SUBBRAND` | Sub-brand category |
| `AAIA_CATEGORY` | Product category (parent: AAIA) |
| `AAIA_SUBCATEGORY` | Product subcategory |
| `AAIA_TERMINOLOGY` | AAIA Part Terminology |
| `AAIA_POSITIONS` | Fitment position |
| `ERP_LINE` | Legacy ERP Line Code |
| `ERP_SUBLINE` | Legacy ERP Sub-Line Code |
| `EPICOR_CATEGORY` | Epicor catalog category |
| `ACDB_CATEGORY` | ACdb catalog category |
| `VEHICLE_MAKE` | Vehicle Make (used in ACES) |
| `VEHICLE_MODEL` | Vehicle Model (used in ACES) |
| `VEHICLE_YEAR` | Vehicle Year (used in ACES) |

From `AutoCoreCatalogData.xml`, the root catalog is `AAIA_ROOT_CATALOG` with `AAIA_PART_SEARCH_CAT` as the search category. OE parts use a separate `OE_CATALOG` → `OE_PART_SEARCH_CAT`.

---

### 1.4 `ProductPackage` & `ProductPackageType`

Maps to **PIES Package Segments** (physical dimensions, barcodes, weight).

| Field | Example Value | Description |
|---|---|---|
| `productId` | `10008` | FK → Product |
| `productPackageTypeId` | `EA` / `CA` | PIES PACK code |
| `gtinId` | `00019495070702` | GTIN/UPC barcode |
| `quantityIncluded` | `1.000000` / `20.000000` | Items per package |
| `weight` | `7.950000` | Gross weight |
| `weightUomId` | `WT_lb` | Weight unit of measure |
| `height` | `10.375000` | Height dimension |
| `heightUomId` | `IN` | Height UoM |
| `width` | `11.375000` | Width dimension |
| `widthUomId` | `IN` | Width UoM |
| `packageDepth` | `24.375000` | Depth dimension |
| `depthUomId` | `IN` | Depth UoM |
| `fromDate` | `2017-06-02 19:58:27.992` | Effective date |

**PIES PACK Codes** (from `AutoCoreTypeData.xml`):
- `EA` = Smallest Pack (Consumer Level)
- `PK` = Inner Pack (shippable)
- `BX` = Inner Pack (non-shippable)
- `CA` = Case
- `PL` = Pallet

---

### 1.5 `ProductFacility` (Extended — JDBC-Batched)

Tracks inventory at a specific warehouse. **Updated via raw JDBC batching** (not OFBiz Entity Engine) during `importMemberProduct` to avoid performance degradation and locking.

| Field | Example Value | Description |
|---|---|---|
| `productId` | `10000004` | FK → Product |
| `facilityId` | `10643` | FK → Facility (warehouse/store ID) |
| `isPrimaryFacility` | `Y` | Boolean — primary stocking location |
| `invDemand` | `0.000000` | Historical demand velocity metric |
| `quantityOnHand` | — | Physical stock count |
| `posUnits` | — | Point-of-sale units (from DW) |
| `lastInventoryDate` | `2018-12-22 07:24:25.0` | Last inventory reconciliation date |

**Inventory lookup methods** (configured per `Facility.inventoryLookupMethod`):

| `enumCode` | Description |
|---|---|
| `STANDARD` | Uses OFBiz `InventoryItem` records |
| `ERP_SNAPSHOT` | Uses `ProductFacility.lastInventoryCount` from ERP |
| `VIC_SNAPSHOT` | Uses VIC (Vendor Inventory Connection) snapshot |
| `VIC` | Live VIC quote request |
| `IPO` | Live IPO quote request |

---

### 1.6 `ProductPrice` (Extended)

One product can carry **multiple simultaneous price points** for different channels, tiers, and agreements.

| Field | Example Value | Description |
|---|---|---|
| `productId` | `10000001` | FK → Product |
| `productPricePurposeId` | `PURCHASE` / `SUPPLY` / `NAP_PRICE` | Context of the price |
| `productPriceTypeId` | `P1` / `P2` / `MSR` / `WD1` | Price tier code |
| `productStoreGroupId` | `_NA_` | Geographic/org price group |
| `price` | `252.400` | Monetary value |
| `currencyUomId` | `USD` | Currency |
| `fromDate` | `2018-12-24 12:47:24.576` | Effective start date |

**Key `productPriceTypeId` values** (from `AutoCoreTypeData.xml`):

| Code | Description |
|---|---|
| `P1`–`P8` | WD (Warehouse Distributor) Price tiers |
| `MSR` | Manufacturer's Suggested Retail |
| `JOBBER_PRICE` | Jobber Price |
| `CORE_PRICE` | Core Price (surcharge/deposit) |
| `WD1` | Distributor's Price |
| `CAT` | Catalog Price |
| `LIST_PRICE` | Standard List Price (OE parts) |
| `NAP_PRICE` | National Account Pricing |

---

### 1.7 `ProductFeature` & `ProductFeatureType`

The **flexible extension layer** for PIES/PAdb attributes that don't fit fixed Product columns.

| Field | Example Value | Description |
|---|---|---|
| `productFeatureId` | `100091` | Surrogate key |
| `productFeatureTypeId` | `EMISSION_CODE` / `2000` | Type classifier |
| `description` | `Legal` / `5720838` | Human-readable value |
| `idCode` | `1` | External code/reference |

**Key `productFeatureTypeId` values** (from `AutoCoreTypeData.xml`):

| Type | Description |
|---|---|
| `EMISSION_CODE` | Emission compliance code |
| `WARRANTY_YEARS` / `WARRANTY_MONTHS` | Warranty duration |
| `HAZMAT` | Hazardous material flag |
| `LENGTH` / `STROKE` | Physical measurements |
| `2000`–`2032` | PAdb (Product Attribute Database) attributes (Brake Shoe Width, Friction Material, Hub Type, etc.) |

**Feature Application Types** (how features attach to products):
- `PADB_ATTRIBUTE` — PAdb standard attribute
- `SAT_ATTRIBUTE` — Supplies Accessories & Tools attribute
- `STANDARD_FEATURE` — Standard vehicle feature (used in ACES)

---

### 1.8 `ProductAttribute`

Key-value store for product attributes that are not standard PAdb features.

From `AutoCoreCatalogData.xml` (OE parts):
```xml
<ProductAttribute productId="2088" attrName="oePartCoreFlag" attrValue="N" attrType="OE_PART_CORE_FLAG"/>
```

Stores dynamic PIES data like `isPcdbAttribute`, `sequenceNum`, `languageId`.

---

### 1.9 `GoodIdentification`

Cross-reference table mapping product IDs across multiple external systems.

| `goodIdentificationTypeId` | Description |
|---|---|
| `MANUFACTURER_ID_NO` | MPN — Manufacturer Part Number |
| `VMRS` | Vehicle Maintenance Reporting System code |
| `ACCUPI_PART_ID` | AccuPI OE part ID |
| `ACCUPI_PART_ID_USA` | AccuPI US-specific OE part ID |
| `ACCUPI_PART_ID_CAN` | AccuPI Canada-specific OE part ID |

---

### 1.10 `ProductContent` & `ProductContentType`

Rich media and text content attached to a product (from `AutoCoreTypeData.xml`):

| Type | Description |
|---|---|
| `KEYWORD_SEARCH` | Search keywords |
| `EXTENDED_DESC` | Extended description |
| `MARKETING_DESC` | Marketing description |
| `MKT_CTNT` | Market Copy content |
| `DIGITAL_ASSET` | Images, PDFs, videos |
| `INVOICE_DESC` | Invoice description |
| `SHIPPING_RESTRICTION` | Shipping restriction notes |
| `ACA_DEF_IMAGE` | ACA default product image |

---

## Part 2 — The ACES / VCdb Domain (Vehicle Configuration)

The ACES domain uses the **OFBiz Product entity as a polymorphic node** to represent Vehicles. This is a critical design decision — vehicles are Products with `isVirtual=Y` or `isVariant=Y`, connected via `ProductAssoc` and `ProductFeatureGroupProductAppl`.

### 2.1 Three-Level Vehicle Hierarchy

```
BaseVehicle (isVirtual=Y, isVariant=N)
    └── Vehicle [per Region] (isVirtual=Y, isVariant=Y)
            └── VehicleConfig (isVirtual=N, isVariant=Y)
```

**From `AutoCoreVCDBData.xml`:**

```xml
<!-- Level 1: Base Vehicle (Year+Make+Model) -->
<Product productId="1010" productName="2009 Chevrolet Suburban 1500" internalName="30025"
         isVirtual="Y" isVariant="N"/>

<!-- Level 2: Vehicle (Submodel + Region) -->
<Product productId="1250" productName="2009 Chevrolet Suburban 1500 LT" internalName="72128"
         isVirtual="Y" isVariant="Y"/>
<ProductGeo productId="1250" geoId="USA" description="1"/>

<!-- Level 3: VehicleConfig (Engine+Transmission+Brake+Body+Drive configs) -->
<Product productId="1100" internalName="VC-1100" isVirtual="N" isVariant="Y"/>
```

### 2.2 Vehicle Relationship Chains

| Relationship | Entity | `productAssocTypeId` |
|---|---|---|
| BaseVehicle → Vehicle | `ProductAssoc` | `PRODUCT_VARIANT` |
| Vehicle → VehicleConfig | `ProductAssoc` | `PRODUCT_VARIANT` |
| VehicleConfig → Part | `ProductAssoc` | `VEHICLE_APPL` |
| VehicleConfig → Features | `ProductFeatureGroupProductAppl` | (engine, trans, brake, etc.) |
| Vehicle → Sub-Model | `ProductFeatureAppl` | `STANDARD_FEATURE` |

### 2.3 Vehicle Configuration Feature Groups (from `AutoCoreVCDBTypeData.xml`)

Each `VehicleConfig` product has a set of `ProductFeatureGroup`s attached, one per system:

| Feature Group Type | Feature Types | Description |
|---|---|---|
| `ENGINE_CONFIG` | `ENGINE_LTR`, `ENGINE_CC`, `CYLINDERS`, `BLOCK_TYPE`, `FUEL_DELIVERY_CONFIG`, `ASPIRATION`, `HORSE_POWER` | Full engine specification |
| `TRANSMISSION` | `TRANSMISSION_TYPE`, `TRANSMISSION_SPD`, `TRANSMISSION_CTRL` | Transmission details |
| `BRAKE_CONFIG` | `FRONT_BRAKE_TYPE`, `REAR_BRAKE_TYPE`, `BRAKE_SYSTEM`, `BRAKE_ABS` | Brake system |
| `SPRING_TYPE_CONFIG` | `FRONT_SPRING_TYPE`, `REAR_SPRING_TYPE` | Suspension springs |
| `STEERING_CONFIG` | `STEERING_TYPE`, `STEERING_SYSTEM` | Steering type |
| `BODY_STYLE_GRP` | `BODY_STYLE` | Body style (sedan, SUV, etc.) |
| `BODY_STYLE_CONFIG` | `BODY_NUM_DOORS`, `BODY_TYPE` | Body configuration |
| `DRIVE_TYPE_GRP` | `DRIVE_TYPE` | FWD / RWD / AWD / 4WD |
| `BED_CONFIG` | `BED_LENGHT`, `BED_TYPE` | Truck bed config |
| `WHEEL_BASE_GRP` | `WHEEL_BASE`, `WHEEL_BASE_MATRIC` | Wheelbase measurement |
| `MFR_BODY_CODE_GRP` | `MFR_BODY_CODE` | Manufacturer body code |

### 2.4 Vehicle Category Classification

The Make/Model/Year classification is done via `ProductCategory` + `ProductCategoryMember`:

```xml
<ProductCategory productCategoryId="1010" productCategoryTypeId="VEHICLE_MAKE" categoryName="47" description="Chevrolet"/>
<ProductCategory productCategoryId="1011" productCategoryTypeId="VEHICLE_MODEL" categoryName="497" description="Suburban 1500"/>

<!-- Associates BaseVehicle to Make, Model, and Year categories -->
<ProductCategoryMember productCategoryId="1010" productId="1010"/>  <!-- Make -->
<ProductCategoryMember productCategoryId="1011" productId="1010"/>  <!-- Model -->
<ProductCategoryMember productCategoryId="1014" productId="1010"/>  <!-- Year -->
```

### 2.5 Region Mapping

Vehicles are region-scoped via `ProductGeo`:

| `geoId` | `description` | Region |
|---|---|---|
| `USA` | `1` | United States |
| `CAN` | `2` | Canada |
| `MEX` | `3` | Mexico |

Vehicle region group `VRG` includes USA, CAN, and MEX.

---

## Part 3 — The Organization / Party Domain

### 3.1 `Party` Hierarchy

From `AutoCoreExtData.xml`, the core organizational structure:

| `partyId` | `groupName` | Role(s) | Description |
|---|---|---|---|
| `AAIA` | AAIA | `ASSOCIATION`, `CONTENT_ADMIN` | The Auto Care Association |
| `AutoCore` | AutoCore | `ASSOCIATION`, `OWNER`, `DOMAIN_PARTY` | AutoCore (primary tenant) |
| `AHQ-W` | AHQ-W | `INTERNAL_ORGANIZATIO`, `DOMAIN_PARTY` | APW (Alliance Parts Warehouse) |

**OE Manufacturers** (from `AutoCoreCatalogData.xml`):

| `partyId` | `groupName` | OE MFR ID |
|---|---|---|
| `6656` | Chrysler | `5` |
| `6657` | Acura (Honda) | `1` |
| `6658` | Ford | `8` |
| `6659` | BMW | `4` |

### 3.2 National Account Programs (NAP)

The NAP system ties pricing to customer groups via `Agreement` entities.

**Flow**: `Party (AutoCore)` → `Agreement (NAP_AGREEMENT)` → `Party (CustomerGroup)` → `PartyIdentification (NAP_PRICE_CODE)`

| `agreementId` | Customer Group | Price Code Ref/Core |
|---|---|---|
| `1800` | Firestone | `ZAA` / `ZAB` |
| `1801` | Goodyear TSN | `ZAC` / `ZAD` |
| `1803` | Meineke | `ZAG` / `ZAH` |
| `1805` | Pep Boys | `ZAK` / `ZAL` |

---

## Part 4 — Import Configuration Map

From `AutoCoreExtData.xml`, all `DataManagerConfig` entries:

| `configId` | Service | Script Title | Format |
|---|---|---|---|
| `8004` | `importAPWProducts` | APW Products | CSV |
| `8005` | `importMemberProduct` | **Member Products** ⚠️ single-threaded | CSV |
| `8006` | `importVicInventorySnapshot` | VIC Inventory Snapshot | XML |
| `8007` | `importAAIABrands` | AAIA Brands | CSV |
| `8009` | `importLegacyBrandMapping` | Legacy Brand Mapping | CSV |
| `8011" | `importPIES` | PIES | XML |
| `8015" | `importNAPProductPrices` | NAP Product Pricing | CSV |
| `8022" | `importMemberProductInventory` | Member Product Inventory | CSV |
| `8023" | `importPIESSAX` | PIES SAX Parser | XML SAX |

---

## Part 5 — Full Entity Relationship Diagram (ERD)

<ZoomableMermaid chart={fullErdChart} title="AutoCore Full Entity Relationship Diagram" />

---

## Part 6 — ACES Vehicle Hierarchy ERD

<ZoomableMermaid chart={acesVehicleHierarchyChart} title="ACES Vehicle Hierarchy & Configuration" />

---

## Part 7 — Import Workflow Sequence

<ZoomableMermaid chart={importWorkflowChart} title="Member Product Import Workflow" />

---

*Generated from: `autocore/data/*.xml` | Last updated: 2026-05-02*
