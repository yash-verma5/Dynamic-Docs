---
title: Bridge Node Analysis — Hidden Architectural Coupling
description: Two bridge nodes that silently couple separate communities — HawkSearchDataFeedServices and AutoCoreLoginWorker.
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

# Bridge Node Analysis

> A **bridge node** in a knowledge graph is a class that, if removed, would sever the connection between two otherwise-isolated communities. They are dangerous because they accumulate hidden responsibilities that cross architectural boundaries.

---

## Bridge 1: HawkSearchDataFeedServices

**Package**: `com.hotwax.hawksearch`  
**File**: `HawkSearchDataFeedServices.java` (2,861 lines)  
**Communities bridged**: HawkSearch (export pipeline) ↔ AutoCore Solr (indexing infrastructure)

export const bridge1Chart = `
flowchart LR
    subgraph HawkSearch Community
        HS[HawkSearchDataFeedServices]
        FT[FreeMarker Templates]
        HS --> FT
    end

    subgraph AutoCore Solr Community
        IX[IndexingServices]
        PS[ProductSolrServices]
        IX --> PS
    end

    HS -->|"hawkFeedUsingSolr()\\nimport IndexingServices"| IX

    subgraph Solr Cores
        GP[globalproducts]
        MP[memberproduct]
    end

    IX -->|getSolrHost| GP
    IX -->|getSolrHost| MP

    style HS fill:#7C3AED,color:#fff
    style IX fill:#dc2626,color:#fff
`;

<ZoomableMermaid chart={bridge1Chart} title="Bridge 1: HawkSearch → AutoCore Solr via IndexingServices" />

### Why It's a Bridge — The Exact Code Path

The bridge is a **single static method call**:

```java
// hawkFeedUsingSolr()
try (HttpSolrClient server = new HttpSolrClient.Builder(
        IndexingServices.getSolrHost(delegator, "globalproducts")).build();
     HttpSolrClient memberServer = new HttpSolrClient.Builder(
        IndexingServices.getSolrHost(delegator, "memberproduct")).build()) {
```

`IndexingServices` lives in `com.hotwax.autocore.autocoresolr.index` — completely different package, completely different community. The **only external dependency** the HawkSearch module has on the AutoCore Solr community. Cut it and the two communities have zero edges between them.

### What `hawkFeedUsingSolr` Actually Does

It is the **"Solr-native" path for generating HawkSearch data feeds**:

1. Calls `IndexingServices.getSolrHost()` to resolve the `globalproducts` and `memberproduct` Solr URLs
2. Opens a direct `HttpSolrClient` connection to both cores
3. Runs filter queries against `globalproducts` (by brand, status, date delta, `salesDiscontinuationDate`)
4. Feeds raw Solr documents through FreeMarker templates to generate `items.txt` and `attributes.txt`
5. Queries `memberproduct` for distributor pricing and WD availability
6. Writes `distributor.txt` based on the join between the two Solr cores

It's essentially **Solr-as-database**: bypasses OFBiz entities entirely and reads pre-indexed documents directly.

### What Breaks If This Class Changes

| Change | Downstream Breakage |
|---|---|
| `IndexingServices.getSolrHost()` signature changes | `hawkFeedUsingSolr` immediately fails to compile |
| Solr core renamed from `globalproducts` or `memberproduct` | Silent failure: HawkSearch feed generates 0 products |
| `IndexingServices` package refactored | All `import` statements at top of file break |
| HawkSearch feed schedule changes | `DataFeedConfigGroup.lastFeedTimestamp` is read from DB to filter delta query — change entity and partial feeds break |
| `isHawkIndexed` / `hawkIndexedDate` fields removed from `Product` entity | `prepareItemsDataFeed` (RDBMS-path method) breaks completely |

> **Most dangerous scenario**: If `IndexingServices` is made package-private during a refactor, HawkSearch feed generation silently stops — no compile error, just a `NoSuchMethodError` at runtime.

### Is It Intentional Design or Accidental Coupling?

**Accidental coupling that became intentional over time.**

`hawkFeedUsingSolr` was added later as a "faster" alternative to `prepareItemsDataFeed` and the developer reached across packages to reuse `IndexingServices.getSolrHost()` rather than duplicating the property-lookup logic.

**The right design**: A `SolrConnectionFactory` or `SolrConfigService` in a shared utilities package that both HawkSearch and ProductSolrServices consume.

---

## Bridge 2: AutoCoreLoginWorker

**Package**: `com.hotwax.autocore.login`  
**File**: `AutoCoreLoginWorker.java` (143 lines)  
**Communities bridged**: Auth/Session (login, reports) ↔ Party/DataImport (the main AutoCore service graph)

export const bridge2Chart = `
sequenceDiagram
    participant REQ as HTTP Request
    participant CTL as controller.xml
    participant LW as AutoCoreLoginWorker
    participant DB as RDBMS (PartyRelationship)
    participant SESSION as HTTP Session
    participant DIS as DataImportServices

    REQ->>CTL: Any admin request
    CTL->>LW: fire "checkPartDomain" pre-event
    LW->>DB: EntityQuery: AutoCore employee check
    LW->>DB: EntityQuery: Member employee check
    LW->>DB: EntityQuery: DOMAIN_PARTY sub-domains
    LW->>SESSION: setAttribute("memberPartyId")
    LW->>SESSION: setAttribute("partDomainId")
    LW-->>CTL: "success"

    REQ->>DIS: trigger import job
    DIS->>SESSION: context.get("partdomain")
    Note over DIS,SESSION: If null → returnError("partDomainId empty")
    DIS-->>REQ: import result
`;

<ZoomableMermaid chart={bridge2Chart} title="Bridge 2: AutoCoreLoginWorker — Session as Implicit Contract" />

### Why It's a Bridge — The Exact Code Path

`AutoCoreLoginWorker` is registered as a **servlet pre-event** in `controller.xml`, firing on **every HTTP request**. The method `checkPartDomain` performs live Party entity queries:

```java
// checks if user is an AutoCore employee
EntityQuery.use(delegator).from("PartyRelationship")
    .where("partyIdFrom", "AutoCore", "partyIdTo", loginPartyId, 
           "roleTypeIdFrom", "ASSOCIATION", "roleTypeIdTo", "EMPLOYEE")
    .filterByDate().queryFirst();
```

The values it writes to the session — `memberPartyId` and `partDomainId` — are consumed by `DataImportServices` on **20+ call sites**.

### Why Session-As-Bus Is More Dangerous Than Direct Import

With `HawkSearchDataFeedServices`, the coupling is visible as a compile-time import — grep finds it. With `AutoCoreLoginWorker`, the coupling is:

1. **Invisible to static analysis** — no `import` statement, no type reference
2. **Convention-based** — renaming the string key `"partdomain"` in either class fails silently at compile time
3. **Pre-emptive** — a bug here blocks the entire admin console, not just one service

### What Breaks If This Class Changes

| Change | Downstream Breakage |
|---|---|
| `checkPartDomain` returns `"error"` instead of `"success"` | **Every admin UI request blocked.** OFBiz routes to error page |
| Session key renamed from `"partDomainId"` to `"domainPartyId"` | All import services silently fail — every `store*` call in `DataImportServices` returns error |
| Party hierarchy restructured (MEMBER → DOMAIN_PARTY relationship removed) | `checkPartDomain` never resolves the partDomainId, users loop on `SelectPartDomain` redirect forever |
| `AutoCoreLoginWorker` removed from `controller.xml` | All import UI flows have null `partDomainId` — all product create/delete operations fail |
| New role type added between EMPLOYEE and DOMAIN_PARTY | Users with new role are routed to `SelectPartDomain` indefinitely (no matching branch in the 3-case if-else) |

### Is It Intentional Design or Accidental Coupling?

**Intentional design, but naively implemented.**

The intent is correct: enforce multi-tenancy by scoping every admin session to a specific `partDomain` (the franchise territory). The problem is that the bridge is **implicit** — the contract between `checkPartDomain` (writer) and `DataImportServices` (reader) is just a string key in a `HashMap`. Not enforced by any interface, not documented in any service definition file.

**The right design**: `partDomainId` should be passed as an explicit service parameter defined in the service XML definition, with its source handled by a proper security service, not a pre-event filter that writes to untyped session state.

---

## Summary Comparison

| Property | HawkSearchDataFeedServices | AutoCoreLoginWorker |
|---|---|---|
| **Bridge mechanism** | Compile-time import (`IndexingServices`) | Runtime convention (HTTP session key) |
| **Visibility** | High — grep for the import | Low — invisible to static analysis |
| **Failure mode** | Hard compile error → caught early | Silent null at runtime → caught in production |
| **Design intent** | Accidental (developer shortcut) | Intentional (multi-tenancy enforcement) |
| **Risk of change** | Medium — isolated to HawkSearch feeds | **High** — affects every admin import operation |
| **Fix** | Extract `SolrConnectionFactory` to shared util | Define `partDomainId` as explicit service param in XML |
| **Communities bridged** | HawkSearch ↔ Solr | Auth ↔ DataImport |

export const riskChart = `
quadrantChart
    title Bridge Risk Matrix
    x-axis "Low Visibility" --> "High Visibility"
    y-axis "Low Risk of Change" --> "High Risk of Change"
    quadrant-1 "Refactor Soon"
    quadrant-2 "Monitor"
    quadrant-3 "Low Priority"
    quadrant-4 "Refactor Now"
    HawkSearchDataFeedServices: [0.75, 0.45]
    AutoCoreLoginWorker: [0.15, 0.85]
`;

<ZoomableMermaid chart={riskChart} title="Bridge Risk Matrix: Visibility vs Risk of Change" />
