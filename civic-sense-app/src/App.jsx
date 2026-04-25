// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Import Components
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener fires automatically whenever a user logs in or logs out
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Stop the loading screen once we know the state
    });

    // Cleanup the listener if the component unmounts
    return () => unsubscribe();
  }, []);

  // Show a simple loading state while Firebase checks the user's session
  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>Loading CivicSense...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* The Root Route: If logged in, go to Dashboard. If not, show Login/Signup */}
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" /> : <Auth />} 
        />
        
        {/* The Dashboard Route: Protected. If someone tries to type /dashboard in the URL without logging in, kick them back to / */}
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;