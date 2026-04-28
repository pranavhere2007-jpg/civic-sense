// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function AdminDashboard() {
  const [pendingNGOs, setPendingNGOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const fetchPendingNGOs = async () => {
      try {
        // Fetch all users who applied as an organization but are still Pending
        const q = query(
          collection(db, 'Users'), 
          where('role', '==', 'organization'),
          where('verificationStatus', '==', 'Pending')
        );
        
        const querySnapshot = await getDocs(q);
        const ngos = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        
        setPendingNGOs(ngos);
      } catch (err) {
        console.error("Fetch Error:", err);
        setStatusMsg("❌ Failed to load pending applications.");
      } finally {
        setLoading(false);
      }
    };

    fetchPendingNGOs();
  }, []);

  const handleDecision = async (ngoId, decision) => {
    if (!window.confirm(`Are you sure you want to ${decision} this organization?`)) return;

    try {
      const ngoRef = doc(db, 'Users', ngoId);
      
      // Update the status to 'Approved' or 'Rejected'
      await updateDoc(ngoRef, {
        verificationStatus: decision
      });

      // Remove the processed NGO from the UI
      setPendingNGOs((prev) => prev.filter((ngo) => ngo.id !== ngoId));
      alert(`✅ Organization successfully ${decision}!`);

    } catch (err) {
      console.error("Update Error:", err);
      alert("Failed to update verification status.");
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#ff9800', fontSize: '18px' }}>Loading pending applications...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', color: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#f44336', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        🛡️ Admin Control Panel
      </h2>
      <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px' }}>
        Review and verify official documents submitted by NGOs and Government Agencies.
      </p>

      {statusMsg && <p style={{ color: '#ff4d4d', textAlign: 'center' }}>{statusMsg}</p>}

      {pendingNGOs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
          <h3 style={{ margin: 0, color: '#aaa' }}>No pending applications!</h3>
          <p style={{ color: '#666' }}>Inbox is zero.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pendingNGOs.map((ngo) => (
            <div key={ngo.id} style={{ backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', padding: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#e1bee7' }}>{ngo.orgName}</h3>
                  <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>📧 {ngo.email}</p>
                </div>
                <span style={{ backgroundColor: '#ff980022', color: '#ff9800', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ff9800' }}>
                  PENDING REVIEW
                </span>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#aaa', fontSize: '12px', display: 'block' }}>NGO Darpan ID</strong>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{ngo.darpanId}</span>
                </div>
                <div style={{ flex: 2 }}>
                  <strong style={{ color: '#aaa', fontSize: '12px', display: 'block' }}>Description</strong>
                  <span style={{ fontSize: '14px' }}>{ngo.description || 'No description provided.'}</span>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <strong style={{ color: '#aaa', fontSize: '14px', display: 'block', marginBottom: '10px' }}>Uploaded Documents:</strong>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <a href={ngo.documents?.registrationCertificate} target="_blank" rel="noreferrer" style={{ padding: '8px 15px', backgroundColor: '#333', color: '#2196F3', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', border: '1px solid #444' }}>
                    📄 View Registration Cert
                  </a>
                  <a href={ngo.documents?.panCard} target="_blank" rel="noreferrer" style={{ padding: '8px 15px', backgroundColor: '#333', color: '#2196F3', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', border: '1px solid #444' }}>
                    📄 View PAN Card
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                <button onClick={() => handleDecision(ngo.id, 'Rejected')} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ❌ Reject Application
                </button>
                <button onClick={() => handleDecision(ngo.id, 'Approved')} style={{ flex: 2, padding: '12px', backgroundColor: '#4CAF50', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ✅ Verify & Approve NGO
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}