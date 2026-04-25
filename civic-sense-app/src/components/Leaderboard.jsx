// src/components/Leaderboard.jsx
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    // Query the Users collection, sort by points (highest first), and grab the top 5
    const q = query(collection(db, 'Users'), orderBy('points', 'desc'), limit(5));
    
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
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}>
      <h3>Top Civic Volunteers</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {topUsers.map((user, index) => (
          <li key={user.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>#{index + 1}</strong> {user.email.split('@')[0]}</span>
            <span style={{ color: 'green', fontWeight: 'bold' }}>{user.points} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
}