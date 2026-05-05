import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';
import Admonition from '@theme/Admonition';
import styles from './AutoCoreTraceSimulator.module.css';

const STAGES = [
  {
    id: 'import',
    label: '1. Import',
    icon: '📥',
    title: 'Data Ingestion Phase',
    description: 'Legacy ERP/ADW data is ingested via CSV and mapped to OFBiz entities.',
    details: {
      orchestrator: 'DataImportWrapperServices.importGlobalProducts()',
      services: [
        'storeBrand (ProductCategory)',
        'storeProduct (Product)',
        'storeProductFeature (ProductFeature)',
        'storeGoodIdentification (GoodIdentification)'
      ],
      entities: ['Product', 'ProductCategory', 'ProductFeatureAndAppl', 'GoodIdentification'],
      logic: 'Synchronous chain of dispatcher.runSync calls per row.'
    },
    code: `{
  "service": "DataImportServices.importGlobalProducts",
  "action": "Entity Engine Writer",
  "impact": "Creates core PIES item records in OFBiz DB",
  "bridge": "wdPartyId provides the context scoping for brands/categories"
}`
  },
  {
    id: 'index',
    label: '2. Index',
    icon: '🔍',
    title: 'Search Indexing Phase',
    description: 'Entity data is transformed into Solr documents for high-performance searching.',
    details: {
      orchestrator: 'ProductSolrServices.createGlobalProductIndex()',
      services: [
        'IndexingServices.addIndexes()',
        'IndexingServices.addInterchangeIndexes()'
      ],
      cores: ['globalproducts', 'parts', 'interchange'],
      logic: 'Batch push of SolrInputDocuments via HttpSolrClient.'
    },
    code: `{
  "targetCore": "globalproducts",
  "documentBuilder": "ProductSolrServices.java",
  "fields": ["productId", "partNumber", "brandId", "prices", "features"],
  "commit": "commitWithin=10000 (Asynchronous Commit)"
}`
  },
  {
    id: 'retrieve',
    label: '3. Retrieve',
    icon: '🚀',
    title: 'B2C Retrieval Phase',
    description: 'Storefront APIs fetch product details and real-time availability.',
    details: {
      orchestrator: 'AutoCoreB2CProductServices.getProductDetails()',
      services: [
        'checkPartAvailability (AES Internal)',
        'getSITMInventoryAvailability'
      ],
      entities: ['Product', 'ProductPrice', 'ProductContentAndInfo'],
      logic: 'Direct EntityQuery for detail, HTTP call to AES for real-time inventory.'
    },
    code: `{
  "api": "/api/v1/productDetails",
  "source": "OFBiz Entity Engine (Direct Query)",
  "availability": "External AES Call",
  "waterfall": "ZAP -> LST -> JOBBER -> QOT -> USR -> WD1"
}`
  },
  {
    id: 'fitment',
    label: '4. Fitment',
    icon: '🚗',
    title: 'ACES Fitment Lookup',
    description: 'Vehicle identification and fitment validation via external standards.',
    details: {
      orchestrator: 'AutoCoreB2CVehicleServices.getOpticatSearchResults()',
      services: [
        'OpticatSearchServices.sendOpticatSearchRequest()',
        'getEngineConfigurations'
      ],
      external: 'Opticat API (webservice.opticatonline.com)',
      logic: 'ACES VCDb reference data lookup + external API fitment check.'
    },
    code: `{
  "standard": "ACES / VCDb",
  "engine_string": "V6 3.5L 3458cc Gas DI Naturally Aspirated",
  "fitment_bridge": "SKU = stdPartNumber-brandCode-subBrandCode",
  "provider": "Opticat Cloud"
}`
  }
];

export default function AutoCoreTraceSimulator() {
  const [activeStage, setActiveStage] = useState(STAGES[0]);

  return (
    <div className={styles.simulatorContainer}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {activeStage.icon} AutoCore Data Lifecycle Trace
      </h3>
      
      {/* Stepper / Tabs */}
      <div className={styles.stepperContainer}>
        <div className={styles.stepperLine} />
        
        {STAGES.map((stage, idx) => (
          <button
            key={stage.id}
            onClick={() => setActiveStage(stage)}
            className={`${styles.stepButton} ${activeStage.id === stage.id ? styles.stepButtonActive : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>{stage.icon}</span>
            <span style={{ fontSize: '0.7rem', marginTop: '4px' }}>{stage.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.contentGrid}>
        {/* Left Column: Description */}
        <div>
          <h4>{activeStage.title}</h4>
          <p style={{ color: 'var(--ifm-color-content-secondary)' }}>{activeStage.description}</p>
          
          <div className={styles.underTheHood}>
            <h5>Under the Hood</h5>
            <ul>
              <li><strong>Orchestrator:</strong> <code>{activeStage.details.orchestrator}</code></li>
              {activeStage.details.services && (
                <li><strong>Key Services:</strong> {activeStage.details.services.join(', ')}</li>
              )}
              {activeStage.details.entities && (
                <li><strong>Entities:</strong> {activeStage.details.entities.map(e => <code key={e}>{e}</code>).reduce((prev, curr) => [prev, ', ', curr])}</li>
              )}
              {activeStage.details.cores && (
                <li><strong>Solr Cores:</strong> {activeStage.details.cores.join(', ')}</li>
              )}
               {activeStage.details.external && (
                <li><strong>External:</strong> {activeStage.details.external}</li>
              )}
              <li><strong>Logic:</strong> {activeStage.details.logic}</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Code/Payload Preview */}
        <div>
          <CodeBlock language="json" title="Trace Context">
            {activeStage.code}
          </CodeBlock>
        </div>
      </div>

      <div className={styles.admonitionContainer}>
        <Admonition type="tip" title="Trace Insight">
          {activeStage.id === 'import' && "Did you know? All imports are synchronous to ensure data integrity, but this is why they are the slowest part of the pipeline."}
          {activeStage.id === 'index' && "The indexing layer uses a 'Document Builder' pattern to flatten complex entity relations into a single searchable document."}
          {activeStage.id === 'retrieve' && "Availability is checked live against the AES system during the B2C flow to prevent overselling."}
          {activeStage.id === 'fitment' && "Fitment logic is decoupled: Vehicle DNA comes from local VCDb tables, but compatibility check hits Opticat APIs."}
        </Admonition>
      </div>
    </div>
  );
}
