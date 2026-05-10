import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, MapPin, ShieldAlert, CheckCircle, HelpCircle, Truck, Database } from 'lucide-react';

const DEFAULT_INVENTORY = {
  east: {
    name: "East Coast Warehouse (NJ)",
    lat: 40.7128,
    lon: -74.0060,
    itemA: 10,
    itemB: 4, // OOS for 10 units ordered
    weekOfSupply: 5, // Highlight Yash's favorite number 5!
    turnoverRate: "8.2x",
  },
  west: {
    name: "West Coast Warehouse (CA)",
    lat: 34.0522,
    lon: -118.2437,
    itemA: 25,
    itemB: 30,
    weekOfSupply: 15,
    turnoverRate: "2.4x",
  }
};

const CUSTOMER_LOCATIONS = {
  NY: { name: "New York, NY", lat: 43.0000, lon: -75.0000, desc: "East Coast Density (Near NJ WH)" },
  CA: { name: "Los Angeles, CA", lat: 36.7783, lon: -119.4179, desc: "West Coast Density (Near CA WH)" },
  TX: { name: "Dallas, TX", lat: 31.9686, lon: -99.9018, desc: "Central Location (Slightly closer to CA)" },
};

export default function HotWaxRoutingSimulator() {
  const [customerLoc, setCustomerLoc] = useState('NY');
  const [qtyA, setQtyA] = useState(5); // Default to Yash's favorite number 5!
  const [qtyB, setQtyB] = useState(10);
  const [enforceSingleFacility, setEnforceSingleFacility] = useState(true);
  const [sortRule, setSortRule] = useState('proximity'); // proximity | weekOfSupplyDesc | lowerTurnover
  
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [routingResult, setRoutingResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  // Calculate distance using simple Spherical Law of Cosines (mock ST_Distance_Sphere)
  const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // miles
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const d = Math.acos(Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)) * R;
    return Math.round(d);
  };

  const runSimulation = () => {
    setIsRunning(true);
    setActiveStep(1);
    setLogs([]);
    setRoutingResult(null);

    const customer = CUSTOMER_LOCATIONS[customerLoc];
    const eastDist = calcDistance(customer.lat, customer.lon, DEFAULT_INVENTORY.east.lat, DEFAULT_INVENTORY.east.lon);
    const westDist = calcDistance(customer.lat, customer.lon, DEFAULT_INVENTORY.west.lat, DEFAULT_INVENTORY.west.lon);

    let stepLogs = [];
    
    // Step 1: Ingest
    stepLogs.push({
      step: 1,
      type: 'info',
      message: `[INGEST] Customer in ${customer.name} placed order containing Item A (Qty: ${qtyA}) and Item B (Qty: ${qtyB}).`
    });
    stepLogs.push({
      step: 1,
      type: 'success',
      message: `[INGEST] Order approved. facilityId updated to virtual queue 'HQ_QUEUE'.`
    });

    setTimeout(() => {
      // Step 2: Proximity Query
      setActiveStep(2);
      stepLogs.push({
        step: 2,
        type: 'query',
        message: `[PROXIMITY] Executing ST_Distance_Sphere calculation in query: \n` +
                 `  - East WH (NJ): ${eastDist} miles \n` +
                 `  - West WH (CA): ${westDist} miles`
      });
      setLogs([...stepLogs]);
    }, 800);

    setTimeout(() => {
      // Step 3: Single Facility Validation
      setActiveStep(3);
      
      const eastHasA = DEFAULT_INVENTORY.east.itemA >= qtyA;
      const eastHasB = DEFAULT_INVENTORY.east.itemB >= qtyB;
      const eastCanFulfill = eastHasA && eastHasB;

      const westHasA = DEFAULT_INVENTORY.west.itemA >= qtyA;
      const westHasB = DEFAULT_INVENTORY.west.itemB >= qtyB;
      const westCanFulfill = westHasA && westHasB;

      stepLogs.push({
        step: 3,
        type: 'info',
        message: `[CONSTRAINT] Enforcing 'ORA_SINGLE' (Single-Facility Fulfillment) constraint...`
      });

      if (eastCanFulfill) {
        stepLogs.push({
          step: 3,
          type: 'success',
          message: `[CONSTRAINT] East WH has 100% stock (Item A: ${DEFAULT_INVENTORY.east.itemA}/${qtyA}, Item B: ${DEFAULT_INVENTORY.east.itemB}/${qtyB}).`
        });
      } else {
        stepLogs.push({
          step: 3,
          type: 'warning',
          message: `[CONSTRAINT] East WH fails single-facility check. Missing items: ${!eastHasA ? 'Item A ' : ''}${!eastHasB ? 'Item B (Only has ' + DEFAULT_INVENTORY.east.itemB + '/' + qtyB + ')' : ''}`
        });
      }

      if (westCanFulfill) {
        stepLogs.push({
          step: 3,
          type: 'success',
          message: `[CONSTRAINT] West WH has 100% stock (Item A: ${DEFAULT_INVENTORY.west.itemA}/${qtyA}, Item B: ${DEFAULT_INVENTORY.west.itemB}/${qtyB}).`
        });
      } else {
        stepLogs.push({
          step: 3,
          type: 'warning',
          message: `[CONSTRAINT] West WH fails single-facility check. Missing items: ${!westHasA ? 'Item A' : ''}${!westHasB ? 'Item B' : ''}`
        });
      }
      setLogs([...stepLogs]);
    }, 1600);

    setTimeout(() => {
      // Step 4: Facility Selection
      setActiveStep(4);
      
      const eastHasA = DEFAULT_INVENTORY.east.itemA >= qtyA;
      const eastHasB = DEFAULT_INVENTORY.east.itemB >= qtyB;
      const eastEligible = !enforceSingleFacility || (eastHasA && eastHasB);

      const westHasA = DEFAULT_INVENTORY.west.itemA >= qtyA;
      const westHasB = DEFAULT_INVENTORY.west.itemB >= qtyB;
      const westEligible = !enforceSingleFacility || (westHasA && westHasB);

      let selectedWH = null;
      let reason = '';

      // Score options based on sort rule
      let candidates = [];
      if (eastEligible) {
        candidates.push({ id: 'east', dist: eastDist, wos: DEFAULT_INVENTORY.east.weekOfSupply, turnover: parseFloat(DEFAULT_INVENTORY.east.turnoverRate) });
      }
      if (westEligible) {
        candidates.push({ id: 'west', dist: westDist, wos: DEFAULT_INVENTORY.west.weekOfSupply, turnover: parseFloat(DEFAULT_INVENTORY.west.turnoverRate) });
      }

      if (candidates.length === 0) {
        selectedWH = 'OOS';
        reason = 'No single facility has 100% of the requested inventory. Routing run failed.';
      } else {
        // Apply Sort rule
        candidates.sort((a, b) => {
          if (sortRule === 'proximity') {
            return a.dist - b.dist;
          } else if (sortRule === 'weekOfSupplyDesc') {
            return b.wos - a.wos; // Standard HotWax: high week of supply prioritized
          } else {
            return a.wos - b.wos; // Yash's Rule 3: lower turnover / week of supply prioritized
          }
        });
        selectedWH = candidates[0].id;
        
        if (sortRule === 'proximity') {
          reason = `Selected closest warehouse with available stock: ${selectedWH === 'east' ? 'East WH' : 'West WH'} (${candidates[0].dist} mi).`;
        } else if (sortRule === 'weekOfSupplyDesc') {
          reason = `Selected warehouse with maximum inventory buffer (Week of Supply: ${candidates[0].wos} weeks).`;
        } else {
          reason = `Selected warehouse with lower inventory supply to clear rollover stock (Week of Supply: ${candidates[0].wos} weeks).`;
        }
      }

      if (selectedWH === 'OOS') {
        stepLogs.push({
          step: 4,
          type: 'error',
          message: `[ALLOCATE] ${reason}`
        });
        stepLogs.push({
          step: 4,
          type: 'info',
          message: `[TOS] Weekly Transfer Order Suggestion Engine suggests transferring items from West WH to East WH to resolve unfillable pipeline.`
        });
        setRoutingResult({
          facility: 'None (UNFILLABLE_QUEUE)',
          distance: 'N/A',
          isError: true,
          reason: 'OutOfStock - Added to Weekly TOS Suggestions'
        });
      } else {
        const whName = selectedWH === 'east' ? 'East Coast Warehouse' : 'West Coast Warehouse';
        const dist = selectedWH === 'east' ? eastDist : westDist;
        stepLogs.push({
          step: 4,
          type: 'success',
          message: `[ALLOCATE] ${reason}`
        });
        stepLogs.push({
          step: 4,
          type: 'info',
          message: `[RESERVE] Calling process#OrderFacilityAllocation. Updates OrderItemShipGroup.facilityId to ${selectedWH.toUpperCase()}_WH.`
        });
        stepLogs.push({
          step: 4,
          type: 'success',
          message: `[RESERVE] Physical stock reservations created successfully. Order state released to fulfillment.`
        });
        setRoutingResult({
          facility: whName,
          distance: `${dist} miles`,
          isError: false,
          reason: reason
        });
      }

      setLogs([...stepLogs]);
      setIsRunning(false);
    }, 2400);
  };

  const handleReset = () => {
    setActiveStep(0);
    setLogs([]);
    setRoutingResult(null);
    setIsRunning(false);
  };

  return (
    <div style={{
      background: '#0a0a0a',
      color: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '12px',
      border: '2px solid #d4af37', // Gold border!
      boxShadow: '0 8px 32px 0 rgba(255, 0, 0, 0.15)', // Subtle Red shadow
      overflow: 'hidden',
      margin: '24px 0'
    }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0000 0%, #000000 100%)',
        padding: '20px',
        borderBottom: '1px solid #d4af37',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <span style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: '900',
            letterSpacing: '1.5px',
            background: 'linear-gradient(90deg, #ff3b30, #d4af37)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'block',
            marginBottom: '4px'
          }}>
            Interactive Core Simulation
          </span>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.5rem', fontWeight: '800' }}>
            🛰️ HotWax Order Routing Engine Simulator
          </h2>
        </div>
        <div style={{
          background: 'rgba(212, 175, 55, 0.15)',
          border: '1px solid #d4af37',
          borderRadius: '20px',
          padding: '4px 12px',
          fontSize: '12px',
          color: '#d4af37',
          fontWeight: 'bold'
        }}>
          Moqui ↔ OFBiz Sandbox
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          
          {/* Controls Panel */}
          <div className="col col--5" style={{ flex: '1 1 350px' }}>
            <h4 style={{ color: '#ffd700', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px', marginBottom: '16px' }}>
              Step 1: Configure Order Payload
            </h4>

            {/* Customer Location selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#ff3b30', marginBottom: '6px' }}>
                Customer Ship-To State (Address Boundary)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Object.keys(CUSTOMER_LOCATIONS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setCustomerLoc(key)}
                    style={{
                      padding: '10px',
                      background: customerLoc === key ? '#1a0000' : '#121212',
                      border: customerLoc === key ? '2px solid #ff3b30' : '1px solid #333',
                      borderRadius: '6px',
                      color: customerLoc === key ? '#ff3b30' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}
                  >
                    <div>{key}</div>
                    <div style={{ fontSize: '9px', fontWeight: 'normal', marginTop: '2px' }}>
                      {CUSTOMER_LOCATIONS[key].name.split(',')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantities configuration */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#ffd700', marginBottom: '6px' }}>
                  Item A Qty (Retail)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#121212', borderRadius: '6px', border: '1px solid #333', overflow: 'hidden' }}>
                  <button onClick={() => setQtyA(Math.max(1, qtyA - 1))} style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>-</button>
                  <input
                    type="number"
                    value={qtyA}
                    onChange={(e) => setQtyA(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: qtyA === 5 ? '#ffd700' : '#fff', // Highlight 5 in gold!
                      fontWeight: qtyA === 5 ? '900' : 'normal',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}
                  />
                  <button onClick={() => setQtyA(qtyA + 1)} style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>+</button>
                </div>
                {qtyA === 5 && (
                  <span style={{ fontSize: '9px', color: '#d4af37', display: 'block', marginTop: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                    ★ Favorite Number (Gold Highlight)
                  </span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#888', marginBottom: '6px' }}>
                  Item B Qty (Bulk Aluminum)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#121212', borderRadius: '6px', border: '1px solid #333', overflow: 'hidden' }}>
                  <button onClick={() => setQtyB(Math.max(1, qtyB - 1))} style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>-</button>
                  <input
                    type="number"
                    value={qtyB}
                    onChange={(e) => setQtyB(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}
                  />
                  <button onClick={() => setQtyB(qtyB + 1)} style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>

            {/* Constraint Toggles */}
            <h4 style={{ color: '#ffd700', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>
              Step 2: Broker Rules & Constraints
            </h4>

            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121212', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>Enforce ORA_SINGLE</strong>
                <span style={{ fontSize: '10px', color: '#888' }}>Must ship in full from 1 facility</span>
              </div>
              <input
                type="checkbox"
                checked={enforceSingleFacility}
                onChange={(e) => setEnforceSingleFacility(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#ff3b30'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#ff3b30', marginBottom: '6px' }}>
                Inventory Sort / Allocation Priority
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: sortRule === 'proximity' ? 'rgba(255, 59, 48, 0.1)' : '#121212',
                  border: sortRule === 'proximity' ? '1px solid #ff3b30' : '1px solid #333',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                  <input type="radio" checked={sortRule === 'proximity'} onChange={() => setSortRule('proximity')} style={{ accentColor: '#ff3b30' }} />
                  <div>
                    <strong>Proximity (ST_Distance_Sphere ASC)</strong>
                    <div style={{ fontSize: '9px', color: '#888' }}>Nearest warehouse gets prioritized</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: sortRule === 'weekOfSupplyDesc' ? 'rgba(212, 175, 55, 0.1)' : '#121212',
                  border: sortRule === 'weekOfSupplyDesc' ? '1px solid #d4af37' : '1px solid #333',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                  <input type="radio" checked={sortRule === 'weekOfSupplyDesc'} onChange={() => setSortRule('weekOfSupplyDesc')} style={{ accentColor: '#d4af37' }} />
                  <div>
                    <strong>Default HotWax (Week of Supply DESC)</strong>
                    <div style={{ fontSize: '9px', color: '#888' }}>Prioritize facilities with highest supply remaining</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: sortRule === 'lowerTurnover' ? 'rgba(212, 175, 55, 0.15)' : '#121212',
                  border: sortRule === 'lowerTurnover' ? '1px solid #d4af37' : '1px solid #333',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                  <input type="radio" checked={sortRule === 'lowerTurnover'} onChange={() => setSortRule('lowerTurnover')} style={{ accentColor: '#d4af37' }} />
                  <div>
                    <strong>Yash's Rule 3 (Lower Inventory Supply ASC)</strong>
                    <div style={{ fontSize: '9px', color: '#ffd700', fontWeight: '600' }}>★ Clear out slow-moving stock first (Challenge Standard)</div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={runSimulation}
                disabled={isRunning}
                style={{
                  flex: 2,
                  background: 'linear-gradient(90deg, #ff3b30 0%, #d4af37 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '14px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(255, 59, 48, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.1s ease',
                }}
              >
                <Play size={16} /> {isRunning ? 'Running Run...' : 'Execute Routing Run'}
              </button>
              
              <button
                onClick={handleReset}
                style={{
                  flex: 1,
                  background: '#121212',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Map, Inventory levels & Interactive Outputs */}
          <div className="col col--7" style={{ flex: '1.2 1 400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Warehouse Inventory Status Grid */}
            <div style={{ background: '#121212', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
              <h4 style={{ color: '#ffffff', fontSize: '14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={16} color="#d4af37" /> Core Warehouse Topology & Stock Levels
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                
                {/* East WH */}
                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  borderLeft: '4px solid #ff3b30',
                  padding: '12px',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff3b30' }}>East Coast WH (NJ)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '8px', color: '#888' }}>
                    <span>Item A Stock:</span>
                    <strong style={{ color: '#fff' }}>{DEFAULT_INVENTORY.east.itemA} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                    <span>Item B Stock:</span>
                    <strong style={{ color: DEFAULT_INVENTORY.east.itemB < qtyB ? '#ff3b30' : '#fff' }}>
                      {DEFAULT_INVENTORY.east.itemB} units {DEFAULT_INVENTORY.east.itemB < qtyB ? '(SHORT)' : ''}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', borderTop: '1px solid #222', marginTop: '6px', paddingTop: '4px' }}>
                    <span>Weeks of Supply:</span>
                    <strong style={{ color: '#ffd700' }}>{DEFAULT_INVENTORY.east.weekOfSupply} weeks ★</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                    <span>Turnover Rate:</span>
                    <strong style={{ color: '#fff' }}>{DEFAULT_INVENTORY.east.turnoverRate}</strong>
                  </div>
                </div>

                {/* West WH */}
                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  borderLeft: '4px solid #d4af37',
                  padding: '12px',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4af37' }}>West Coast WH (CA)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '8px', color: '#888' }}>
                    <span>Item A Stock:</span>
                    <strong style={{ color: '#fff' }}>{DEFAULT_INVENTORY.west.itemA} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                    <span>Item B Stock:</span>
                    <strong style={{ color: DEFAULT_INVENTORY.west.itemB < qtyB ? '#ff3b30' : '#fff' }}>
                      {DEFAULT_INVENTORY.west.itemB} units
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', borderTop: '1px solid #222', marginTop: '6px', paddingTop: '4px' }}>
                    <span>Weeks of Supply:</span>
                    <strong style={{ color: '#fff' }}>{DEFAULT_INVENTORY.west.weekOfSupply} weeks</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                    <span>Turnover Rate:</span>
                    <strong style={{ color: '#fff' }}>{DEFAULT_INVENTORY.west.turnoverRate}</strong>
                  </div>
                </div>

              </div>
            </div>

            {/* Visual Trace Progression */}
            <div style={{ background: '#121212', padding: '16px', borderRadius: '8px', border: '1px solid #333', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ color: '#ffffff', fontSize: '14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={16} color="#ff3b30" /> Active Engine Brokering Steps
              </h4>
              
              {/* Stepper progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', left: '10px', right: '10px', height: '2px', background: '#333', zIndex: 1 }}></div>
                <div style={{ position: 'absolute', top: '15px', left: '10px', width: `${((activeStep - 1) / 3) * 100}%`, height: '2px', background: '#ff3b30', zIndex: 1, transition: 'width 0.4s ease' }}></div>
                
                {[1, 2, 3, 4].map((stepNum) => {
                  const labels = ["Ingest", "Proximity", "ORA_SINGLE", "Allocate"];
                  const isActive = activeStep >= stepNum;
                  return (
                    <div key={stepNum} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: activeStep === stepNum ? '#ff3b30' : isActive ? '#1a0000' : '#121212',
                        border: activeStep === stepNum ? '2px solid #ffd700' : isActive ? '2px solid #ff3b30' : '2px solid #333',
                        color: activeStep === stepNum ? '#ffffff' : isActive ? '#ff3b30' : '#888',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease'
                      }}>
                        {stepNum}
                      </div>
                      <span style={{ fontSize: '10px', color: isActive ? '#fff' : '#666', marginTop: '4px', fontWeight: isActive ? 'bold' : 'normal' }}>
                        {labels[stepNum - 1]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Console logs */}
              <div style={{
                background: '#000000',
                border: '1px solid #222',
                borderRadius: '6px',
                padding: '12px',
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '11px',
                height: '140px',
                overflowY: 'auto',
                flexGrow: 1,
                color: '#33ff33', // Green screen terminal look
                boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8)'
              }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                    [SYSTEM READY] Click "Execute Routing Run" to view real-time engine decisions & trace output logs.
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} style={{
                      marginBottom: '6px',
                      color: log.type === 'error' ? '#ff3b30' : log.type === 'warning' ? '#ffcc00' : log.type === 'query' ? '#33ccff' : '#33ff3 green'
                    }}>
                      {log.message}
                    </div>
                  ))
                )}
              </div>

              {/* Routing Result Display */}
              {routingResult && (
                <div style={{
                  marginTop: '16px',
                  background: routingResult.isError ? 'rgba(255, 59, 48, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                  border: routingResult.isError ? '1px solid #ff3b30' : '1px solid #d4af37',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {routingResult.isError ? (
                    <ShieldAlert size={28} color="#ff3b30" style={{ flexShrink: 0 }} />
                  ) : (
                    <CheckCircle size={28} color="#d4af37" style={{ flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      Routing Decision Result:
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>
                      Assigned Facility: <span style={{ color: routingResult.isError ? '#ff3b30' : '#ffd700' }}>{routingResult.facility}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#ccc', marginTop: '2px' }}>
                      {routingResult.reason} (Estimated Proximity: {routingResult.distance})
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
      
      {/* Footer challenge notice */}
      <div style={{
        background: '#121212',
        padding: '12px 20px',
        borderTop: '1px solid rgba(212,175,55,0.1)',
        fontSize: '11px',
        color: '#888',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <HelpCircle size={14} color="#ffd700" />
        <span>
          <strong>Corner Challenge:</strong> Notice how under standard routing (Proximity), CA customer orders route to West Coast WH. But if East Coast runs out of Item B, CA's supply gets drained fast if Yash's clearance rule is active.
        </span>
      </div>
    </div>
  );
}
