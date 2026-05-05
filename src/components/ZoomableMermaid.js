import React from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Mermaid from '@theme/Mermaid';

export default function ZoomableMermaid({ chart, title }) {
  return (
    <div style={{ 
      border: '1px solid var(--ifm-color-emphasis-200)', 
      borderRadius: '12px', 
      overflow: 'hidden', 
      backgroundColor: 'var(--ifm-background-surface-color)',
      marginBottom: '2rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      resize: 'vertical',
      minHeight: '400px',
      height: '600px',
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {title && (
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid var(--ifm-color-emphasis-200)',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--ifm-background-color)',
          flexShrink: 0
        }}>
          <span>{title}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--ifm-color-content-secondary)', fontStyle: 'italic' }}>
            Use mouse wheel to zoom, drag to pan • Pull bottom edge to resize
          </span>
        </div>
      )}
      <TransformWrapper
        initialScale={1}
        initialPositionX={0}
        initialPositionY={0}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
                <div style={{ 
                position: 'absolute', 
                left: '20px', 
                top: '20px', 
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--site-glass-bg)',
                backdropFilter: 'blur(8px)',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--site-glass-border)'
              }}>
                <button onClick={() => zoomIn()} className="button button--secondary button--sm" title="Zoom In" style={{ padding: '6px 10px', fontSize: '1.2rem', lineHeight: 1 }}>+</button>
                <button onClick={() => zoomOut()} className="button button--secondary button--sm" title="Zoom Out" style={{ padding: '6px 10px', fontSize: '1.2rem', lineHeight: 1 }}>-</button>
                <button onClick={() => resetTransform()} className="button button--secondary button--sm" title="Reset View" style={{ padding: '6px 10px', fontSize: '1rem' }}>↺</button>
              </div>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%', cursor: 'move' }}>
                <div style={{ padding: '40px', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Mermaid value={chart} />
                </div>
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
