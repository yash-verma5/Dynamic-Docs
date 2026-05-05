import React from 'react';
import Link from '@docusaurus/Link';
import { Home } from 'lucide-react';

export default function HomeBackButton() {
  return (
    <Link
      to="/"
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
        backgroundColor: '#000000',
        boxShadow: '0 4px 14px 0 rgba(255, 0, 0, 0.39)',
      }}
    >
      <Home size={18} color="#ff0000" />
      Back to Home
    </Link>
  );
}
