import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import DynamicPageLinks from '@site/src/components/DynamicPageLinks';

import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--dark', styles.heroBanner)} style={{ padding: '5rem 0', background: '#1b1b1d' }}>
      <div className="container">
        <Heading as="h1" className="hero__title" style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '-1px' }}>
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle" style={{ fontSize: '1.5rem', opacity: '0.8' }}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/Solr-Migration"
            style={{ borderRadius: '50px', padding: '0.75rem 2rem', fontWeight: 'bold' }}>
            Latest Project: Solr Cloud Migration 🚀
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main>
        <DynamicPageLinks />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
