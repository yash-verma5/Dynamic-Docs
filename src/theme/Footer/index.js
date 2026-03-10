import React from 'react';
import Footer from '@theme-original/Footer';
import styles from './styles.module.css';

export default function FooterWrapper(props) {
  return (
    <div className={styles.customFooterWrapper}>
      <Footer {...props} />
    </div>
  );
}
