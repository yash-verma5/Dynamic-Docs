import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';

const EVENTS = {
  ORDER_APPROVED: {
    label: 'Order Approved',
    description: 'Full snapshot of the order sent when status changes to APPROVED.',
    template: (id, time) => ({
      event_id: `evt_${time}`,
      event_type: "ORDER_APPROVED",
      order_id: id,
      timestamp: new Date().toISOString(),
      payload: {
        order_name: "10001",
        grand_total: 150.00,
        currency: "USD",
        items: [
          { sku: "10001", quantity: 1, unit_price: 50.00 },
          { sku: "10002", quantity: 2, unit_price: 50.00 }
        ]
      }
    })
  },
  ITEM_BROKERED: {
    label: 'Item Brokered',
    description: 'Delta update sent when an item is assigned to a facility.',
    template: (id, time) => ({
      event_id: `evt_${time}`,
      event_type: "ITEM_BROKERED",
      order_id: id,
      timestamp: new Date().toISOString(),
      payload: {
        item_seq_id: "00101",
        facility_id: "FAC_NY_01",
        status: "BROKERED"
      }
    })
  },
  ITEM_SHIPPED: {
    label: 'Item Shipped',
    description: 'Delta update sent when a shipment is packed and shipped.',
    template: (id, time) => ({
      event_id: `evt_${time}`,
      event_type: "ITEM_SHIPPED",
      order_id: id,
      timestamp: new Date().toISOString(),
      payload: {
        shipment_id: "SHP_999",
        tracking_code: "1Z9999999999999999",
        carrier: "UPS",
        items: [
          { sku: "10001", quantity: 1 }
        ]
      }
    })
  },
  ORDER_COMPLETED: {
    label: 'Order Completed',
    description: 'Full snapshot sent when the order is completed.',
    template: (id, time) => ({
      event_id: `evt_${time}`,
      event_type: "ORDER_COMPLETED",
      order_id: id,
      timestamp: new Date().toISOString(),
      payload: {
        order_name: "10001",
        status: "COMPLETED",
        final_adjustment: 0.00,
        items: [
          { sku: "10001", quantity: 1, status: "COMPLETED" },
          { sku: "10002", quantity: 2, status: "COMPLETED" }
        ]
      }
    })
  }
};

export default function WebhookSimulator() {
  const [selectedEvent, setSelectedEvent] = useState('ORDER_APPROVED');
  const [orderId, setOrderId] = useState('ORD-2024-001');

  const currentEvent = EVENTS[selectedEvent];
  const jsonPayload = JSON.stringify(currentEvent.template(orderId, Date.now()), null, 2);

  return (
    <div style={{ border: '1px solid var(--ifm-color-emphasis-200)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
      <h3>Webhook Simulator</h3>
      <p>Select an event type to see the generated JSON structure.</p>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Event Type:</label>
          <select 
            value={selectedEvent} 
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--ifm-color-gray-300)' }}
          >
            {Object.keys(EVENTS).map(key => (
              <option key={key} value={key}>{EVENTS[key].label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Order ID:</label>
          <input 
            type="text" 
            value={orderId} 
            onChange={(e) => setOrderId(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--ifm-color-gray-300)' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--ifm-background-color)', borderRadius: '4px', borderLeft: '4px solid var(--ifm-color-primary)' }}>
        <strong>Description:</strong> {currentEvent.description}
      </div>

      <CodeBlock language="json" title="Generated Payload">
        {jsonPayload}
      </CodeBlock>
    </div>
  );
}
