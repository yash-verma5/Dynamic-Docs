import React from 'react';
import Link from '@docusaurus/Link';
import { ArrowLeft } from 'lucide-react';

export default function PimBackButton() {
  return (
    <Link
      to="/pim/"
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
        borderWidth: '2px',
        borderColor: '#ff0000',
        color: '#ffd700',
        backgroundColor: '#000000'
      }}
    >
      <ArrowLeft size={18} color="#ff0000" />
      Back to PIM Hub
    </Link>
  );
}
