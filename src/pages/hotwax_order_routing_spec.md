---
title: HotWax OMS Order Routing Specification
hide_table_of_contents: false
view_mode: full
---

import HomeBackButton from '@site/src/components/HomeBackButton';
import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import HotWaxRoutingSimulator from '@site/src/components/HotWaxRoutingSimulator';

<HomeBackButton />

<div style={{
  background: '#0a0a0a',
  borderLeft: '6px solid #d4af37',
  borderRight: '6px solid #d4af37',
  padding: '25px',
  borderRadius: '10px',
  marginBottom: '30px',
  boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
  textAlign: 'center'
}}>
  <h1 style={{ color: '#ff3b30', fontFamily: "'Outfit', 'Segoe UI', sans-serif", fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', margin: 0, fontSize: '2.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
    ♛ HotWax OMS: Order Routing Architectural Specification
  </h1>
  <div style={{ width: '120px', height: '3px', background: 'linear-gradient(90deg, #ff3b30, #d4af37)', margin: '15px auto' }}></div>
  <p style={{ color: '#d4af37', fontFamily: "'Inter', sans-serif", fontSize: '1.15rem', marginTop: '5px', marginBottom: 0, fontWeight: 600, letterSpacing: '1px' }}>
    Fulfillment Optimization, Inventory Topology, and Gap Analysis
  </p>
</div>

---

# I. Scenario Overview & Architectural Context

This document provides a comprehensive technical and functional evaluation of the **HotWax Order Routing Engine (`OrderRouting`)** against the operational specifications of a **Premium Disposable Aluminum Products Business**. 

The business relies on a high-velocity, bulky-product supply chain utilizing **two primary US warehouses**:
1. **East Coast Warehouse** (NJ, serving primary East Zone density)
2. **West Coast Warehouse** (CA, serving primary West Zone density)

As online sales expand to retail customers, the company requires a routing framework that minimizes shipping distances, enforces single-facility fulfillment, gracefully handles inventory depletion fallbacks, scales automatically to new warehouses, and supports an intelligent **Transfer Order Suggestion (TOS)** model.

---

# II. Action -> Reaction -> Workflow Sequence

This sequence outlines how an ingested customer order is processed, filtered, evaluated, and assigned to a fulfillment facility.

### Action-Reaction Matrix

| Phase | System / Actor | Action | System Reaction | Entity State Change |
| :--- | :--- | :--- | :--- | :--- |
| **1. Ingest** | Shopify Store | Places order containing multiple items | OMS ingests order; marks ship group for routing | `OrderHeader.statusId` ➔ `ORDER_APPROVED`<br/>`OrderItem.statusId` ➔ `ITEM_APPROVED`<br/>`OrderItemShipGroup.facilityId` ➔ `HQ_QUEUE` (Virtual Queue) |
| **2. Trigger** | Scheduler / Admin | Triggers Routing Run for `OrderRoutingGroup` | Engine queries database for unbrokered orders | Creates `OrderRoutingRun` & `OrderRoutingBatch` records tracking run metadata |
| **3. Proximity** | Routing SQL | Calculates sphere distance to all active warehouses | Sorts warehouses in ascending order of distance | Computes dynamic `distance` field using `ST_Distance_Sphere` between customer address & facility address |
| **4. Enforce** | Routing SQL | Applies `ORA_SINGLE` constraint for single-facility check | Excludes any warehouse that cannot fulfill 100% of items in ship group | Filters results where `rank_by_order_at_facility = 'Y'` or `rank_by_order_above_facility_threshold = 'Y'` |
| **5. Allocate** | Routing Engine | Selects highest-ranked warehouse | Calls `process#OrderFacilityAllocation` to commit selection | Updates `OrderItemShipGroup.facilityId` ➔ `WAREHOUSE_ID` (e.g., East Coast WH) |
| **6. Reserve** | Inventory System | Creates physical stock reservations | Deducts from Available-to-Promise (ATP) at chosen facility | Creates `OrderItemShipGrpInvRes` mapping item to facility inventory item |
| **7. Handle** | Rule Engine | If OOS at all warehouses, applies "Unfillable" rule action | Moves order to unfillable queue or leaves unrouted | Updates `OrderItemShipGroup.facilityId` ➔ `UNFILLABLE_QUEUE` (if `ORA_MV_TO_QUEUE` is active) |

---

## 🎮 Interactive Routing Simulator
Try out real-time routing runs using our high-fidelity sandboxed simulator. Configure order payloads, toggle constraints, and analyze step-by-step Moqui engine execution logs.

<HotWaxRoutingSimulator />

---

### Core Workflow Sequence Diagram

export const coreWorkflow = `
sequenceDiagram
    autonumber
    actor Customer as Retail Customer
    participant Store as Shopify Storefront
    participant OMS as HotWax OMS Core (OFBiz)
    participant Routing as Order Routing Engine (Moqui)
    participant DB as MySQL Database

    Customer->>Store: Places Multi-Item Aluminum Order
    Store->>OMS: Ingests Order (Status: ORDER_APPROVED)
    OMS->>DB: Save Order, Items, and ShipGroup (facilityId = HQ_QUEUE)
    Routing->>DB: Query Eligible Orders (facilityId of type HQ_QUEUE)
    DB-->>Routing: Return Unbrokered Orders

    Note over Routing,DB: Executing InventorySourceSelector.sql.ftl

    Routing->>DB: Execute Geo-Proximity & Inventory Check (ORA_SINGLE)
    DB-->>Routing: Suggested Facility List (Distance Sorted, Single-Facility Restructured)

    alt Stock Available at Closest Facility (e.g., East WH)
        Routing->>OMS: Call process#OrderFacilityAllocation (East WH)
        OMS->>DB: Update facilityId = WAREHOUSE_EAST & Create Reservations
        OMS-->>Customer: Shipment SLA Confirmed (East)
    else Closest OOS, Stock Available at Fallback (West WH)
        Routing->>OMS: Call process#OrderFacilityAllocation (West WH)
        OMS->>DB: Update facilityId = WAREHOUSE_WEST & Create Reservations
        OMS-->>Customer: Shipment SLA Confirmed (West)
    else OOS at both (Unfillable)
        alt Action ORA_MV_TO_QUEUE Configured
            Routing->>OMS: Run Action 'ORA_MV_TO_QUEUE' (Move to Unfillable)
            OMS->>DB: Update facilityId = UNFILLABLE_QUEUE
        else No Action Configured
            Routing->>Routing: Retain in UNROUTED_QUEUE
        end
        Note over Routing,OMS: weekly TOS Engine Suggestion (Functional Debt Gap)
        Routing->>DB: Generate Weekly TOS suggestions (Items to transfer East <-> West)
    end
`;

<ZoomableMermaid chart={coreWorkflow} title="HotWax Order Routing Sequence Diagram" />

---

# III. State Transition Model

The state of an order during brokering is driven primarily by the `facilityId` field of its `OrderItemShipGroup` entity, while its administrative statuses remain `ORDER_APPROVED` and `ITEM_APPROVED`.

export const stateTransition = `
stateDiagram-v2
    [*] --> OrderApproved : Order Ingested (Shopify)
    OrderApproved --> UnroutedQueue : facilityId = HQ_QUEUE
    
    state UnroutedQueue {
        [*] --> EligibleForRouting
        EligibleForRouting --> RoutingRunning : Scheduled Batch Job
    }

    state RoutingRunning {
        [*] --> EvaluateFilterConditions
        EvaluateFilterConditions --> ProximitySort : ST_Distance_Sphere Calculation
        ProximitySort --> SingleFacilityValidation : ORA_SINGLE Check
    }

    RoutingRunning --> BrokeredState : Stock Found at Warehouse
    RoutingRunning --> UnfillableQueue : OOS & Action 'ORA_MV_TO_QUEUE' Configured
    RoutingRunning --> BackorderedState : OOS & No Queue Move Action

    state BrokeredState {
        [*] --> AssignWarehouse : Update facilityId = CHOSEN_WAREHOUSE
        AssignWarehouse --> ReserveInventory : Create OrderItemShipGrpInvRes
        ReserveInventory --> ReleasedForFulfillment : Ready to Pick & Pack
    }

    state UnfillableQueue {
        [*] --> AwaitInventory : Orders gathered in UNFILLABLE_QUEUE
        AwaitInventory --> GenerateWeeklyTOS : System scans OOS items
        GenerateWeeklyTOS --> SuggestTransfer : Prepare TOS Plan
        SuggestTransfer --> TransferApproved : Warehouse Manager Approves TOS
        TransferApproved --> InventoryAdjusted : Stock physical receipt at Warehouse
        InventoryAdjusted --> EligibleForRouting : Reset facilityId = HQ_QUEUE
    }
`;

<ZoomableMermaid chart={stateTransition} title="Fulfillment Lifecycle State Transitions" />

---

# IV. Entity Relationship Diagram (ERD)

The order routing engine sits as a hybrid intelligence layer. Core transaction data rests in **Apache OFBiz entities**, while routing rules, configurations, and run statistics reside in **Moqui entities**.

export const erdModel = `
erDiagram
    %% Core OFBiz Entities (Transactional)
    OrderHeader ||--|{ OrderItem : "contains"
    OrderHeader ||--|{ OrderItemShipGroup : "assigned_to"
    OrderItemShipGroup ||--|{ OrderItemShipGroupAssoc : "associates"
    OrderItemShipGroupAssoc }|--|| OrderItem : "maps"
    OrderItemShipGroup ||--|{ OrderItemShipGrpInvRes : "reserves_inventory_via"
    Facility ||--|{ OrderItemShipGroup : "acts_as_fulfillment_facility"
    Facility ||--|{ ProductFacility : "stocks"
    Product ||--|{ ProductFacility : "defined_at"
    ProductStore ||--|{ OrderHeader : "owns"
    ProductStore ||--|{ ProductStoreFacility : "registers"
    Facility ||--|{ ProductStoreFacility : "associated_with"
    PostalAddress ||--o| OrderItemShipGroup : "ships_to"
    PostalAddress ||--o| Facility : "located_at"

    %% Moqui Entities (Routing Configurations)
    ProductStore ||--|{ OrderRoutingGroup : "configured_by"
    OrderRoutingGroup ||--|{ OrderRouting : "runs"
    OrderRouting ||--|{ OrderFilterCondition : "filters_orders_with"
    OrderRouting ||--|{ OrderRoutingRule : "defines_routing_rules"
    OrderRoutingRule ||--|{ OrderRoutingRuleInvCond : "evaluates_inventory_conditions"
    OrderRoutingRule ||--|{ OrderRoutingRuleAction : "takes_actions"
    OrderRoutingGroup ||--|{ OrderRoutingRun : "executes"
    OrderRoutingBatch ||--|{ OrderRoutingRun : "groups"

    OrderHeader {
        id orderId PK
        id productStoreId FK
        id statusId
        id orderTypeId
        date-time orderDate
        numeric priority
    }
    OrderItem {
        id orderId PK
        id orderItemSeqId PK
        id productId FK
        id statusId
        numeric quantity
        numeric cancelQuantity
    }
    OrderItemShipGroup {
        id orderId PK
        id shipGroupSeqId PK
        id facilityId FK "Current Brokering Queue or Assigned Warehouse"
        id contactMechId FK "PostalAddress Ref"
        id shipmentMethodTypeId FK
    }
    ProductFacility {
        id productId PK, FK
        id facilityId PK, FK
        numeric lastInventoryCount "ATP"
        numeric minimumStock "Safety Stock Buffer"
        numeric salesVelocity "Average Sales Volume"
        varchar allowBrokering
    }
    OrderRoutingRule {
        id routingRuleId PK
        id orderRoutingId FK
        id assignmentEnumId "ORA_SINGLE or ORA_MULTI"
        varchar ruleName
        id statusId
    }
    OrderRoutingRuleInvCond {
        id routingRuleId PK, FK
        id conditionSeqId PK
        varchar fieldName "e.g., distance, weekOfSupply"
        varchar operator
        varchar fieldValue
    }
`;

<ZoomableMermaid chart={erdModel} title="Hybrid OFBiz & Moqui Entity Relationships" />

---

# V. Feasibility Analysis (Achievable vs. Gaps)

Based on an exhaustive review of the `OrderRouting` component's source code, SQL templates (`InventorySourceSelector.sql.ftl`, `EligibleOrdersQuery.sql.ftl`), and services (`OrderRoutingServices.xml`), we have analyzed the feasibility of your specific fulfillment rules.

### 1. What is Achievable (Out-of-the-Box)

*   **Proximity-Based Routing (Rule 1 - Nearest Warehouse Serving Order):**
    *   *Implementation:* Fully supported. The SQL engine calculates geographical distance using:
        ```sql
        ST_Distance_Sphere(point(fpa.LONGITUDE, fpa.LATITUDE), point(opa.LONGITUDE, opa.LATITUDE)) * conversionFactor AS distance
        ```
        It compares the customer's delivery postal address `contactMechId` with the facility's primary location coordinates. If the rule's `inventorySortByList` contains `distance`, warehouses are automatically sorted by proximity.
*   **Single Facility Fulfillment / No Partial Shipments (Rule 2):**
    *   *Implementation:* Fully supported. By configuring the routing rule with `assignmentEnumId = 'ORA_SINGLE'`, the query utilizes:
        ```sql
        ifnull((select distinct 'N' from order_item oi1 LEFT join product_facility pf1 ... where pf1.last_inventory_count < quantity ...),'Y') as rank_by_order_at_facility
        ```
        The routing engine filters out any warehouse that cannot fulfill 100% of the ship group items. No partial shipments are allowed; the order will either route in full to a single facility or fail brokering.
*   **Depletion Fallback (NY/East Coast to West Coast):**
    *   *Implementation:* Fully supported. Because the query sorts by `distance ASC` but filters by `rank_by_order_at_facility = 'Y'`, if the closest warehouse (East Coast) is missing even one item, it is excluded. The fallback warehouse (West Coast) is automatically selected as it is next in proximity that satisfies 100% stock availability.
*   **Warehouse Scaling (Rule 4 - Adding Warehouses with Same Activities):**
    *   *Implementation:* Fully supported. The proximity calculation is dynamic and spatial. Adding an arbitrary number of warehouses requires zero code changes. You only need to create a `Facility` record, map it to a primary `PostalAddress` with latitude/longitude coordinates, and register it to the `ProductStoreFacility` association.

---

### 2. What is NOT Achievable (Gaps & Functional Debt)

While the core brokering features exist, your specific constraints reveal **two major functional gaps**:

#### ❌ Gap A: Rule 3 (Prioritizing LOWER Inventory Turnover Ratio)
*   **The Conflict:** The existing system contains a `weekOfSupply` sorting mechanism. However, it is hardcoded to sort in **descending** order:
    ```sql
    week_of_supply is null asc, week_of_supply desc
    ```
    This standard design prioritizes facilities with the *maximum* weeks of supply left (to prevent fast stockouts at high-demand facilities). Your rule explicitly asks for the opposite: **prioritize warehouses with lower rollover days** (fewer weeks of supply left) to clean out stock or balance inventory turnout.
*   **The Solution:** This is a minor code customization gap. We must introduce a new sort parameter or modify the template to support `weekOfSupplyAsc` (or `lowerInventoryTurnover`).

```diff
                  pf.SALES_VELOCITY IS NULL ASC,pf.SALES_VELOCITY ASC
                <#elseif 'weekOfSupply' == inventorySortByList>
                  <#if weekOfSupply?has_content && weekOfSupply &gt; 0>
                    week_of_supply is null asc,week_of_supply desc
                  </#if>
+               <#elseif 'lowerInventoryTurnover' == inventorySortByList>
+                 <#if weekOfSupply?has_content && weekOfSupply &gt; 0>
+                   week_of_supply is null asc,week_of_supply asc
+                 </#if>
                <#else>
                  ${inventorySortBy!}
```

#### ❌ Gap B: Weekly inter-facility Transfer Order Suggestion (TOS)
*   **The Conflict:** The `OrderRouting` component is strictly an *Order Brokering Engine*. It does not possess a predictive replenishment or transfer suggestion engine out of the box. It cannot natively analyze multi-item unfillable backlogs in the `UNFILLABLE_QUEUE` and calculate optimal SKU-level bulk transfer suggestions between warehouses.
*   **The Solution (Proposed Architecture):** We must design a standalone weekly batch service (`suggest#InterWarehouseTransfers`) leveraging existing Apache OFBiz entities: `Requirement` (type `INTERNAL_REQ`), `InventoryTransfer`, and `Shipment`.

export const tosDiagram = `
classDiagram
    direction LR
    class UnfillableOrders {
        +id orderId
        +id shipGroupSeqId
        +List items
    }
    class TOSSuggestionService {
        +analyzeBacklog()
        +calculateOptimalTransfers()
        +createTOSRequirements()
    }
    class Requirement {
        +id requirementId PK
        +id requirementTypeId "INTERNAL_REQ"
        +id productId
        +id facilityId "Destination Facility (OOS)"
        +id facilityIdTo "Source Facility (With Stock)"
        +numeric quantity
        +id statusId "REQ_PROPOSED (TOS Suggested)"
    }
    class InventoryTransfer {
        +id inventoryTransferId PK
        +id facilityId "Source"
        +id facilityIdTo "Destination"
        +id productId
        +numeric xferQty
        +id statusId "IXF_REQUESTED"
    }
    UnfillableOrders --> TOSSuggestionService : Inputs
    TOSSuggestionService --> Requirement : Generates suggestions as
    Requirement --> InventoryTransfer : Promoted upon approval
`;

<ZoomableMermaid chart={tosDiagram} title="Replenishment Transfer suggestion Class Architecture" />

---

# VI. Antigravity Challenge: Thinking Around Corners
### 5 Critical Critiques of the Proposed Fulfillment Strategy

> [!IMPORTANT]
> The requested design is functionally direct, but structurally flawed under real-world operating conditions. Below are 5 "around-the-corners" critiques challenging your core operational assumptions to protect margins and customer experience.

### 1. The Risk of the "LOWER Inventory Supply Sort"
*   **The Fallacy:** Prioritizing warehouses with *lower* weeks of supply (Rule 3) means you are deliberately routing orders to the facility that is **fastest to deplete**. 
*   **The Trap:** If both East and West coast warehouses are equal days away from a customer, but the East Coast warehouse only has 10 days of supply remaining while the West Coast has 50 days of supply, Rule 3 will force fulfillment from the East Coast. This will trigger premature stockouts on the East Coast for orders that *cannot* be served by the West Coast (due to proximity limits or delivery day SLAs), forcing costly cross-country shipments for future orders.
*   **Strategic Recommendation:** Turn this rule upside down. Sort by `week_of_supply DESC` (standard HotWax behavior) to maintain balanced regional buffers, unless you are running a specific clearance sale or warehouse decommissioning event.

### 2. The Bulky-Margin Paradox of weekly Inter-Warehouse TOS
*   **The Fallacy:** Assuming that suggesting weekly SKU-level transfers between warehouses is an optimal way to fulfill unfillable multi-item orders.
*   **The Trap:** Aluminum disposable products (trays, foil pans, containers) are **low-margin, high-volume, and extremely bulky**. Inter-warehouse freight is priced by volume (freight class / dimensional weight). If you transfer 2 pallets of aluminum lids from West Coast to East Coast just to resolve 15 unfillable orders that were stuck due to the "No Partial Shipments" rule, the **freight and handling cost of the transfer will far exceed the profit margins of those orders**.
*   **Strategic Recommendation:** Rather than relying on constant, costly inter-facility transfers, utilize the TOS engine only for high-value items, or implement a **regional demand-driven safety stock threshold** directly in `ProductFacility.minimumStock` to prevent these imbalances from happening in the first place.

### 3. The Unfillable Queue Churn Trap
*   **The Fallacy:** Orders that cannot be fulfilled from a single warehouse are pushed to the `UNFILLABLE_QUEUE` until a weekly TOS is executed.
*   **The Trap:** In modern e-commerce, a customer order sitting unfulfilled in a backlog for up to a week waiting for an inter-warehouse truck to arrive will result in **massive customer churn and cancelled orders**. 
*   **Strategic Recommendation:** Implement an SLA-based bypass. If an order sits in the `UNFILLABLE_QUEUE` for more than **48 hours**, override the "No Partial Shipments" rule, split the order into two ship groups, ship them from both warehouses, and absorb the split shipping cost as a customer retention measure.

### 4. The Proximity vs. SLA Carrier Blindspot
*   **The Fallacy:** Proximity-based routing (`ST_Distance_Sphere`) is a direct proxy for shipping speed and cost.
*   **The Trap:** Geographical distance does not equal shipping transit time or carrier zone costs. A warehouse that is geographically closer to a customer might not have a direct carrier route, resulting in 3 days transit, whereas a warehouse slightly further away sits next to an FedEx/UPS regional hub and can deliver in 1 day at a lower zone rate.
*   **Strategic Recommendation:** Transition from static coordinate distance sorting to **dynamic carrier API zone pricing and SLA transit-time lookup** in your routing rule configurations.

### 5. Dual Database Synchronization Lag
*   **The Fallacy:** The system can seamlessly manage real-time inventory queries across Apache OFBiz and Moqui.
*   **The Trap:** HotWax OMS utilizes a split architecture where core inventory transactions (shipments, receipts, adjustments) update the OFBiz database, but the Moqui Order Routing engine runs asynchronously on cached or synchronized views. If high-velocity online sales are running, a lag in inventory synchronization between OFBiz and Moqui can lead to **double-brokering** (allocating the same physical stock to different orders at both warehouses), leading to rejection loops and inventory variance write-offs.
*   **Strategic Recommendation:** Enforce strict real-time transactional inventory checks (`entity-find` without cache) for high-velocity SKUs inside the `InventorySourceSelector` routing run.

---

<div style={{ backgroundColor: '#0d0d0d', padding: '15px', borderTop: '3px solid #d4af37', textAlign: 'center', borderRadius: '0 0 10px 10px' }}>
  <p style={{ color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
    Design, Diagrams, and Critiques provided by Antigravity Core AI. Under review for Premium Operations.
  </p>
</div>
