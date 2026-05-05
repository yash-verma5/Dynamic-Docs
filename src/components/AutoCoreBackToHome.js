import React from 'react';
import Link from '@docusaurus/Link';
import { ArrowLeft } from 'lucide-react';

export default function AutoCoreBackToHome() {
  return (
    <Link
      to="/"
      className="button margin-bottom--lg"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        borderRadius: '12px',
        textDecoration: 'none',
        fontWeight: '800',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '2px solid #FFD700',
        color: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.05)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontSize: '0.8rem',
        boxShadow: '0 0 15px rgba(255, 215, 0, 0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#FFD700';
        e.currentTarget.style.color = '#000';
        e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.4)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.05)';
        e.currentTarget.style.color = '#FFD700';
        e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.1)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <ArrowLeft size={18} strokeWidth={3} />
      Back to Home
    </Link>
  );
}
