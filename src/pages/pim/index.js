import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import AutoCoreBackToHome from '@site/src/components/AutoCoreBackToHome';

const docs = [
  {
    icon: '🏆',
    title: 'PIM Data Architecture & Graph Analysis',
    desc: 'A high-fidelity map of the PIM backend data models, orchestrations, and fitment pipelines.',
    to: '/pim/pim_data_model_analysis',
    label: 'Explore Architecture',
    variant: 'danger',
  },
  {
    icon: '🚀',
    title: 'PIM PIES XML Import Technical Trace',
    desc: 'Traces the technical implementation of the PIES XML import pipeline from file upload to database persistence.',
    to: '/pim/pim_pies_import_analysis',
    label: 'Analyze Pipeline',
    variant: 'warning',
  },
];

export default function PimIndex() {
  return (
    <Layout title="PIM Documentation" description="End-to-end technical guides for the PIM plugin">
      <main className="container margin-vert--lg">
        <div className="row">
          <div className="col col--10 col--offset-1">
            <AutoCoreBackToHome />
            <h1 className="hero__title" style={{ color: '#ff0000', textShadow: '0 0 10px rgba(255,0,0,0.3)' }}>PIM Technical Library</h1>
            <p className="hero__subtitle" style={{ color: '#ffd700' }}>
              Interactive guides for understanding the Product Information Management architecture.
            </p>
            <hr style={{ borderColor: '#ffd700', opacity: 0.3 }} />

            <section className="margin-vert--xl">
              <div className="row">
                {docs.map((doc) => (
                  <div key={doc.to} className="col col--6 margin-bottom--lg">
                    <div className="card shadow--md" style={{ height: '100%', border: '1px solid #ff0000', backgroundColor: '#111' }}>
                      <div className="card__header">
                        <h3 style={{ color: '#ffd700' }}>{doc.icon} {doc.title}</h3>
                      </div>
                      <div className="card__body" style={{ color: '#ddd' }}>
                        <p>{doc.desc}</p>
                      </div>
                      <div className="card__footer">
                        <Link
                          className={`button button--${doc.variant} button--block`}
                          to={doc.to}
                          style={{
                             backgroundColor: '#ff0000',
                             color: '#fff',
                             border: 'none',
                             fontWeight: 'bold',
                             boxShadow: '0 0 15px rgba(255,0,0,0.4)'
                          }}
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
