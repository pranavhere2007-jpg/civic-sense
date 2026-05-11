// src/components/ReportForm.jsx
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function ReportForm() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const MAX_DAILY_REPORTS = 5; 
  const [reportsToday, setReportsToday] = useState(0);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [isCheckingLimit, setIsCheckingLimit] = useState(true);

  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    const checkDailyLimit = async () => {
      if (!auth.currentUser) {
        setIsCheckingLimit(false);
        return;
      }
      
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "Reports"),
          where("userId", "==", auth.currentUser.uid),
          where("createdAt", ">=", startOfToday)
        );

        const querySnapshot = await getDocs(q);
        const count = querySnapshot.size;
        
        setReportsToday(count);
        if (count >= MAX_DAILY_REPORTS) {
          setHasReachedLimit(true);
        }
      } catch (err) {
        console.error("Failed to check daily limits:", err);
      } finally {
        setIsCheckingLimit(false);
      }
    };

    checkDailyLimit();
  }, [auth.currentUser]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  // --- NEW: High Accuracy GPS Fetcher ---
  const getAccuratePosition = (minAccuracy = 40, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      let watchId;
      let bestPosition = null;

      const timer = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPosition) {
          resolve(bestPosition); 
        } else {
          reject(new Error("Timeout waiting for GPS lock. Please ensure you are outdoors."));
        }
      }, timeout);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          // Resolve immediately if we hit our accuracy target
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

  const handleImageSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setIsScanning(true);
    setAiReport(null);
    setStatusMsg("🤖 AI is analyzing the issue...");

    try {
      const base64Image = await fileToBase64(selectedFile);

      const prompt = `You are an expert civic triage AI. Analyze this image of a civic issue.
      You must evaluate the scale of the problem (1 to 10) and decide if a regular citizen can fix it, or if it requires heavy machinery, government permission, or professional NGOs.
      
      Respond ONLY with a raw JSON object containing these exact keys:
      - "title" (string: short, clear title)
      - "description" (string: detailed description of what is wrong)
      - "category" (string: e.g., 'Waste Management', 'Infrastructure', 'Vandalism', 'Public Safety', etc.)
      - "scaleScore" (number: 1 to 10, where 1 is a small piece of litter and 10 is a collapsed bridge)
      - "requiresNGO" (boolean: true IF scaleScore > 6 OR if it involves roads, powerlines, heavy dumping, etc. false if a citizen can safely clean/fix it)
      
      Do not use markdown formatting.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI failed to output valid JSON format.");
      
      const parsedReport = JSON.parse(jsonMatch[0]);
      setAiReport(parsedReport);
      setStatusMsg("");

    } catch (err) {
      console.error(err);
      setStatusMsg("❌ AI Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return alert("Please log in to report.");
    if (hasReachedLimit) return alert("You have reached your daily limit."); 
    
    setIsSubmitting(true);
    setStatusMsg("📍 Acquiring high-accuracy GPS lock...");

    try {
      // Use our new robust function instead of getCurrentPosition
      const position = await getAccuratePosition();

      setStatusMsg("☁️ Uploading Photo...");
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const cloudinaryRes = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const cloudinaryData = await cloudinaryRes.json();
      
      setStatusMsg("💾 Saving Report...");

      await addDoc(collection(db, "Reports"), {
        userId: auth.currentUser.uid,
        imageUrl: cloudinaryData.secure_url,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        title: aiReport.title,
        description: aiReport.description,
        category: aiReport.category,
        scaleScore: aiReport.scaleScore,
        requiresNGO: aiReport.requiresNGO,
        status: "Open",
        processPhotos: [],
        createdAt: serverTimestamp()
      });

      const newCount = reportsToday + 1;
      setReportsToday(newCount);
      if (newCount >= MAX_DAILY_REPORTS) setHasReachedLimit(true);

      setStatusMsg("✅ Report Submitted Successfully!");
      setTimeout(() => {
        setFile(null);
        setPreviewUrl(null);
        setAiReport(null);
        setStatusMsg('');
      }, 3000);

    } catch (err) {
      console.error(err);
      alert("Failed to submit: " + err.message);
      setStatusMsg("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', color: '#fff' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, color: '#2196F3' }}>Report an Issue</h2>
        {!isCheckingLimit && (
          <span style={{ fontSize: '12px', color: hasReachedLimit ? '#f44336' : '#aaa', backgroundColor: '#333', padding: '4px 8px', borderRadius: '4px' }}>
            {reportsToday} / {MAX_DAILY_REPORTS} Today
          </span>
        )}
      </div>

      {isCheckingLimit && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>Checking permissions...</div>
      )}

      {!isCheckingLimit && hasReachedLimit && (
        <div style={{ border: '1px solid #f44336', backgroundColor: '#f4433622', padding: '30px 20px', textAlign: 'center', borderRadius: '8px' }}>
          <h3 style={{ color: '#f44336', margin: '0 0 10px 0' }}>🛑 Daily Limit Reached</h3>
          <p style={{ color: '#ffcdd2', fontSize: '14px', margin: 0 }}>
            You have submitted {MAX_DAILY_REPORTS} reports today. To prevent platform spam, please wait until tomorrow to report new issues.
          </p>
        </div>
      )}
      
      {!isCheckingLimit && !hasReachedLimit && !file && (
        <div style={{ border: '2px dashed #444', padding: '40px 20px', textAlign: 'center', borderRadius: '8px' }}>
          <p style={{ color: '#aaa', marginBottom: '15px' }}>Take a photo of the issue. AI will automatically analyze and categorize it.</p>
          <input type="file" accept="image/*" capture="environment" id="cameraInput" onChange={handleImageSelect} style={{ display: 'none' }} />
          <label htmlFor="cameraInput" style={{ backgroundColor: '#2196F3', color: 'white', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            📸 Open Camera
          </label>
        </div>
      )}

      {previewUrl && (
        <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #444', marginBottom: '15px' }} />
      )}

      {isScanning && (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#2a2a2a', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 style={{ color: '#ff9800', margin: 0 }}>🤖 AI is Scanning...</h3>
          <p style={{ color: '#aaa', fontSize: '14px' }}>Evaluating scale and category...</p>
        </div>
      )}

      {aiReport && !isSubmitting && (
        <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px', border: '1px solid #444', marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>{aiReport.title}</h3>
          <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '14px' }}>{aiReport.description}</p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
            <span style={{ padding: '5px 10px', backgroundColor: '#333', borderRadius: '4px', fontSize: '12px' }}>📁 {aiReport.category}</span>
            <span style={{ padding: '5px 10px', backgroundColor: aiReport.scaleScore > 6 ? '#ff4d4d' : '#4CAF50', color: '#fff', borderRadius: '4px', fontSize: '12px' }}>
              Scale: {aiReport.scaleScore}/10
            </span>
          </div>

          {aiReport.requiresNGO && (
             <div style={{ backgroundColor: '#4a148c', padding: '10px', borderRadius: '6px', fontSize: '13px', border: '1px solid #7b1fa2', marginBottom: '15px', color: '#e1bee7' }}>
               🔒 <strong>High Scale Issue detected.</strong> This will be automatically dispatched to verified agencies and government bodies.
             </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setFile(null); setPreviewUrl(null); setAiReport(null); }} style={{ flex: 1, padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retake Photo</button>
            <button onClick={handleSubmit} style={{ flex: 2, padding: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Confirm & Submit</button>
          </div>
        </div>
      )}

      {statusMsg && !isScanning && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#333', color: '#fff', textAlign: 'center', borderRadius: '6px' }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}