import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import AutoCoreBackToHome from '@site/src/components/AutoCoreBackToHome';

const docs = [
  {
    icon: '🚀',
    title: 'Data Lifecycle',
    desc: 'A complete trace of how ACES/PIES data flows from ERP import to B2C retrieval.',
    to: '/autocore/ACES_PIES_DATA_LIFECYCLE',
    label: 'Explore Lifecycle',
    variant: 'primary',
  },
  {
    icon: '📐',
    title: 'Import Triangle',
    desc: 'Deep dive into the relationship between DIS, DIWS, and PartyServices in the CSV pipeline.',
    to: '/autocore/IMPORT_TRIANGLE_ANALYSIS',
    label: 'View Analysis',
    variant: 'secondary',
  },
  {
    icon: '🔗',
    title: 'VCDB & PIES Integration',
    desc: 'Evidence-based analysis of how fitment (ACES) and product (PIES) data are joined via the Opticat SKU Bridge.',
    to: '/autocore/VCDB_PIES_INTEGRATION_ANALYSIS',
    label: 'Read Integration Guide',
    variant: 'info',
  },
  {
    icon: '⚡',
    title: 'ProductSolrServices — God Module',
    desc: '69 edges. 5 Solr cores. Zero fallback. Understand the single point of failure and its blast radius.',
    to: '/autocore/PRODUCT_SOLR_SERVICES_ANALYSIS',
    label: 'Analyze Solr Services',
    variant: 'danger',
  },
  {
    icon: '🌐',
    title: 'B2C API Surface Map',
    desc: '42 methods across 5 domains — a complete map of what Products and Party services expose to the storefront.',
    to: '/autocore/B2C_API_SURFACE',
    label: 'Explore API Surface',
    variant: 'success',
  },
  {
    icon: '🌉',
    title: 'Bridge Node Analysis',
    desc: 'Two hidden coupling points that silently connect separate communities — HawkSearch ↔ Solr and Auth ↔ DataImport.',
    to: '/autocore/BRIDGE_NODE_ANALYSIS',
    label: 'Analyze Bridge Nodes',
    variant: 'warning',
  },
  {
    icon: '📊',
    title: 'AECP Data Model Deep Dive',
    desc: 'Exhaustive technical mapping of the AECP data model, detailing PIES and ACES entity intersections.',
    to: '/autocore/aecp_data_model_analysis',
    label: 'Explore Data Model',
    variant: 'primary',
  },
  {
    icon: '📂',
    title: 'ImportDataFromCSV1 Deep Dive',
    desc: 'Exhaustive step-by-step breakdown of the CSV import engine — from parsing to multi-threaded execution.',
    to: '/autocore/ImportDataFromCSV1_Analysis',
    label: 'Analyze Import Logic',
    variant: 'info',
  },
  {
    icon: '⚙️',
    title: 'importMemberProduct — Core Workhorse',
    desc: 'Detailed analysis of the service that translates CSV rows into highly-normalized OFBiz entity graphs.',
    to: '/autocore/importMemberProduct_Analysis',
    label: 'View Entity Mapping',
    variant: 'success',
  },
];

export default function AutoCoreIndex() {
  return (
    <Layout title="AutoCore Documentation" description="End-to-end technical guides for the Automotive Aftermarket plugin">
      <main className="container margin-vert--lg">
        <div className="row">
          <div className="col col--10 col--offset-1">
            <AutoCoreBackToHome />
            <h1 className="hero__title">AutoCore Technical Library</h1>
            <p className="hero__subtitle">
              Interactive guides for understanding the Automotive Aftermarket data lifecycle and integration architecture.
            </p>
            <hr />

            <section className="margin-vert--xl">
              <div className="row">
                {docs.map((doc) => (
                  <div key={doc.to} className="col col--6 margin-bottom--lg">
                    <div className="card shadow--md" style={{ height: '100%', border: '1px solid var(--ifm-color-emphasis-200)' }}>
                      <div className="card__header">
                        <h3>{doc.icon} {doc.title}</h3>
                      </div>
                      <div className="card__body">
                        <p>{doc.desc}</p>
                      </div>
                      <div className="card__footer">
                        <Link
                          className={`button button--${doc.variant} button--block`}
                          to={doc.to}
                        >
                          {doc.label}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
}
