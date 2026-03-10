import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export function ExploreSection() {
  const docs = [
    {
      title: 'ARCHITECTURE',
      description: 'Comprehensive guide and technical reference for enterprise-level system architecture design.',
      link: '/docs/architecture'
    },
    {
      title: 'Solr Migration',
      description: 'Detailed technical reference for migrating search infrastructure to cloud-native Solr environments.',
      link: '/docs/solr-migration'
    },
    {
      title: 'Adoc Webhooks',
      description: 'Implementation guide for automated documentation workflows using AsciiDoc and webhooks.',
      link: '/docs/adoc-webhooks'
    }
  ];

  return (
    <section className={styles.exploreSection} id="documentation">
      <div className={styles.radialGlowLayer}></div>
      <div className={styles.exploreContainer}>
        <h2 className={styles.exploreTitle}>Explore Documentation</h2>
        <div className={styles.gridContainer}>
          {docs.map((doc, idx) => (
            <div key={idx} className={styles.glassCard}>
              <div>
                <h3 className={styles.cardTitle}>{doc.title}</h3>
                <p className={styles.cardDescription}>{doc.description}</p>
              </div>
              <Link to={doc.link} className={styles.cardButton}>
                Read Document
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
