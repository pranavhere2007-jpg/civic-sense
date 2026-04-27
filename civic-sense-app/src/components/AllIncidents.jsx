// src/components/AllIncidents.jsx
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

export default function AllIncidents({ onSelectReport }) {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'Reports'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeReports = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Hide resolved issues from this list too
        if (data.status !== 'Resolved') {
          activeReports.push({ id: doc.id, ...data });
        }
      });
      // Sort newest first
      activeReports.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
      setReports(activeReports);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', color: '#fff', border: '1px solid #333' }}>
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', marginTop: 0 }}>All Active Incidents</h2>
      
      {reports.length === 0 ? (
        <p style={{ color: '#888' }}>No active incidents at the moment.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {reports.map(report => (
            <div 
              key={report.id} 
              onClick={() => onSelectReport(report)}
              style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px', cursor: 'pointer', border: '1px solid #444', transition: 'border-color 0.2s' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong style={{ color: '#2196F3' }}>{report.category}</strong>
                <span style={{ color: report.status === 'Claimed' ? '#ff9800' : '#4CAF50', fontSize: '14px', fontWeight: 'bold' }}>
                  {report.status}
                </span>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ccc' }}>{report.description}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                📍 GPS: {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}