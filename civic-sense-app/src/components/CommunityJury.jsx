// src/components/CommunityJury.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function CommunityJury() {
  const [juryIssues, setJuryIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('📍 Locating nearby issues...');

  const currentUser = auth.currentUser;

  // --- MATH: Haversine Distance Calculator ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  useEffect(() => {
    const fetchNearbyPendingIssues = async () => {
      if (!currentUser) return;

      try {
        // 1. Get Live GPS
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        // 2. Fetch all "Pending Verification" issues from Firebase
        const q = query(collection(db, 'Reports'), where('status', '==', 'Pending Verification'));
        const querySnapshot = await getDocs(q);
        
        const nearbyIssues = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          // Protect against users voting on their own repairs
          if (data.volunteerId === currentUser.uid) return; 
          
          // Protect against double-voting
          if (data.votedBy && data.votedBy.includes(currentUser.uid)) return;

          // 3. Filter by Radius (5000 meters = 5km)
          const distance = calculateDistance(data.latitude, data.longitude, currentLat, currentLng);
          if (distance <= 5000) {
            nearbyIssues.push({ id: docSnap.id, distance, ...data });
          }
        });

        // Sort by closest first
        nearbyIssues.sort((a, b) => a.distance - b.distance);
        setJuryIssues(nearbyIssues);
        setLoading(false);

      } catch (err) {
        console.error("Jury Error:", err);
        setStatusMsg("❌ Failed to load location or jury data. Please allow GPS access.");
      }
    };

    fetchNearbyPendingIssues();
  }, [currentUser]);

  const handleVote = async (report, isApproved) => {
    try {
      const reportRef = doc(db, 'Reports', report.id);
      
      // We fetch the latest document right before voting to ensure accurate vote counts
      const snap = await getDoc(reportRef);
      const data = snap.data();
      const currentVotes = data.upvotes || 0;

      if (isApproved) {
        // If this is the 3rd Upvote -> IT IS RESOLVED!
        if (currentVotes >= 2) {
          await updateDoc(reportRef, {
            status: 'Resolved',
            upvotes: currentVotes + 1,
            votedBy: arrayUnion(currentUser.uid)
          });

          // Award 50 points to the Volunteer who fixed it!
          if (data.volunteerId) {
            const volunteerRef = doc(db, 'Users', data.volunteerId);
            await updateDoc(volunteerRef, { points: increment(50) });
          }
          alert("🎉 Issue Officially Resolved! The volunteer has been awarded 50 points.");
        } else {
          // Just add an upvote
          await updateDoc(reportRef, {
            upvotes: increment(1),
            votedBy: arrayUnion(currentUser.uid)
          });
          alert("✅ Vote recorded! Waiting for more community members to verify.");
        }

        // Gamification: Give the voter 5 points for participating in the jury
        const voterRef = doc(db, 'Users', currentUser.uid);
        await updateDoc(voterRef, { points: increment(5) });

      } else {
        // If someone rejects it, we revert the status back to 'In Progress' so the volunteer has to fix it properly
        await updateDoc(reportRef, {
          status: 'In Progress',
          afterPhoto: null, // Delete the bad photo
          aiVerificationReason: 'Rejected by Local Community Jury'
        });
        alert("❌ Issue Rejected. It has been sent back to the volunteer for proper fixing.");
      }

      // Remove it from the current UI immediately
      setJuryIssues((prev) => prev.filter((r) => r.id !== report.id));

    } catch (err) {
      console.error("Voting Error:", err);
      alert("Failed to submit vote.");
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#ff9800', fontSize: '18px' }}>{statusMsg}</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#2196F3', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        ⚖️ Community Jury
      </h2>
      <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px' }}>
        Review pending fixes within 5km of your location. Upvote valid repairs to officially resolve them.
      </p>

      {juryIssues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
          <h3 style={{ margin: 0, color: '#aaa' }}>No pending issues nearby!</h3>
          <p style={{ color: '#666' }}>Your neighborhood is fully caught up.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {juryIssues.map((report) => (
            <div key={report.id} style={{ backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', overflow: 'hidden' }}>
              
              <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '16px' }}>{report.title || report.category}</strong>
                <span style={{ color: '#4CAF50' }}>{Math.round(report.distance)}m away</span>
              </div>

              {/* Before & After Photo Comparison */}
              <div style={{ display: 'flex', width: '100%' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#ff4d4d' }}>BEFORE</div>
                  <img src={report.imageUrl} alt="Before" style={{ width: '100%', height: '250px', objectFit: 'cover', borderRight: '1px solid #333' }} />
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#4CAF50' }}>AFTER (Pending)</div>
                  <img src={report.afterPhoto} alt="After" style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
                </div>
              </div>

              {/* Voting Controls */}
              <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#aaa', fontSize: '14px' }}>
                  Votes: <strong style={{ color: '#fff' }}>{report.upvotes || 0} / 3</strong> needed
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => handleVote(report, false)} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    👎 Reject
                  </button>
                  <button onClick={() => handleVote(report, true)} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    👍 Approve Fix
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}