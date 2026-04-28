// src/components/NGOSignUp.jsx
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function NGOSignUp({ onCancel }) {
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [darpanId, setDarpanId] = useState('');
  const [description, setDescription] = useState('');
  
  const [regCertFile, setRegCertFile] = useState(null);
  const [panFile, setPanFile] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;

  // --- HELPER: Upload File to Cloudinary ---
  const uploadDocument = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    const data = await res.json();
    return data.secure_url;
  };

  // --- THE REAL REGISTRATION FLOW ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!orgName || !email || !password || !darpanId || !regCertFile || !panFile) {
      return setError('Please fill in all fields and upload both required documents.');
    }

    setLoading(true);
    setError('');

    try {
      setStatusMsg('Uploading official documents...');
      const regCertUrl = await uploadDocument(regCertFile);
      const panUrl = await uploadDocument(panFile);

      setStatusMsg('Creating secure account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'Users', user.uid), {
        email: user.email,
        orgName: orgName,
        darpanId: darpanId,
        description: description,
        role: 'organization',
        verificationStatus: 'Pending', // Requires Admin/AI approval
        documents: {
          registrationCertificate: regCertUrl,
          panCard: panUrl
        },
        points: 0,
        createdAt: serverTimestamp()
      });

      alert('✅ Registration Submitted! Your documents are pending verification.');
      // Note: In production, redirect them to a "Pending" screen here.

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- THE DEMO/PRESENTATION BYPASS ---
  const handleFakeDemoAuth = async () => {
    setLoading(true);
    setError('');
    setStatusMsg('Creating pre-verified Demo NGO...');

    try {
      const randomNum = Math.floor(Math.random() * 10000);
      const demoEmail = `demo.ngo${randomNum}@civicsense.org`;
      const demoPass = 'demo123456';

      const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
      
      await setDoc(doc(db, 'Users', userCredential.user.uid), {
        email: demoEmail,
        orgName: 'GovTech Demo Agency',
        darpanId: 'DEMO-DARPAN-999',
        description: 'Auto-verified account for presentation purposes.',
        role: 'organization',
        verificationStatus: 'Approved', // Bypasses the pending state!
        points: 0,
        createdAt: serverTimestamp()
      });

      alert(`✅ Demo Agency Created & Auto-Approved!\nEmail: ${demoEmail}\nPassword: ${demoPass}`);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '30px', backgroundColor: '#1e1e1e', borderRadius: '12px', border: '1px solid #333', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#9c27b0', margin: '0 0 10px 0' }}>🏢 Verified Agency Portal</h2>
        <p style={{ color: '#aaa', margin: 0, fontSize: '14px' }}>
          Register your NGO to unlock access to high-scale infrastructure dispatches.
        </p>
      </div>

      {/* DEMO BUTTON FOR PRESENTATION */}
      <div style={{ backgroundColor: '#4a148c', padding: '15px', borderRadius: '8px', marginBottom: '25px', textAlign: 'center', border: '1px dashed #e1bee7' }}>
        <strong style={{ color: '#e1bee7', display: 'block', marginBottom: '5px' }}>Presentation Mode</strong>
        <button onClick={handleFakeDemoAuth} disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#e1bee7', color: '#4a148c', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          ⚡ Generate Auto-Verified NGO
        </button>
      </div>

      {error && <div style={{ backgroundColor: '#ff4d4d22', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
      {statusMsg && <div style={{ backgroundColor: '#2196F322', border: '1px solid #2196F3', color: '#2196F3', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{statusMsg}</div>}

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>Organization Name *</label>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>NGO Darpan Unique ID *</label>
          <input type="text" value={darpanId} onChange={(e) => setDarpanId(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} placeholder="e.g., UP/2021/0123456" />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>Certificate of Registration *</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setRegCertFile(e.target.files[0])} style={{ width: '100%', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>Organization PAN Card *</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setPanFile(e.target.files[0])} style={{ width: '100%', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>Work Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
        </div>

        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '5px', fontSize: '14px' }}>Password *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', backgroundColor: '#2a2a2a', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '14px', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
          Submit for Verification
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel} style={{ padding: '10px', backgroundColor: 'transparent', color: '#888', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Cancel and return to Citizen Login
          </button>
        )}
      </form>
    </div>
  );
}