// src/components/MapView.jsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import 'leaflet/dist/leaflet.css'; 

// Fix for default Leaflet icon paths in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// CRITICAL: Ensure { onSelectReport } is inside these parentheses!
export default function MapView({ onSelectReport }) {
  const [reports, setReports] = useState([]);
  
  // Centered on Bengaluru
  const defaultCenter = [12.9716, 77.5946]; 

  useEffect(() => {
    const q = query(collection(db, 'Reports'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportsData = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().latitude && doc.data().longitude && doc.status !== "Resolved") {
          reportsData.push({ id: doc.id, ...doc.data() });
        }
      });
      setReports(reportsData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ height: '100%', minHeight: '600px', width: '100%', backgroundColor: '#2a2a2a' }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {reports
        .filter((report) => report.status !== "Pending Verification" && report.status !== "Resolved")
        .map((report) => (
          <Marker 
            key={report.id} 
            position={[report.latitude, report.longitude]}
            eventHandlers={{
              click: () => {
                // This console log will help us verify the click is registering
                console.log("Pin clicked! Sending to Dashboard:", report.id);
                // This triggers the Side Panel to open
                if (onSelectReport) {
                  onSelectReport(report);
                }
              },
            }}
          >
            {/* The restored "little marker" popup */}
            <Popup>
              <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#333' }}>
                {report.category === 'Infrastructure' ? '🏗️ Infra Issue' : '🧹 Community Issue'}
                <br />
                <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
                  Details loaded in panel ➡️
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}