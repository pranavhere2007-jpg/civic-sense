// src/components/Leaderboard.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Leaderboard() {
  const [citizens, setCitizens] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('citizens'); // 'citizens' or 'agencies'

  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'Users'));
        
        let allUsers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 1. GHOST THE ADMIN: Make sure the admin email never shows up
        allUsers = allUsers.filter(user => user.email !== 'admin@college.edu');

        // 2. Sort everyone by points (highest to lowest)
        allUsers.sort((a, b) => (b.points || 0) - (a.points || 0));

        // 3. Split into two leagues based on their role
        const citizenList = allUsers.filter(user => user.role !== 'organization');
        const agencyList = allUsers.filter(user => user.role === 'organization');

        setCitizens(citizenList);
        setAgencies(agencyList);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#ff9800' }}>Loading rankings...</div>;
  }

  // Helper to get the correct array based on the active tab
  const currentList = activeTab === 'citizens' ? citizens : agencies;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', color: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#ff9800', marginBottom: '20px' }}>🏆 Civic Leaderboard</h2>

      {/* THE TAB TOGGLE */}
      <div style={{ display: 'flex', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #333' }}>
        <button 
          onClick={() => setActiveTab('citizens')}
          style={{ flex: 1, padding: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'citizens' ? '#ff9800' : 'transparent', color: activeTab === 'citizens' ? '#000' : '#aaa', transition: '0.3s' }}
        >
          Top Citizens
        </button>
        <button 
          onClick={() => setActiveTab('agencies')}
          style={{ flex: 1, padding: '12px', cursor: 'pointer', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'agencies' ? '#9c27b0' : 'transparent', color: activeTab === 'agencies' ? '#fff' : '#aaa', transition: '0.3s' }}
        >
          Top Agencies
        </button>
      </div>

      {/* THE LEADERBOARD LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#aaa', backgroundColor: '#1e1e1e', borderRadius: '8px' }}>
            No points awarded in this league yet!
          </div>
        ) : (
          currentList.map((user, index) => {
            // Assign Medals to the Top 3
            let medal = `#${index + 1}`;
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';

            return (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', padding: '15px 20px', borderRadius: '8px', border: '1px solid #333' }}>
                <div style={{ width: '40px', fontSize: index < 3 ? '24px' : '16px', fontWeight: 'bold', color: '#888' }}>
                  {medal}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {/* Display OrgName for agencies, or Email for citizens */}
                    {activeTab === 'agencies' ? user.orgName : user.email.split('@')[0]}
                  </div>
                </div>
                <div style={{ fontWeight: 'bold', color: activeTab === 'citizens' ? '#ff9800' : '#e1bee7', fontSize: '18px' }}>
                  {user.points || 0} pts
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}