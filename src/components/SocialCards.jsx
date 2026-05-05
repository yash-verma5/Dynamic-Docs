import React from 'react';
import styles from './SocialCards.module.css';
import { Users, Terminal, ExternalLink } from 'lucide-react';

export function LinkedInPost({ url, title, date, previewImage }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.socialCard}>
      <div className={styles.cardHeader}>
        <Users size={20} color="#0077b5" />
        <span className={styles.platform}>LinkedIn</span>
      </div>
      {previewImage && (
        <div className={styles.previewImageContainer}>
          <img src={previewImage} alt={title} className={styles.previewImage} />
        </div>
      )}
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDate}>{date}</p>
      </div>
      <div className={styles.cardFooter}>
        <span>View on LinkedIn</span>
        <ExternalLink size={14} />
      </div>
    </a>
  );
}

export function GitHubRepo({ name, description, url, language, stars }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.socialCard}>
      <div className={styles.cardHeader}>
        <Terminal size={20} color="#ffffff" />
        <span className={styles.platform}>GitHub</span>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{name}</h3>
        <p className={styles.cardDescription}>{description}</p>
        <div className={styles.repoMeta}>
          {language && <span className={styles.language}><span className={styles.dot} />{language}</span>}
          {stars && <span>⭐ {stars}</span>}
        </div>
      </div>
      <div className={styles.cardFooter}>
        <span>View Repository</span>
        <ExternalLink size={14} />
      </div>
    </a>
  );
}
