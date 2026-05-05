import React from 'react';
import Link from '@docusaurus/Link';
import { ArrowLeft } from 'lucide-react';

export default function AutoCoreBackButton() {
  return (
    <Link
      to="/autocore/"
      className="button button--secondary button--outline margin-bottom--lg"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: 'bold',
        transition: 'all 0.2s ease',
        borderWidth: '2px'
      }}
    >
      <ArrowLeft size={18} />
      Back to AutoCore Hub
    </Link>
  );
}
