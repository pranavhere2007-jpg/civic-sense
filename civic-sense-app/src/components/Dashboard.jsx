// src/components/Dashboard.jsx
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState } from 'react';

// Import your newly created components
import ReportForm from './ReportForm';
import MapView from './MapView';
import Leaderboard from './Leaderboard';
import SidePanel from './SidePanel';
import MyActivity from './MyActivity';

export default function Dashboard() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentView, setCurrentView] = useState('map');

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: '#121212', 
      color: '#ffffff', 
      fontFamily: 'system-ui, -apple-system, sans-serif' 
    }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '20px 40px',
        backgroundColor: '#1e1e1e',
        borderBottom: '1px solid #333'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', letterSpacing: '1px' }}>CivicSense</h1>
          
          {/* NAVIGATION PANEL */}
          <nav style={{ display: 'flex', gap: '10px' }}>
            <button 
              // NEW: Clear the selected report when navigating
              onClick={() => { setCurrentView('map'); setSelectedReport(null); }} 
              style={{ padding: '8px 16px', background: currentView === 'map' ? '#333' : 'transparent', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}
            >
              🗺️ Live Map
            </button>
            <button 
              // NEW: Clear the selected report when navigating
              onClick={() => { setCurrentView('activity'); setSelectedReport(null); }} 
              style={{ padding: '8px 16px', background: currentView === 'activity' ? '#333' : 'transparent', color: 'white', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}
            >
              👤 My Activity
            </button>
          </nav>
        </div>

        <button 
          onClick={handleLogout} 
          style={{ 
            padding: '8px 20px', 
            cursor: 'pointer', 
            backgroundColor: '#ff4d4d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            fontWeight: 'bold' 
          }}
        >
          Log Out
        </button>
      </header>

      {/* Dynamic Content Area */}
      {currentView === 'map' ? (
        
        /* Live Map Layout */
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 400px', /* Left: Map fills space. Right: Fixed 400px width */
          gap: '20px', 
          padding: '20px 40px',
          height: 'calc(100vh - 85px)' 
        }}>
          
          {/* Left Column: Map */}
          <div style={{ 
            borderRadius: '12px', 
            overflow: 'hidden', 
            border: '1px solid #333',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            height: '100%'
          }}>
            <MapView onSelectReport={setSelectedReport} />
          </div>

          {/* Right Column: Stacked Form and Side Panel */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto', /* Allows scrolling if the right side content gets too long */
            paddingRight: '10px'
          }}>
            
            {/* Top Right: Form */}
            <div>
              <ReportForm />
            </div>

            {/* Bottom Right: Side Panel */}
            <div style={{ flexGrow: 1 }}>
              {selectedReport ? (
                <SidePanel report={selectedReport} onClose={() => setSelectedReport(null)} />
              ) : (
                <div style={{ 
                  padding: '40px 20px', 
                  border: '2px dashed #444', 
                  textAlign: 'center', 
                  borderRadius: '12px', 
                  color: '#888',
                  backgroundColor: '#1e1e1e',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <p>Select a pin on the map to view details and take action.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (
        
        /* Activity Layout */
        <div style={{ padding: '20px 40px', maxWidth: '1000px', margin: '0 auto' }}>
          <MyActivity />
        </div>

      )}
    </div>
  );
}