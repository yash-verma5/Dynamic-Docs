import React from 'react';
import Layout from '@theme/Layout';
import { HomepageHero } from '../components/HomepageHero';
import { ExploreSection } from '../components/ExploreSection';

export default function Home() {
  return (
    <Layout
      title="Home"
      description="Engineering Scalable Enterprise Solutions">
      <HomepageHero />
      <ExploreSection />
    </Layout>
  );
}
