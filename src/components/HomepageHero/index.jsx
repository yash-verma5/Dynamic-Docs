import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export function HomepageHero() {
  return (
    <main className={styles.heroSection}>
      <div className={styles.dotGridLayer}></div>
      <section className={styles.heroContent}>
        <div className={styles.badge}>
          <span className={styles.badgePulse}></span>
          <span className={styles.badgeText}>Software Engineer @ Hotwax Systems</span>
        </div>
        <h1 className={styles.heroTitle}>
          Engineering Scalable <br className={styles.hideOnMobile} />
          <span>Enterprise Solutions</span>
        </h1>
        <p className={styles.heroDescription}>
          Specializing in technical documentation, high-performance architectures, and innovative engineering solutions. Sharing my journey through code and deep-dives.
        </p>
        <div className={styles.ctaGroup}>
          <Link to="/blog" className={styles.primaryButton}>
            Read the Blogs
            <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
            </svg>
          </Link>
          <Link to="#documentation" className={styles.secondaryButton}>
            Explore Projects
          </Link>
        </div>
      </section>
    </main>
  );
}
