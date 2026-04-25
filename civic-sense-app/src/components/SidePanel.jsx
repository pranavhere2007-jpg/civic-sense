// src/components/SidePanel.jsx
import { doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function SidePanel({ report, onClose }) {
  const currentUser = auth.currentUser;

  const isClaimExpired = () => {
    if (report.status === 'Claimed' && report.claimedAt) {
      const claimedDate = report.claimedAt.toDate();
      const now = new Date();
      const hoursDiff = (now - claimedDate) / (1000 * 60 * 60);
      return hoursDiff > 48;
    }
    return false;
  };

  const handleVolunteer = async () => {
    if (window.confirm("Commit to resolving this? You have 48 hours to post the result.")) {
      await updateDoc(doc(db, "Reports", report.id), {
        status: 'Claimed',
        volunteerId: currentUser.uid,
        claimedAt: new Date()
      });
      onClose();
    }
  };

  const handleWithdraw = async () => {
    if (window.confirm("Are you sure you want to withdraw this report?")) {
      await deleteDoc(doc(db, "Reports", report.id));
      onClose();
    }
  };

  const handleResolve = async () => {
    if (window.confirm("Submit resolution for verification?")) {
      await updateDoc(doc(db, "Reports", report.id), {
        status: 'Pending Verification',
      });
      alert("Resolution submitted! Waiting for original author to verify.");
      onClose();
    }
  };

  // NEW: Allow author to verify directly from the side panel
  const handleVerify = async () => {
    if (window.confirm("Verify this issue is resolved? The volunteer will receive 50 points.")) {
      try {
        await updateDoc(doc(db, "Reports", report.id), { status: 'Resolved' });
        await updateDoc(doc(db, "Users", report.volunteerId), { points: increment(50) });
        alert("Verified! Points awarded to the volunteer.");
        onClose();
      } catch (error) {
        console.error("Verification failed:", error);
      }
    }
  };

  const displayStatus = isClaimExpired() ? 'Open (Claim Expired)' : report.status || 'Open';
  
  const formattedDate = report.createdAt && report.createdAt.toDate 
    ? report.createdAt.toDate().toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Just now';

  return (
    <div style={{ padding: '25px', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#2196F3' }}>{report.category}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      </div>

      {report.imageUrl && (
        <img src={report.imageUrl} alt="Civic Issue" style={{ width: '100%', borderRadius: '8px', marginBottom: '15px', border: '1px solid #444', objectFit: 'cover' }} />
      )}
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0' }}><strong style={{ color: '#aaa' }}>Status: </strong> 
          <span style={{ color: displayStatus.includes('Resolved') ? '#4CAF50' : displayStatus.includes('Claimed') ? '#2196F3' : '#ff9800', fontWeight: 'bold' }}>
            {displayStatus}
          </span>
        </p>
        <p style={{ margin: '0 0 10px 0' }}><strong style={{ color: '#aaa' }}>Date: </strong>{formattedDate}</p>
        <p style={{ margin: '0' }}><strong style={{ color: '#aaa' }}>Description: </strong><br/>{report.description}</p>
      </div>

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* AUTHOR ACTIONS: Split logic based on status */}
        {currentUser?.uid === report.userId && (report.status === 'Open' || report.status === 'Claimed') && (
          <button onClick={handleWithdraw} style={{ backgroundColor: '#ff4d4d', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Withdraw Report
          </button>
        )}
        {currentUser?.uid === report.userId && report.status === 'Pending Verification' && (
          <button onClick={handleVerify} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Verify Resolution ✓
          </button>
        )}

        {/* VOLUNTEER ACTIONS */}
        {report.category === 'Community Action' && (report.status === 'Open' || isClaimExpired()) && currentUser?.uid !== report.userId && (
          <button onClick={handleVolunteer} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Volunteer to Fix
          </button>
        )}
        {report.volunteerId === currentUser?.uid && report.status === 'Claimed' && !isClaimExpired() && (
          <button onClick={handleResolve} style={{ backgroundColor: '#2196F3', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Submit Resolution
          </button>
        )}

        {/* INFRA ESCALATION */}
        {report.category === 'Infrastructure' && report.status === 'Open' && (
          <button style={{ backgroundColor: '#555', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Escalate to Authorities
          </button>
        )}
      </div>
    </div>
  );
}