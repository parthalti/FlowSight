import React, { useEffect, useMemo, useState } from 'react';
import { PRESETS, FIELDS, GROUPS, MODEL_COMPARISON, analyzeTraffic, number } from './traffic.js';
import IndiaRoadMap from './IndiaRoadMap.jsx';

const DEFAULT = PRESETS['Morning rush'];
const SAME = { ...DEFAULT };
function Section({ n, title, children }) {
  return <section className="panel"><div className="section-heading"><span>{n}</span><div><h2>{title}</h2>{children && <p>Explore the current scenario and its evidence.</p>}</div></div></section>;
}

export default function App() {
  const [traffic, setTraffic] = useState(DEFAULT);
  const [reference, setReference] = useState(SAME);
  const [sampleSize, setSampleSize] = useState(30);
  const [totalLanes, setTotalLanes] = useState(3);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState({ name: 'Nagpur', lat: 21.1458, lon: 79.0882 });
  const [road, setRoad] = useState(null);
  const [roads, setRoads] = useState([]);
  const [mapStatus, setMapStatus] = useState('Choose a city or select a road on the map.');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const response = await analyzeTraffic({ traffic, reference, sample_size: sampleSize, total_lanes: totalLanes }, controller.signal);
        setAnalysis(response); setSelectedRecord(null);
      } catch (e) { if (e.name !== 'AbortError') setError(e.message || 'Analysis failed.'); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [traffic, reference, sampleSize, totalLanes]);

  const visibleMatches = useMemo(() => (analysis?.matches || []).filter(r => !selectedGroup || r.segment_name === selectedGroup), [analysis, selectedGroup]);
  function updateField(key, value) {
    setTraffic(old => ({ ...old, [key]: value }));
    if (key === 'road_lanes') setTotalLanes(old => Math.max(old, value));
    setSelectedGroup(''); setSelectedRecord(null);
  }
  async function loadRoads(point = city) {
    setMapStatus('Looking up mapped roads…'); setRoads([]); setRoad(null);
    try {
      const res = await fetch('/api/map/roads', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({lat:point.lat,lon:point.lon}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Road lookup unavailable.');
      setRoads(data.roads || []); setMapStatus((data.roads || []).length ? 'Select a mapped road to inspect its tags.' : 'No roads returned. You can still use manual inputs.');
    } catch (e) { setMapStatus(e.message + ' Manual traffic scenarios remain available.'); }
  }
  function exportScenario() {
    const payload = { version:1, created_at:new Date().toISOString(), purpose:'User-entered scenario; not live traffic or navigation advice', location:{city:city.name,lat:city.lat,lon:city.lon,road:road?.name || null,osm_way_id:road?.id || null}, map_source:'OpenStreetMap contributors; verify lane tags locally', traffic, reference, total_lanes:totalLanes, sample_size:sampleSize, analysis_source:'Simulated traffic observations', analysis:analysis?.lane_plan || null };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='flowsight-scenario.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">F</span><span>FlowSight<small>INDIA ROAD LAB</small></span></a><div className="topbar-note"><span className="live-dot"/> EXPLORATORY TRAFFIC ANALYTICS</div></header>
    <main className="page">
      <section className="hero"><div className="eyebrow">A CLEARER VIEW OF THE ROAD</div><h1>Traffic patterns,<br/><em>made understandable.</em></h1><p>Explore road context, change a traffic scenario, and inspect what machine-learning models find in comparable observations.</p><div className="hero-tags"><span>01 · MAP CONTEXT</span><span>02 · MACHINE LEARNING</span><span>03 · EXPLAINABLE RESULTS</span></div></section>
      <div className="notice"><strong>Data transparency</strong><span>The map uses OpenStreetMap road data when available. Traffic examples are simulated—not live congestion, navigation advice, or real travel-time forecasts.</span></div>
      <div className="layout">
        <aside className="sidebar">
          <section className="panel"><div className="section-heading"><span>01</span><div><h2>Choose a road area</h2><p>Map geometry is real when the provider responds.</p></div></div>
            <label className="field-label" htmlFor="city">City shortcut</label><select id="city" value={city.name} onChange={e=>{const cities={'Nagpur':[21.1458,79.0882],'Pune':[18.5204,73.8567],'Mumbai':[19.076,72.8777],'New Delhi':[28.6139,77.209],'Bengaluru':[12.9716,77.5946],'Hyderabad':[17.385,78.4867],'Chennai':[13.0827,80.2707]};const [lat,lon]=cities[e.target.value];const next={name:e.target.value,lat,lon};setCity(next);setRoad(null);setRoads([]);setMapStatus('City changed. Look up nearby roads when ready.');}}>{['Nagpur','Pune','Mumbai','New Delhi','Bengaluru','Hyderabad','Chennai'].map(c=><option key={c}>{c}</option>)}</select>
            <button className="secondary-button full" onClick={()=>loadRoads()}>Find nearby mapped roads</button><p className="helper">{mapStatus}</p>
            {roads.length>0&&<label className="field-label">Mapped roads<select value={road?.id || ''} onChange={e=>setRoad(roads.find(r=>String(r.id)===e.target.value)||null)}><option value="">Choose road</option>{roads.map(r=><option key={r.id} value={r.id}>{r.name} · {r.kind}</option>)}</select></label>}
            {road&&<div className="road-card"><strong>{road.name}</strong><span>{road.kind} · {road.lanes ?? 'Lane count not mapped'} lanes</span><a href={road.osm_url} target="_blank" rel="noreferrer">OpenStreetMap details ↗</a><p>OSM lane tags can be missing or outdated. Confirm the real road layout.</p></div>}
          </section>
          <section className="panel"><div className="section-heading"><span>02</span><div><h2>Build a scenario</h2><p>Change an input to update the analysis.</p></div></div>
            <label className="field-label" htmlFor="preset">Start with a preset</label><select id="preset" onChange={e=>{if(PRESETS[e.target.value]){setTraffic({...PRESETS[e.target.value]});setTotalLanes(Math.max(totalLanes,PRESETS[e.target.value].road_lanes));setSelectedGroup('');}}}><option value="">Choose scenario</option>{Object.keys(PRESETS).map(p=><option key={p}>{p}</option>)}</select>
            {FIELDS.map(f=><div className="slider-field" key={f.key}><div className="slider-label"><label htmlFor={f.key}>{f.label}</label><strong>{number(traffic[f.key], f.step<1?1:0)} <small>{f.unit}</small></strong></div><input id={f.key} type="range" min={f.min} max={f.max} step={f.step} value={traffic[f.key]} onChange={e=>updateField(f.key,Number(e.target.value))}/><p>{f.hint}</p></div>)}
            <label className="field-label" htmlFor="total-lanes">Total lanes on this road</label><select id="total-lanes" value={totalLanes} onChange={e=>setTotalLanes(Number(e.target.value))}>{[1,2,3,4,5,6].filter(n=>n>=traffic.road_lanes).map(n=><option key={n} value={n}>{n} lanes</option>)}</select>
            <label className="field-label" htmlFor="samples">Comparable records: {sampleSize}</label><input id="samples" type="range" min="5" max="100" step="5" value={sampleSize} onChange={e=>setSampleSize(Number(e.target.value))}/>
            <div className="button-row"><button className="secondary-button" onClick={()=>{setTraffic({...DEFAULT});setReference({...DEFAULT});setTotalLanes(3);setSampleSize(30);setSelectedGroup('');}}>Reset</button><button className="primary-button" disabled={!analysis || busy || traffic.road_lanes===0} onClick={exportScenario}>Export JSON</button></div>
          </section>
        </aside>
        <div className="content">
          <section className="map-panel"><div className="panel-head"><div><span className="eyebrow">GEOGRAPHIC CONTEXT</span><h2>{city.name} road explorer</h2></div><span className="map-badge">OSM · ROAD GEOMETRY</span></div><IndiaRoadMap center={city} roads={roads} selectedRoad={road} onRoadSelect={setRoad} onLocationChange={p=>{setCity({...city,lat:p.lat,lon:p.lon,name:'Pinned location'});setRoad(null);}}/><div className="map-caption"><span>● {city.name} · {city.lat.toFixed(4)}, {city.lon.toFixed(4)}</span><span>Road data may be unavailable during provider timeouts.</span></div></section>
          <div className="results-head"><div><span className="eyebrow">LIVE SCENARIO ANALYSIS</span><h2>Your traffic snapshot</h2></div><span className={busy?'status-pill loading':'status-pill'}>{busy?'Updating analysis':'Scenario ready'}</span></div>
          {error&&<div className="error-box" role="alert">{error}<p>Run the model training command and ensure Flask is running.</p></div>}
          {busy&&!analysis&&<div className="loading-panel">Finding comparable traffic records…</div>}
          {analysis&&<><div className="metric-grid"><div className="metric-card"><span>Closest pattern</span><strong style={{color:GROUPS[analysis.summary.dominant_group]?.color}}>{GROUPS[analysis.summary.dominant_group]?.label || analysis.summary.dominant_group}</strong><small>Most common group in the sample</small></div><div className="metric-card"><span>Average recorded delay</span><strong>{number(analysis.summary.avg_delay)} <small>min</small></strong><small>Across {analysis.sample_size} similar examples</small></div><div className="metric-card"><span>Average speed</span><strong>{number(analysis.summary.avg_speed)} <small>km/h</small></strong><small>From matching observations</small></div></div>
          <Section n="03" title="Explore traffic groups"><p>Choose a group to filter comparable records.</p></Section>
          <div className="group-grid">{analysis.segments.map(g=><button key={g.cluster_id} className={'group-card '+(selectedGroup===g.segment_name?'selected':'')} onClick={()=>{setSelectedGroup(selectedGroup===g.segment_name?'':g.segment_name);setSelectedRecord(null);}}><span className="group-dot" style={{background:GROUPS[g.segment_name]?.color}}/><span>{GROUPS[g.segment_name]?.label || g.segment_name}</span><strong>{g.count}<small> / {sampleSize}</small></strong><div className="progress"><span style={{width:g.share+'%',background:GROUPS[g.segment_name]?.color}}/></div><small>{g.avg_delay==null?'No matching records':number(g.avg_delay)+' min avg. delay'}</small></button>)}</div>
          <section className="panel"><div className="section-heading"><span>04</span><div><h2>Comparable observations</h2><p>Nearest examples from the simulated dataset—not measurements from the selected road.</p></div></div><div className="table-wrap"><table><thead><tr><th>Record</th><th>Group</th><th>Speed</th><th>Delay</th><th>Detail</th></tr></thead><tbody>{visibleMatches.map(r=><tr key={r.record_id} className={selectedRecord===r.record_id?'selected-row':''}><td>#{r.record_id}<small>{r.road_zone} · {String(r.hour).padStart(2,'0')}:00</small></td><td>{GROUPS[r.segment_name]?.label||r.segment_name}</td><td>{number(r.average_speed_kmph)} km/h</td><td>{number(r.delay_minutes)} min</td><td><button className="text-button" onClick={()=>setSelectedRecord(selectedRecord===r.record_id?null:r.record_id)}>Details</button></td></tr>)}</tbody></table></div>{selectedRecord&&(()=>{const r=analysis.matches.find(x=>x.record_id===selectedRecord);return r&&<div className="record-detail"><strong>Record #{r.record_id} · {r.road_zone}</strong><p>{r.traffic_volume} vehicles · {r.rainfall_mm} mm rainfall · {r.incidents} incidents · {r.road_lanes} lanes</p><small>Similarity distance: {r.similarity_distance}. Smaller means closer in standardized input features.</small><button className="text-button" onClick={()=>{setTraffic(Object.fromEntries(FIELDS.map(f=>[f.key,r[f.key]])));setTotalLanes(r.road_lanes);setSelectedRecord(null);setSelectedGroup('');}}>Use this record as input</button></div>})()}</section>
          <section className="panel"><div className="section-heading"><span>05</span><div><h2>Explain the group</h2><p>Decision-tree rules provide a compact explanation of the current inputs.</p></div></div><div className="tree-result"><strong>{analysis.tree.segment_name}</strong>{analysis.tree.rules.map((rule,i)=><p key={i}>↳ {rule.text}</p>)}</div><p className="footnote">The decision tree approximates K-Means labels and can differ from the most common group among the nearest records.</p></section>
          <section className="panel"><div className="section-heading"><span>06</span><div><h2>Delay contribution vs reference</h2><p>Linear-model associations for changes from the chosen example.</p></div></div><label className="field-label" htmlFor="reference">Reference scenario</label><select id="reference" value={Object.keys(PRESETS).find(k=>JSON.stringify(PRESETS[k])===JSON.stringify(reference))||'custom'} onChange={e=>setReference(PRESETS[e.target.value]?{...PRESETS[e.target.value]}:{...traffic})}><option value="custom">Current values (zero difference)</option>{Object.keys(PRESETS).map(p=><option key={p}>{p}</option>)}</select><div className="contribution-list">{analysis.contributions.map(f=><div className="contribution-row" key={f.feature}><span>{f.label}<small>{f.reference} → {f.current} {f.unit}</small></span><strong className={f.minutes>0?'positive':f.minutes<0?'negative':''}>{f.minutes>0?'+':''}{number(f.minutes,2)} min</strong></div>)}</div><p className="footnote">These are fitted model associations on simulated data, not proof of cause or a prediction of an actual journey.</p></section>
          <section className="panel"><div className="section-heading"><span>07</span><div><h2>Model comparison</h2><p>Held-out benchmark results reported by the project.</p></div></div><div className="model-list">{MODEL_COMPARISON.map(m=><div key={m.model} className="model-row"><div><strong>{m.model}</strong><p>{m.role}</p></div><span>{m.metric}</span></div>)}</div></section>
          </>}
        </div>
      </div>
      <footer className="footer">FlowSight · India Road Lab <span>OpenStreetMap geography · simulated traffic observations · no live congestion feed</span></footer>
    </main>
  </div>;
}
