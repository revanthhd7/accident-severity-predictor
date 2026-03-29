import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.heat";
import { MapPin, Flame, Eye, EyeOff } from "lucide-react";
import { getHistory } from "@/lib/prediction-engine";

const DEFAULT_CENTER: [number, number] = [17.385, 78.4867];

const COLORS = ["#10b981", "#eab308", "#f97316", "#dc2626"];

function createIcon(color: string) {
  return L.divIcon({
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      transition: transform 0.2s ease-in-out;
    " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>`,
  });
}

export function AccidentMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false, // We can disable default to make it look cleaner, or reposition it
    }).setView(DEFAULT_CENTER, 12);
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstance.current = map;

    // ✅ PURE LIGHT MODERN MAP TILE (OpenStreetMap Standard)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // ✅ FORCE WHITE BACKGROUND
    const container = map.getContainer();
    container.style.background = "#ffffff";
    container.style.filter = "none";

    // Heatmap with more vibrant colors for light theme
    const heat = (L as any).heatLayer(
      [
        [17.4435, 78.3772, 0.9],
        [17.4138, 78.4408, 0.7],
      ],
      { radius: 25, blur: 20, maxZoom: 14, gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' } }
    );
    heat.addTo(map);
    heatRef.current = heat;

    // Markers
    const cluster = (L as any).markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true
    });
    clusterRef.current = cluster;

    getHistory().forEach((r: any) => {
      if (r.lat && r.lng) {
        const marker = L.marker([r.lat, r.lng], {
          icon: createIcon(COLORS[r.result.severity]),
        });
        cluster.addLayer(marker);
      }
    });

    cluster.addTo(map);

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !heatRef.current) return;
    showHeatmap
      ? mapInstance.current.addLayer(heatRef.current)
      : mapInstance.current.removeLayer(heatRef.current);
  }, [showHeatmap]);

  useEffect(() => {
    if (!mapInstance.current || !clusterRef.current) return;
    showMarkers
      ? mapInstance.current.addLayer(clusterRef.current)
      : mapInstance.current.removeLayer(clusterRef.current);
  }, [showMarkers]);

  return (
    <div className="bg-white/95 backdrop-blur-md text-slate-800 rounded-2xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-300">
      <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 tracking-tight">
          <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
            <MapPin size={18} />
          </div>
          Interactive Accident Map
        </h3>

        <div className="flex gap-2">
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${showHeatmap ? 'bg-orange-100 text-orange-600 shadow-sm' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            title="Toggle Heatmap"
          >
            <Flame size={16} className={showHeatmap ? 'animate-pulse' : ''} />
          </button>
          <button 
            onClick={() => setShowMarkers(!showMarkers)}
            className={`p-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${showMarkers ? 'bg-blue-100 text-blue-600 shadow-sm' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            title="Toggle Incident Markers"
          >
            {showMarkers ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      </div>

      <div ref={mapRef} className="h-[450px] w-full z-0" />
    </div>
  );
}