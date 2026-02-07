
import React, { useEffect } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

function DownloadButton() {
  const downloadPdf = async () => {
    // Dynamically import html2pdf in the browser
    const html2pdf = (await import('html2pdf.js')).default;
    
    const element = document.getElementById('printable-content');
    
    const opt = {
      margin: 10,
      filename: 'adoc-webhook-integration.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <button 
      onClick={downloadPdf}
      className="button button--primary"
      style={{
        float: 'right',
        marginLeft: '10px',
        marginBottom: '10px'
      }}
    >
      Download Report PDF
    </button>
  );
}

export default function DownloadPdfWrapper() {
  return (
    <BrowserOnly>
      {() => <DownloadButton />}
    </BrowserOnly>
  );
}
