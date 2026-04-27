// src/components/Dashboard.jsx
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState } from 'react';

import ReportForm from './ReportForm';
import MapView from './MapView';
import SidePanel from './SidePanel';
import MyActivity from './MyActivity';
import AllIncidents from './AllIncidents'; // NEW IMPORT

export default function Dashboard() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentView, setCurrentView] = useState('map'); // 'map', 'activity', or 'list'

  const handleNavigation = (view) => {
    setCurrentView(view);
    setSelectedReport(null); // Close any open modals when switching tabs
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#121212', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* HEADER (Made flex-wrap for mobile screens) */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', gap: '15px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>CivicSense</h1>
        
        {/* NAVIGATION PANEL */}
        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => handleNavigation('map')} style={{ padding: '8px 12px', background: currentView === 'map' ? '#333' : 'transparent', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
            🗺️ Live Map
          </button>
          <button onClick={() => handleNavigation('list')} style={{ padding: '8px 12px', background: currentView === 'list' ? '#333' : 'transparent', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
            📋 All Issues
          </button>
          <button onClick={() => handleNavigation('activity')} style={{ padding: '8px 12px', background: currentView === 'activity' ? '#333' : 'transparent', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
            👤 My Activity
          </button>
          <button onClick={() => signOut(auth)} style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
            Log Out
          </button>
        </nav>
      </header>

      {/* DYNAMIC CONTENT AREA */}
      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {currentView === 'map' && (
          /* RESPONSIVE LAYOUT: Flex wrap makes form stack on top of map on mobile */
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Form Container (Takes full width on mobile, 400px on desktop) */}
            <div style={{ flex: '1 1 350px', maxWidth: '100%' }}>
              <ReportForm />
            </div>

            {/* Map Container (Takes remaining space, minimum 500px height) */}
            <div style={{ flex: '2 1 500px', height: '65vh', minHeight: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
              <MapView onSelectReport={setSelectedReport} />
            </div>

          </div>
        )}

        {currentView === 'list' && (
           <AllIncidents onSelectReport={setSelectedReport} />
        )}

        {currentView === 'activity' && (
          /* Pass setSelectedReport to MyActivity so it can trigger the Modal too! */
          <MyActivity onSelectReport={setSelectedReport} />
        )}

      </div>

      {/* GLOBAL POP-UP MODAL OVERLAY */}
      {selectedReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)', // Dark semi-transparent background
          zIndex: 9999, // Ensure it floats above the map
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '20px', boxSizing: 'border-box'
        }}>
          {/* Prevent the modal from getting too tall on small phones */}
          <div style={{ width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px' }}>
            <SidePanel report={selectedReport} onClose={() => setSelectedReport(null)} />
          </div>
        </div>
      )}

    </div>
  );
}