import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';

const CARRIERS = {
  FORZA: {
    label: 'FORZA (Guatemala)',
    auth: 'HMAC-SHA256 signature (LauValue header) + Base64 payload encoding',
    description: 'Requires State/Province code extraction and custom Municipality/Township resolution. Returns an order number that must be digits only.',
    template: () => ({
      Method: "/Paquetes/Crear",
      Params: {
        DateOfSale: new Date().toISOString().split('T')[0],
        ContentDescription: "Apparel Order",
        from_address: {
          name: "Warehouse GT",
          phone: "0000-0000",
          email: "warehouse@adoc.com",
          address1: "Zona 1, Ciudad",
          headerCodeTownship: "10101",
          city: "Guatemala"
        },
        to_address: {
          name: "Juan Perez",
          phone: "1111-2222",
          email: "juan@example.com",
          address1: "Calle Principal",
          headerCodeTownship: "10101",
          city: "Guatemala"
        },
        Parcels: [
          { Weight: 2.5, Length: 10, Width: 10, Height: 5 }
        ],
        Order_Number: "2024001",
        IdCountry: "GT",
        CountPieces: 1,
        CodeOfReference: "357506",
        TotalWeight: 2.5,
        TotalValue: 150.0,
        Currency: "USD"
      }
    })
  },
  C807: {
    label: 'C807 (Honduras, El Salvador)',
    auth: 'OAuth2 Bearer token (cached per partyRelationshipId)',
    description: 'Focuses on departments and municipalities IDs. Implements specific COD (Cash On Delivery) logic where STS orders always get "SER".',
    template: () => ({
      recolecta_fecha: `${new Date().toISOString().split('T')[0]} 19:00`,
      tipo_entrega: "STANDARD",
      provisional: false,
      sede: "FAC_HN_01",
      guias: [{
        orden: `ORD-${Date.now()}`,
        nombre: "Maria Garcia",
        direccion: "Barrio El Centro, Casa 12",
        telefono: "9999-8888",
        correo: "maria@example.com",
        departamento_id: 5,
        municipio_id: 23,
        tipo_servicio: "SER",
        detalle: [{ peso: 2.5, contenido: "Zapatos", unidad_medida: "LB" }]
      }]
    })
  },
  TERMINAL_EXPRESS: {
    label: 'Terminal Express (Costa Rica)',
    auth: 'HTTP Basic Auth (username:password per request)',
    description: 'Requires specific location hierarchy (Province, Canton, District) and Carrier Warehouse ID.',
    template: () => ({
      PROVINCIA: "San José",
      CANTON: "San José",
      DISTRITO: "Carmen",
      PESO: 2.5,
      CLIENTE_ID: "1506",
      BODEGA_ID: "WH_CR_MAIN",
      NOM_CLIENTE_FINAL: "Carlos Ruiz",
      TEL_CLIENTE_FINAL: "8888-7777",
      DIR_CLIENTE_FINAL: "Avenida Central, San Jose",
      LOGISTICA_INVERSA: "N"
    })
  }
};

export default function CarrierSimulator() {
  const [selectedCarrier, setSelectedCarrier] = useState('FORZA');

  const currentCarrier = CARRIERS[selectedCarrier];
  const jsonPayload = JSON.stringify(currentCarrier.template(), null, 2);

  return (
    <div style={{ border: '1px solid var(--ifm-color-emphasis-200)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
      <h3>Label Payload Simulator</h3>
      <p>Select a carrier to view their required payload structure and authentication method.</p>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Carrier Network:</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.keys(CARRIERS).map(key => (
             <button
              key={key}
              onClick={() => setSelectedCarrier(key)}
              className={`button ${selectedCarrier === key ? 'button--primary' : 'button--secondary'}`}
              style={{ padding: '8px 16px' }}
            >
              {CARRIERS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
         <div style={{ padding: '12px', background: 'var(--ifm-color-danger-contrast-background)', borderRadius: '4px', borderLeft: '4px solid var(--ifm-color-danger)' }}>
          <strong>Authentication:</strong> {currentCarrier.auth}
        </div>
        <div style={{ padding: '12px', background: 'var(--ifm-background-color)', borderRadius: '4px', borderLeft: '4px solid var(--ifm-color-primary)' }}>
          <strong>Key Differences:</strong> {currentCarrier.description}
        </div>
      </div>

      <CodeBlock language="json" title={`${currentCarrier.label} Label Request Payload`}>
        {jsonPayload}
      </CodeBlock>
    </div>
  );
}
