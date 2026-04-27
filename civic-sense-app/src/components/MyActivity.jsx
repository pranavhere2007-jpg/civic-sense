// src/components/MyActivity.jsx
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function MyActivity({onSelectReport}) {
  const [raisedIssues, setRaisedIssues] = useState([]);
  const [volunteeredIssues, setVolunteeredIssues] = useState([]);
  const [activeTab, setActiveTab] = useState('actions');
  const [selectedIssue, setSelectedIssue] = useState(null); // NEW: Track clicked issue
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    const raisedQuery = query(collection(db, 'Reports'), where('userId', '==', currentUser.uid));
    const unsubscribeRaised = onSnapshot(raisedQuery, (snapshot) => {
      setRaisedIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const volQuery = query(collection(db, 'Reports'), where('volunteerId', '==', currentUser.uid));
    const unsubscribeVol = onSnapshot(volQuery, (snapshot) => {
      setVolunteeredIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeRaised();
      unsubscribeVol();
    };
  }, [currentUser.uid]);

  // Computed Notifications Hack
  const actionItems = raisedIssues.filter(issue => issue.status === 'Pending Verification');

  const tabStyle = (tabName) => ({
    padding: '10px 20px', cursor: 'pointer', backgroundColor: activeTab === tabName ? '#2196F3' : '#333',
    color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold'
  });

  // Helper style to make list items look clickable
  const cardStyle = {
    padding: '15px', 
    backgroundColor: '#2a2a2a', 
    borderRadius: '8px', 
    marginBottom: '10px',
    cursor: 'pointer',
    border: '1px solid #444',
    transition: 'border-color 0.2s, transform 0.1s'
  };

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      
      {/* Left Side: The Lists */}
      <div style={{ flex: '1', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', color: '#fff', border: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '15px' }}>
          <button onClick={() => { setActiveTab('actions'); setSelectedIssue(null); }} style={tabStyle('actions')}>
            Action Center {actionItems.length > 0 && <span style={{ background: 'red', borderRadius: '50%', padding: '2px 8px', marginLeft: '5px' }}>{actionItems.length}</span>}
          </button>
          <button onClick={() => { setActiveTab('raised'); onSelectReport(null); }} style={tabStyle('raised')}>
            My Reports
          </button>
          <button onClick={() => { setActiveTab('volunteered'); onSelectReport(null); }} style={tabStyle('volunteered')}>
            My Tasks
          </button>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '600px', paddingRight: '10px' }}>
          
          {/* ACTION CENTER TAB */}
          {activeTab === 'actions' && (
            <div>
              <h3 style={{ color: '#ff9800' }}>Requires Your Attention</h3>
              {actionItems.length === 0 ? <p style={{ color: '#888' }}>You have no pending actions.</p> : null}
              
              {actionItems.map(issue => (
                <div 
                  key={issue.id} 
                  style={{ ...cardStyle, borderLeft: '4px solid #ff9800', borderColor: selectedIssue?.id === issue.id ? '#ff9800' : '#444' }}
                  onClick={() => onSelectReport(issue)}
                >
                  <strong>Verification Required:</strong> A volunteer claims they fixed: "{issue.description}"
                  <br /><br />
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Click to view details and verify ➡️</span>
                </div>
              ))}
            </div>
          )}

          {/* MY REPORTS TAB */}
          {activeTab === 'raised' && (
            <div>
              <h3>Issues I Reported</h3>
              {raisedIssues.map(issue => (
                <div 
                  key={issue.id} 
                  style={{ ...cardStyle, borderColor: selectedIssue?.id === issue.id ? '#2196F3' : '#444' }}
                  onClick={() => onSelectReport(issue)}
                >
                  <strong style={{ color: '#2196F3' }}>{issue.status}</strong> - {issue.description}
                </div>
              ))}
            </div>
          )}

          {/* MY TASKS TAB */}
          {activeTab === 'volunteered' && (
            <div>
              <h3>Issues I Volunteered For</h3>
              {volunteeredIssues.map(issue => (
                <div 
                  key={issue.id} 
                  style={{ ...cardStyle, borderColor: selectedIssue?.id === issue.id ? '#4CAF50' : '#444' }}
                  onClick={() => onSelectReport(issue)}
                >
                  <strong style={{ color: '#4CAF50' }}>{issue.status}</strong> - {issue.description}
                  {issue.status === 'Claimed' && (
                    <p style={{ fontSize: '12px', color: '#ff9800', marginTop: '5px' }}>Don't forget to submit your resolution photo within 48 hours!</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}