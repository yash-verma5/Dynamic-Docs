---
title: Detailed Implementation Analysis — ImportDataFromCSV1
hide_table_of_contents: false
view_mode: full
---

import ZoomableMermaid from '@site/src/components/ZoomableMermaid';
import AutoCoreBackButton from '@site/src/components/AutoCoreBackButton';

<AutoCoreBackButton />

export const architectureFlowChart = `
graph TD
    A[Trigger: importDataFromCSV1] --> B{Init & Config}
    B --> C[Phase 1: Fetch DataManagerConfig]
    C --> D{Enable Preprocessor?}
    D -- Yes --> E[Phase 2: memberProductCSVPreprocessor]
    E --> F[Generate Clean CSV & Error CSV]
    D -- No --> G[Phase 3: Read CSV File]
    F --> G
    G --> H[Parse Header & Map Columns]
    H --> I[Iterate Rows & Group by Manufacturer]
    I --> J[Phase 4: Multi-Threaded Execution]
    J --> K[ThreadPoolExecutor 20 Threads]
    K --> L[DataRowGroupProcessor: Thread 1]
    K --> M[DataRowGroupProcessor: Thread 2]
    K --> N[...]
    L --> O{Commit or Rollback Row}
    M --> O
    O --> P[Phase 5: Post-Processing]
    P --> Q[Generate Unmapped/Error Files]
    Q --> R[Scorecard: createDataManagerLogItems]
    R --> S([Complete: Return Results])
`;

# Detailed Implementation Analysis: `ImportDataFromCSV1`

This document provides an exhaustive, step-by-step breakdown of the `ImportDataFromCSV1.java` service. It outlines exactly what happens from the moment the service is triggered until the final log is written.

---

## High-Level Architecture Flow

<ZoomableMermaid chart={architectureFlowChart} title="Import Engine Architecture" />


## Phase 1: Initialization & Configuration (Constructor)
When `importDataFromCSV1` is called via the service dispatcher, it immediately instantiates the `ImportDataFromCSV1` class, passing the context parameters.

1.  **Extract Parameters**: It wraps the input context into an `InputParameters` object (extracting `configId`, `jobName`, `logId`, `userLogin`, etc.).
2.  **Fetch DataManagerConfig**: It queries the database for `DataManagerConfig` using the provided `configId` to determine custom settings (like the delimiter).
3.  **Configure CSV Format**:
    *   It determines the `fieldDelimiter` (e.g., `,`, `\t`, `|`).
    *   It identifies the `fieldEncapsulator` (usually `"`).
    *   It builds the Apache Commons `CSVFormat` object, setting it to ignore empty lines and surrounding spaces.

## Phase 2: Preprocessing (`processImport` - Part 1)
Before parsing the actual file, the system checks if a preprocessor is required.

1.  **Check Preprocessor Flag**: Queries `DataManagerConfig` for `enablePreprocessorEvent`.
2.  **Execute Preprocessor**: If enabled (`Y`), it calls the `memberProductCSVPreprocessor` service synchronously.
    *   *What it does:* The preprocessor reads the raw file, splits out obvious errors (like completely malformed rows) into a separate error file, and returns a new `uploadFileContentId` representing the "clean" CSV that is safe to process.
3.  **Resolve File Path**: Uses the `uploadFileContentId` to query the `Content` and `DataResource` entities to find the absolute file path on the server.
4.  **Open Stream**: Wraps the file in a `BOMInputStream` (to strip byte-order marks) and a `BufferedReader`.

## Phase 3: Parsing & Grouping (`createDataRows`)
This is the most memory-intensive phase. The system reads the *entire* file into memory before executing any business logic.

1.  **Determine Grouping Strategy**: It reads `import.csv.multithreading.groupByField` from `import.properties`. If missing, it defaults to `"mfg"` (Manufacturer).
2.  **Process Header (`processHeaderRecord`)**:
    *   Reads the first row.
    *   Calls `DataImportUtil.getCSVHeader` which maps the raw CSV headers to the expected service parameters of the target business logic wrapper (e.g., `importMemberProductWrapper`).
    *   Creates arrays to track exactly which column index corresponds to which service parameter (`relevantFieldsPosition`).
3.  **Iterate Rows (`createDataRow`)**:
    *   For every subsequent row, it trims whitespace.
    *   It creates a `DataRow` object.
    *   It injects generic parameters: `partdomain` (if `wdPartyId` was provided), `userLogin`, and `lastImportedDate`.
4.  **Group the Rows**:
    *   It checks the value of the `groupByField` (e.g., the Manufacturer ID) for the current row.
    *   It places the `DataRow` into a `DataRowGroup` inside the `dataRowGroups` `LinkedHashMap`.
    *   *Why?* To ensure that rows belonging to the same manufacturer are processed sequentially by a single thread, avoiding database locks on shared entities (like the manufacturer's `Party` record).

## Phase 4: Multi-Threaded Execution (`importDataRowsWithMultiThreading`)
The core parallel processing engine.

1.  **Initialize Thread Pool**:
    *   Reads `import.csv.multithreading.rampUpCount` (default: 20).
    *   Creates a `ThreadPoolExecutor` with a core and max pool size of 20, a 10-minute timeout, and a custom `ThreadFactory` naming threads `DataImport-{logId}-{increment}`.
    *   Wraps it in an `ExecutorCompletionService` to easily retrieve completed tasks.
2.  **Submit Tasks**:
    *   Iterates through each `DataRowGroup` in the `dataRowGroups` map.
    *   Creates a `DataRowGroupProcessor` (which implements `Callable`).
    *   Submits the task.
    *   *Ramp-up Delay:* It explicitly `Thread.sleep(100)` between the first 20 submissions to prevent "slamming" the database with 20 simultaneous connection requests instantly.
3.  **Execution (`DataRowGroupProcessor.processDataRowGroup`)**:
    *   The thread takes its `DataRowGroup` and iterates through the rows sequentially.
    *   For each row, it calls the underlying business service (e.g., `importMemberProduct`) via `dispatcher.runSync(...)`.
    *   If the service fails, it catches the error and marks the `DataRow` as an error, extracting flags like `mandatoryFieldMissing`.
    *   If successful, it extracts flags like `isNewProduct`, `isBrandMapExist`, etc.
4.  **Collect Results**:
    *   The main thread uses a `for` loop to call `completionService.take().get()`, blocking until each group completes.
    *   *Cancellation Check:* In every loop iteration, it queries the `DataManagerLog` table. If the status is `SERVICE_CANCELLED`, it immediately shuts down the thread pool (`shutdownNow`) and breaks the loop.
    *   It tallies the results (`processedRecords`, `succeedRecords`, `errorSize`, etc.).

## Phase 5: Post-Processing & Result Generation (`processImport` - Part 2)
After all threads finish or are cancelled, the system wraps up.

1.  **Empty File Check**: If `processedRecords == 0`, it triggers `sendMemberProductFailureNotification` via email and aborts.
2.  **Error File Generation (`generateErrorFile`)**:
    *   If any rows failed (`errorRecords.size() > 1`), it generates a new CSV named `Error_Records_CSV_{jobName}.csv`.
    *   It writes the failed rows, appending the specific error message to the last column.
    *   It creates a new OFBiz `Content` and `DataResource` record for this file.
    *   It updates the `DataManagerLog` with the `errorRecordContentId` so users can download it from the UI.
    *   It triggers an email notification.
3.  **Unmapped File Generation (`generateUnmappedRecordsFile`)**:
    *   Similar to the error file, if any rows were flagged as "unmapped", it generates `Unmapped_Records_{jobName}.csv` and attaches it to the log.
4.  **Scorecard Generation (`createDataManagerLogItems`)**:
    *   Calls the `createDataManagerLogItems` service to insert the final statistics (Total Items, Success, Error, New Parts, Missing Mandatory) into the database for UI display.
    *   Updates the `DataManagerLog` status to `FILE_SUCCESS`, `FILE_ERROR`, or `FILE_PART_SUCCESS`.
5.  **Cleanup**: Clears the Logging MDC context and returns the final success/error map to the user.

---

export const subServiceTraceChart = `
sequenceDiagram
    autonumber
    actor Admin
    participant DI1 as ImportDataFromCSV1
    participant Pre as memberProductCSVPreprocessor
    participant DBP as Database (DataManagerLog)
    participant FS as FileSystem (Content/DataResource)
    participant TP as ThreadPoolExecutor
    participant Worker as DataRowGroupProcessor
    participant Wrapper as Business Service Wrapper

    Admin->>DI1: Trigger Import
    DI1->>DBP: Fetch Config
    DI1->>Pre: (Sync) Run Preprocessor
    activate Pre
    Pre->>FS: Read Raw File
    Pre->>FS: Split to Clean & Error CSVs
    Pre->>FS: (Sync) createContentFromUploadedFile
    Pre->>DBP: (Sync) updateDataManagerLog
    Pre-->>DI1: Return Clean File Content ID
    deactivate Pre

    DI1->>DI1: Load File to Memory
    DI1->>DI1: Group by Manufacturer (mfg)
    
    DI1->>TP: Submit DataRowGroups to Pool (20 threads)
    activate TP
    
    par Parallel Execution
        TP->>Worker: Group 1 (Mfg A)
        activate Worker
        loop Each Row
            Worker->>Wrapper: (Sync) dispatcher.runSync()
            Wrapper->>DBP: Insert/Update Product
        end
        Worker-->>TP: Return Stats
        deactivate Worker
    and
        TP->>Worker: Group 2 (Mfg B)
        activate Worker
        Worker-->>TP: Return Stats
        deactivate Worker
    end
    deactivate TP
    
    DI1->>DI1: Tally Results (Success/Error counts)
    DI1->>FS: (Sync) Generate Error/Unmapped CSVs
    DI1->>DBP: (Sync) createDataManagerLogItems (Scorecard)
    DI1-->>Admin: Import Complete
`;

## Sub-Service Trace: Synchronous & Asynchronous Invocations

<ZoomableMermaid chart={subServiceTraceChart} title="Multi-Threaded Service Sequence" />

Throughout the execution of `ImportDataFromCSV1`, several sub-services are invoked to handle file processing, logging, and actual data persistence. Here is the detailed breakdown of these services:

### 1. `memberProductCSVPreprocessor` (Synchronous)
*   **Where it runs:** `Phase 2: Preprocessing` (Invoked by `processImport()`).
*   **Purpose:** Filters out severely malformed rows before the main multithreaded engine attempts to parse them.
*   **Detailed Flow:**
    *   Reads the raw uploaded CSV file.
    *   Iterates line by line. It performs a basic structure check (splitting by `\t"`) to identify unparseable or incorrectly delimited lines.
    *   Writes valid lines to a new "clean" CSV file.
    *   Writes invalid lines to a new "Error" CSV file.
    *   Invokes `createContentFromUploadedFile` (Sync) to register both the clean and error files in the system.
    *   Invokes `updateDataManagerLog` (Sync) to attach these new files to the active `DataManagerLog`.
    *   Returns the new `uploadFileContentId` representing the "clean" file to the main import process.

### 2. `createContentFromUploadedFile` (Synchronous)
*   **Where it runs:** Called by `memberProductCSVPreprocessor`, and later by `ImportDataFromCSV1` when generating the final Error/Unmapped files.
*   **Purpose:** Standardizes file tracking within the OFBiz framework.
*   **Detailed Flow:** Creates a `DataResource` record (representing the physical file path/binary) and a `Content` record (metadata like MIME type and file name). This allows the files to be downloaded from the AutoCore UI via a `contentId`.

### 3. `updateDataManagerLog` (Synchronous)
*   **Where it runs:** Called by `memberProductCSVPreprocessor`, and by `ImportDataFromCSV1` during post-processing.
*   **Purpose:** Updates the main `DataManagerLog` entry. For example, it updates the log with the new `uploadFileContentId` (the clean file) and `exportFileContentId` (the error CSV file) so that the user interface correctly links to the generated error reports.

### 4. Business Wrapper Service (e.g., `importMemberProductWrapper`) (Synchronous within Async Thread)
*   **Where it runs:** Inside the `DataRowGroupProcessor` (Phase 4).
*   **Purpose:** Performs the actual data mapping and database insertion for a single CSV row.
*   **Detailed Flow:**
    *   The `ImportDataFromCSV1` main thread spawns multiple asynchronous worker threads via `ThreadPoolExecutor`.
    *   Inside each worker thread (`DataRowGroupProcessor`), it iterates over its assigned rows and calls `dispatcher.runSync(this.modelService.getName(), ...)` synchronously.
    *   This ensures that while multiple rows are processed in parallel (across different threads), each individual row waits for its specific database transaction to commit or rollback before moving to the next row in that specific thread's group.

### 5. `sendMemberProductFailureNotification` (Synchronous)
*   **Where it runs:** Post-processing (Phase 5) or upon immediate failure (e.g., empty file).
*   **Purpose:** Triggers an email notification to the administrator or user indicating that the import job failed completely, or generated significant error records.

### 6. `createDataManagerLogItems` (Synchronous)
*   **Where it runs:** At the very end of Phase 5.
*   **Purpose:** Scorecard generation.
*   **Detailed Flow:** Persists the granular import statistics (`totalRecordSize`, `succeedRecordSize`, `errorRecordSize`, `newPartProcessedCount`, etc.) to the `DataManagerLogItem` entity, which powers the dashboard analytics for the import job.
