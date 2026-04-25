// src/components/Auth.jsx
import { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Importing from the file we made earlier

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuthentication = async (e) => {
    e.preventDefault();
    setError(''); // Clear any previous errors

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in successfully!");
        
      } else {
        // --- SIGNUP FLOW ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create a user profile in Firestore to track their points
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          points: 0,
          createdAt: new Date()
        });
        
        console.log("Account created and database profile initialized!");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>{isLogin ? 'Log In to CivicSense' : 'Join CivicSense'}</h2>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <form onSubmit={handleAuthentication} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="Email address" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px', fontSize: '16px' }}
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px', fontSize: '16px' }}
        />
        <button type="submit" style={{ padding: '10px', fontSize: '16px', cursor: 'pointer' }}>
          {isLogin ? 'Log In' : 'Sign Up'}
        </button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button 
          onClick={() => setIsLogin(!isLogin)}
          style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isLogin ? 'Sign Up' : 'Log In'}
        </button>
      </p>
    </div>
  );
}