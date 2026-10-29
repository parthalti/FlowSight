import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './roadMap.css';

export default function IndiaRoadMap({ center, roads = [], selectedRoad, onRoadSelect, onLocationChange }) {
  const element = useRef(null);
  const map = useRef(null);
  const layers = useRef([]);
  useEffect(() => {
    if (!element.current || map.current) return;
    const instance = L.map(element.current, { zoomControl: true }).setView([center.lat, center.lon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    instance.on('click', event => onLocationChange?.({ lat: Number(event.latlng.lat.toFixed(5)), lon: Number(event.latlng.lng.toFixed(5)) }));
    map.current = instance;
    const resize = () => instance.invalidateSize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    map.current.setView([center.lat, center.lon], 13, { animate: true });
  }, [center.lat, center.lon]);
  useEffect(() => {
    if (!map.current) return;
    layers.current.forEach(layer => layer.remove());
    layers.current = [];
    roads.forEach(road => {
      const points = (road.geometry || []).map(([lat, lon]) => [lat, lon]);
      if (points.length < 2) return;
      const line = L.polyline(points, { color: selectedRoad?.id === road.id ? '#d97737' : '#187f77', weight: selectedRoad?.id === road.id ? 6 : 3, opacity: .85 }).addTo(map.current);
      line.bindTooltip(road.name || 'Mapped road');
      line.on('click', () => onRoadSelect?.(road));
      layers.current.push(line);
    });
    if (roads.length) {
      const all = L.featureGroup(layers.current);
      map.current.fitBounds(all.getBounds().pad(.12), { maxZoom: 15 });
    }
  }, [roads, selectedRoad, onRoadSelect]);
  return <div className="road-map-wrap"><div ref={element} className="road-map" role="application" aria-label="Interactive OpenStreetMap. Click the map to choose a location."/><div className="map-instruction">Click map to choose a location · select a mapped road after lookup</div></div>;
}
