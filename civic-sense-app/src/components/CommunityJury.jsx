// src/components/CommunityJury.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function CommunityJury() {
  const [juryIssues, setJuryIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('📍 Acquiring high-accuracy GPS lock...');

  const currentUser = auth.currentUser;

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

  // --- NEW: High Accuracy GPS Fetcher ---
  const getAccuratePosition = (minAccuracy = 40, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      let watchId;
      let bestPosition = null;

      const timer = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPosition) resolve(bestPosition); 
        else reject(new Error("Timeout waiting for GPS lock."));
      }, timeout);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          if (position.coords.accuracy <= minAccuracy) {
            clearTimeout(timer);
            navigator.geolocation.clearWatch(watchId);
            resolve(position);
          }
        },
        (error) => {
          clearTimeout(timer);
          navigator.geolocation.clearWatch(watchId);
          reject(error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    });
  };

  useEffect(() => {
    const fetchNearbyPendingIssues = async () => {
      if (!currentUser) return;

      try {
        // Use our new robust function
        const position = await getAccuratePosition();
        
        setStatusMsg('📍 Locating nearby issues...');
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        const q = query(collection(db, 'Reports'), where('status', '==', 'Pending Verification'));
        const querySnapshot = await getDocs(q);
        
        const nearbyIssues = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          
          if (data.volunteerId === currentUser.uid) return; 
          if (data.votedBy && data.votedBy.includes(currentUser.uid)) return;

          const distance = calculateDistance(data.latitude, data.longitude, currentLat, currentLng);
          if (distance <= 5000) {
            nearbyIssues.push({ id: docSnap.id, distance, ...data });
          }
        });

        nearbyIssues.sort((a, b) => a.distance - b.distance);
        setJuryIssues(nearbyIssues);
        setLoading(false);

      } catch (err) {
        console.error("Jury Error:", err);
        setStatusMsg("❌ Failed to load high-accuracy location or jury data. Ensure GPS is enabled and you are outside.");
      }
    };

    fetchNearbyPendingIssues();
  }, [currentUser]);

  const handleVote = async (report, isApproved) => {
    try {
      const reportRef = doc(db, 'Reports', report.id);
      
      const snap = await getDoc(reportRef);
      const data = snap.data();
      const currentVotes = data.upvotes || 0;

      if (isApproved) {
        if (currentVotes >= 2) {
          await updateDoc(reportRef, {
            status: 'Resolved',
            upvotes: currentVotes + 1,
            votedBy: arrayUnion(currentUser.uid)
          });

          if (data.volunteerId) {
            const volunteerRef = doc(db, 'Users', data.volunteerId);
            await updateDoc(volunteerRef, { points: increment(50) });
          }
          alert("🎉 Issue Officially Resolved! The volunteer has been awarded 50 points.");
        } else {
          await updateDoc(reportRef, {
            upvotes: increment(1),
            votedBy: arrayUnion(currentUser.uid)
          });
          alert("✅ Vote recorded! Waiting for more community members to verify.");
        }

        const voterRef = doc(db, 'Users', currentUser.uid);
        await updateDoc(voterRef, { points: increment(5) });

      } else {
        await updateDoc(reportRef, {
          status: 'In Progress',
          afterPhoto: null, 
          aiVerificationReason: 'Rejected by Local Community Jury'
        });
        alert("❌ Issue Rejected. It has been sent back to the volunteer for proper fixing.");
      }

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