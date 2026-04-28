// src/components/SidePanel.jsx
import { doc, updateDoc, deleteDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useState, useRef } from 'react';

export default function SidePanel({ report, onClose }) {
  const currentUser = auth.currentUser;
  
  const [isDraftingPlan, setIsDraftingPlan] = useState(false);
  const [planText, setPlanText] = useState(report.planOfAction || '');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const processInputRef = useRef(null);
  const finalInputRef = useRef(null);

  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  // --- 1. MATH: Haversine Distance Calculator ---
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

  // --- 2. UTILS: Image Converters ---
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const urlToBase64 = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return await fileToBase64(blob);
  };

  // --- 3. AI: Structured Outputs (JSON Schema) ---
  const runAIVerification = async (newFile, isFinal) => {
    setStatusMsg("🤖 AI is inspecting the images...");
    try {
      const originalBase64 = await urlToBase64(report.imageUrl);
      const newBase64 = await fileToBase64(newFile);

      // We give the AI entirely different rules depending on the photo type
      const prompt = isFinal
        ? `You are an anti-fraud inspector. Look at Image 1 (original issue) and Image 2 (final resolution).
           1. backgroundMatch: Do the physical environments (pavement, walls, background) match exactly?
           2. resolved: Has the issue in Image 1 been completely resolved/cleaned in Image 2?
           3. reason: Briefly explain your visual analysis.`
        : `You are an anti-fraud inspector. Look at Image 1 (original issue) and Image 2 (progress photo).
           1. backgroundMatch: Do the physical environments (pavement, walls, background) match exactly to prove the volunteer is at the correct location?
           2. reason: Briefly explain your visual analysis. Ignore resolution status entirely.`;

      // We dynamically change the required JSON schema
      const schemaProperties = isFinal 
        ? { backgroundMatch: { type: "BOOLEAN" }, resolved: { type: "BOOLEAN" }, reason: { type: "STRING" } }
        : { backgroundMatch: { type: "BOOLEAN" }, reason: { type: "STRING" } };
        
      const schemaRequired = isFinal 
        ? ["backgroundMatch", "resolved", "reason"] 
        : ["backgroundMatch", "reason"];

      // Using gemini-1.5-flash with strict JSON generation config
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: originalBase64 } },
              { inline_data: { mime_type: "image/jpeg", data: newBase64 } }
            ]
          }],
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: schemaProperties,
              required: schemaRequired
            }
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "API request failed");
      }

      // Because we used responseSchema, this is mathematically guaranteed to be purely JSON.
      const rawText = data.candidates[0].content.parts[0].text;
      const aiResult = JSON.parse(rawText);
      
      return aiResult;

    } catch (err) {
      console.error("AI Error:", err);
      alert(`RAW AI ERROR: ${err.message || err}`); 
      throw new Error("AI verification failed to process.");
    }
  };

  // --- 4. PIPELINE: GPS & AI Guard ---
  const verifyAndUpload = async (file, isFinal) => {
    setIsUploading(true);
    setStatusMsg("📍 Checking GPS coordinates...");

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const currentLat = position.coords.latitude;
      const currentLng = position.coords.longitude;
      
      const distance = calculateDistance(report.latitude, report.longitude, currentLat, currentLng);
      if (distance > 50) { 
        alert(`❌ Location Mismatch! You are ${Math.round(distance)} meters away. You must be at the exact location.`);
        setIsUploading(false);
        setStatusMsg("");
        return;
      }

      // Run AI Check
      const aiResult = await runAIVerification(file, isFinal);
      
      // RULE 1: Background MUST match for ALL photos (Process & Final)
      if (!aiResult.backgroundMatch) {
        alert(`❌ AI Rejected: Backgrounds do not match. \nReason: ${aiResult.reason}`);
        setIsUploading(false);
        setStatusMsg("");
        return;
      }

      // RULE 2: Resolution MUST match ONLY for Final photos
      if (isFinal && !aiResult.resolved) {
        alert(`❌ AI Rejected: Issue does not appear resolved. \nReason: ${aiResult.reason}`);
        setIsUploading(false);
        setStatusMsg("");
        return;
      }

      setStatusMsg("✅ Verification Passed! Uploading securely...");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const cloudinaryRes = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const cloudinaryData = await cloudinaryRes.json();
      const secureUrl = cloudinaryData.secure_url;

      if (isFinal) {
        await updateDoc(doc(db, "Reports", report.id), {
          afterPhoto: secureUrl,
          status: 'Pending Verification',
          resolvedAt: new Date(),
          aiVerificationReason: aiResult.reason 
        });
        alert("Resolution accepted by AI and submitted! Waiting for final community verification.");
        onClose();
      } else {
        await updateDoc(doc(db, "Reports", report.id), {
          processPhotos: arrayUnion(secureUrl),
          status: 'In Progress'
        });
        setStatusMsg("Process photo accepted and added!");
        setTimeout(() => setStatusMsg(""), 3000);
      }

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to verify location. Ensure permissions are granted.");
      setStatusMsg("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessPhoto = (e) => e.target.files[0] && verifyAndUpload(e.target.files[0], false);
  const handleFinalPhoto = (e) => {
    if (e.target.files[0] && window.confirm("Submit final resolution? AI will verify this action.")) {
      verifyAndUpload(e.target.files[0], true);
    }
  };

  const handleClaimSubmit = async () => {
    if (planText.trim().length < 10) return setStatusMsg("Please provide a detailed plan.");
    setStatusMsg("Claiming issue...");
    await updateDoc(doc(db, "Reports", report.id), { status: 'Claimed', volunteerId: currentUser?.uid, claimedAt: new Date(), planOfAction: planText, processPhotos: [] });
    setIsDraftingPlan(false); setStatusMsg(""); onClose();
  };

  const isMyTask = report.volunteerId === currentUser?.uid;
  const processCount = report.processPhotos ? report.processPhotos.length : 0;

  return (
    <div style={{ padding: '25px', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', color: '#fff', maxHeight: '85vh', overflowY: 'auto' }}>
      
      {/* HEADER & IMAGE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#2196F3' }}>{report.category}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      </div>
      <img src={report.imageUrl} alt="Issue" style={{ width: '100%', borderRadius: '8px', marginBottom: '15px', border: '1px solid #444', maxHeight: '200px', objectFit: 'cover' }} />
      
      {/* STATUS */}
      <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0' }}><strong style={{ color: '#aaa' }}>Status: </strong> <span style={{ color: '#ff9800', fontWeight: 'bold' }}>{report.status}</span></p>
        <p style={{ margin: '0' }}><strong style={{ color: '#aaa' }}>Issue: </strong><br/>{report.description}</p>
      </div>

      {/* PLAN OF ACTION */}
      {(report.planOfAction || isDraftingPlan) && (
        <div style={{ backgroundColor: '#1a233a', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #2196F3' }}>
          <strong style={{ color: '#2196F3' }}>Plan of Action:</strong>
          {isDraftingPlan ? (
            <div style={{ marginTop: '10px' }}>
              <textarea value={planText} onChange={(e) => setPlanText(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: 'white', borderRadius: '6px', border: '1px solid #444', resize: 'vertical' }} rows="3" />
              <button onClick={handleClaimSubmit} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Claim</button>
            </div>
          ) : (
            <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>{report.planOfAction}</p>
          )}
        </div>
      )}

      {/* PROCESS & FINAL PHOTOS */}
      {processCount > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#aaa' }}>Process Photos:</strong>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '10px' }}>
            {report.processPhotos.map((url, i) => <img key={i} src={url} alt="Process" style={{ height: '80px', width: '80px', borderRadius: '6px', objectFit: 'cover' }} />)}
          </div>
        </div>
      )}

      {/* AFTER PHOTO DISPLAY */}
      {report.afterPhoto && (
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#4CAF50' }}>Resolution Proof:</strong>
          <img src={report.afterPhoto} alt="Resolved" style={{ width: '100%', borderRadius: '8px', marginTop: '10px', border: '2px solid #4CAF50' }} />
        </div>
      )}

      {statusMsg && <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#333', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '14px' }}>{statusMsg}</div>}

      {/* CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {report.category === 'Community Action' && report.status === 'Open' && currentUser?.uid !== report.userId && !isDraftingPlan && (
          <button onClick={() => setIsDraftingPlan(true)} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Volunteer to Fix</button>
        )}

        <input type="file" accept="image/*" capture="environment" ref={processInputRef} onChange={handleProcessPhoto} style={{ display: 'none' }} />
        <input type="file" accept="image/*" capture="environment" ref={finalInputRef} onChange={handleFinalPhoto} style={{ display: 'none' }} />

        {isMyTask && !isDraftingPlan && !report.afterPhoto && (
          <>
            {processCount < 5 && <button onClick={() => processInputRef.current.click()} disabled={isUploading} style={{ backgroundColor: '#333', border: '1px solid #555', color: 'white', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>📸 Add Process Photo</button>}
            {processCount >= 1 && <button onClick={() => finalInputRef.current.click()} disabled={isUploading} style={{ backgroundColor: '#2196F3', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✅ Final AI Verification</button>}
          </>
        )}
      </div>
    </div>
  );
}