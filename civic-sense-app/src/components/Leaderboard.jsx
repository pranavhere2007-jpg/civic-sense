// src/components/Leaderboard.jsx
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'Users'), orderBy('points', 'desc'), limit(10)); // Bumped to top 10!
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      setTopUsers(users);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', color: '#fff', border: '1px solid #333', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px', marginTop: 0, textAlign: 'center', color: '#ff9800' }}>
        🏆 Top Civic Volunteers
      </h2>
      
      {topUsers.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center' }}>No volunteers on the board yet. Be the first!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {topUsers
          .filter((user) => user.email !== "admin@college.edu")
          .map((user, index) => {
            // Safety net just in case email is missing
            const displayName = user.email ? user.email.split('@')[0] : 'Anonymous Citizen';
            
            // Give top 3 special colors
            const rankColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#888';

            return (
              <li key={user.id} style={{ padding: '15px 10px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: index % 2 === 0 ? '#2a2a2a' : 'transparent', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ color: rankColor, fontWeight: 'bold', fontSize: '18px', minWidth: '30px' }}>#{index + 1}</span>
                  <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{displayName}</span>
                </div>
                <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '16px' }}>{user.points || 0} pts</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}