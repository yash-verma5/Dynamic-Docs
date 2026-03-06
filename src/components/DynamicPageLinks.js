import React from 'react';
import Link from '@docusaurus/Link';
import styles from './HomepageFeatures/styles.module.css';

// Webpack's require.context to dynamically get all .md files in the pages directory
const req = require.context('../pages', false, /\.md$/);

const getPages = () => {
  return req.keys().map((key) => {
    // key is like "./Solr-Migration.md"
    const fileName = key.replace('./', '').replace('.md', '');
    const path = `/${fileName}`;
    
    // Convert filename to a readable title (e.g., Solr-Migration -> Solr Migration)
    const title = fileName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return { title, path };
  });
};

export default function DynamicPageLinks() {
  const pages = getPages();

  return (
    <section className="padding-vert--xl" style={{ background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)' }}>
      <div className="container">
        <h2 className="text--center margin-bottom--xl" style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(90deg, #25c2a0 0%, #1c927b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Explore Documentation
        </h2>
        <div className="row">
          {pages.map((page, idx) => (
            <div key={idx} className="col col--4 margin-bottom--lg">
              <div className="card shadow--md" style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                border: '1px solid rgba(0,0,0,0.05)',
                borderRadius: '16px',
                overflow: 'hidden',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
              }}
              >
                <div className="card__header" style={{ padding: '2rem 1.5rem 1rem' }}>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: 0 }}>{page.title}</h3>
                </div>
                <div className="card__body" style={{ padding: '0 1.5rem 2rem' }}>
                  <p className="text--muted" style={{ fontSize: '0.9rem' }}>Comprehensive guide and technical reference for {page.title.toLowerCase()}.</p>
                  <Link className="button button--primary button--block margin-top--md" to={page.path} style={{ borderRadius: '8px' }}>
                    Read Document
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
