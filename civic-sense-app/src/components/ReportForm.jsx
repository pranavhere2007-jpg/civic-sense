// src/components/ReportForm.jsx
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function ReportForm() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

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
      
      // The Unbreakable Regex JSON Extractor
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
    
    setIsSubmitting(true);
    setStatusMsg("📍 Fetching GPS Location...");

    try {
      // 1. Get Location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      setStatusMsg("☁️ Uploading Photo...");
      
      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const cloudinaryRes = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const cloudinaryData = await cloudinaryRes.json();
      
      setStatusMsg("💾 Saving Report...");

      // 3. Save to Firebase
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

      // Award 10 points to the user for reporting!
      // (Assuming you have logic elsewhere or want to add it, but standard report is done)

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
      <h2 style={{ margin: '0 0 15px 0', color: '#2196F3' }}>Report an Issue</h2>
      
      {!file && (
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