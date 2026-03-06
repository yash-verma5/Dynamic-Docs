import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Solr Cloud Migration',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Successfully migrated large-scale Solr Standalone indices to SolrCloud, 
        enhancing resilience and search performance using cursor-based pagination.
      </>
    ),
  },
  {
    title: 'NiFi Data Orchestration',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Built robust data pipelines in Apache NiFi for real-time extraction, 
        transformation (JOLT), and schema-aware (Avro) document ingestion.
      </>
    ),
  },
  {
    title: 'Interactive Documentation',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Leveraging Docusaurus and MDX to create interactive, living technical 
        guides with embedded simulators and Mermaid diagrams.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
