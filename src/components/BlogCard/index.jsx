import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';
import clsx from 'clsx';

export function BlogCard({ 
  title, 
  description, 
  tags = [], 
  date, 
  readTime, 
  link, 
  isFeatured 
}) {
  return (
    <article className={clsx(styles.blogCard, isFeatured && styles.featuredCard)}>
      {isFeatured && (
        <div className={styles.featuredBadge}>
          Featured Post
        </div>
      )}
      <div className={styles.cardContent}>
        {tags && tags.length > 0 && (
          <div className={styles.tagsContainer}>
            {tags.map((tag, idx) => (
              <span key={idx} className={styles.tagBadge}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 className={styles.title}>
          <Link to={link} className={styles.titleLink}>
            {title}
          </Link>
        </h2>
        <p className={styles.description}>
          {description}
        </p>
        <div className={styles.metaContainer}>
          <span>{date}</span>
          <span>{readTime}</span>
        </div>
      </div>
    </article>
  );
}
