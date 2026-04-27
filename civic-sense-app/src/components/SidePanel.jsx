// src/components/SidePanel.jsx
import { doc, updateDoc, deleteDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useState, useRef } from 'react';

export default function SidePanel({ report, onClose }) {
  const currentUser = auth.currentUser;
  
  // Pipeline States
  const [isDraftingPlan, setIsDraftingPlan] = useState(false);
  const [planText, setPlanText] = useState(report.planOfAction || '');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const processInputRef = useRef(null);
  const finalInputRef = useRef(null);

  // Cloudinary Config (Ensure YOUR_CLOUD_NAME is set!)
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload";
  const CLOUDINARY_UPLOAD_PRESET = "civic_reports";

  // 1. LAZY EXPIRATION: 24 Hours for Process Photo
  const isClaimExpired = () => {
    const hasNoProcessPhotos = !report.processPhotos || report.processPhotos.length === 0;
    if (report.status === 'Claimed' && report.claimedAt && hasNoProcessPhotos) {
      const claimedDate = report.claimedAt.toDate();
      const hoursDiff = (new Date() - claimedDate) / (1000 * 60 * 60);
      return hoursDiff > 24;
    }
    return false;
  };

  // 2. CLAIM ISSUE & SET INITIAL PLAN
  const handleClaimSubmit = async () => {
    if (planText.trim().length < 10) {
      setStatusMsg("Please provide a more detailed plan of action.");
      return;
    }
    setStatusMsg("Claiming issue...");
    await updateDoc(doc(db, "Reports", report.id), {
      status: 'Claimed',
      volunteerId: currentUser.uid,
      claimedAt: new Date(),
      planOfAction: planText,
      processPhotos: [] // Initialize array
    });
    setIsDraftingPlan(false);
    setStatusMsg("");
    onClose(); // Close to refresh map state
  };

  // 3. EDIT EXISTING PLAN
  const handleUpdatePlan = async () => {
    setStatusMsg("Updating plan...");
    await updateDoc(doc(db, "Reports", report.id), { planOfAction: planText });
    setIsDraftingPlan(false);
    setStatusMsg("");
  };

  // 4. UPLOAD HELPER
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url;
  };

  // 5. HANDLE PROCESS PHOTO UPLOAD (Max 5)
  const handleProcessPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setStatusMsg("Uploading process photo...");
    try {
      const url = await uploadImage(file);
      await updateDoc(doc(db, "Reports", report.id), {
        processPhotos: arrayUnion(url),
        status: 'In Progress' // Shifts from Claimed to In Progress
      });
      setStatusMsg("Process photo added!");
    } catch (err) {
      console.error(err);
      setStatusMsg("Upload failed.");
    } finally {
      setIsUploading(false);
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  // 6. HANDLE FINAL 'AFTER' PHOTO
  const handleFinalPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm("Submit final resolution? You cannot add more photos after this.")) return;
    
    setIsUploading(true);
    setStatusMsg("Uploading final photo...");
    try {
      const url = await uploadImage(file);
      await updateDoc(doc(db, "Reports", report.id), {
        afterPhoto: url,
        status: 'Pending Verification',
        resolvedAt: new Date()
      });
      alert("Resolution submitted! Waiting for verification.");
      onClose();
    } catch (err) {
      console.error(err);
      setStatusMsg("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  // Legacy Withdraw/Verify handlers
  const handleWithdraw = async () => {
    if (window.confirm("Are you sure you want to withdraw this report?")) {
      await deleteDoc(doc(db, "Reports", report.id));
      onClose();
    }
  };

  const handleVerify = async () => {
    if (window.confirm("Verify this issue is resolved? Volunteer gets 50 points.")) {
      await updateDoc(doc(db, "Reports", report.id), { status: 'Resolved' });
      await updateDoc(doc(db, "Users", report.volunteerId), { points: increment(50) });
      alert("Verified!");
      onClose();
    }
  };

  const displayStatus = isClaimExpired() ? 'Open (Claim Expired)' : report.status || 'Open';
  const processCount = report.processPhotos ? report.processPhotos.length : 0;
  const isMyTask = report.volunteerId === currentUser?.uid;

  return (
    <div style={{ padding: '25px', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', color: '#fff', maxHeight: '85vh', overflowY: 'auto' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#2196F3' }}>{report.category}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      </div>

      {/* ISSUE IMAGE & DETAILS */}
      <img src={report.imageUrl} alt="Civic Issue" style={{ width: '100%', borderRadius: '8px', marginBottom: '15px', border: '1px solid #444', objectFit: 'cover', maxHeight: '200px' }} />
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#aaa' }}>Status: </strong> 
          <span style={{ color: displayStatus.includes('Resolved') ? '#4CAF50' : '#ff9800', fontWeight: 'bold' }}>{displayStatus}</span>
        </p>
        <p style={{ margin: '0' }}><strong style={{ color: '#aaa' }}>Issue: </strong><br/>{report.description}</p>
      </div>

      {/* PLAN OF ACTION SECTION (Visible to everyone if it exists, editable by volunteer) */}
      {(report.planOfAction || isDraftingPlan) && (
        <div style={{ backgroundColor: '#1a233a', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #2196F3' }}>
          <strong style={{ color: '#2196F3' }}>Plan of Action:</strong>
          
          {isDraftingPlan ? (
            <div style={{ marginTop: '10px' }}>
              <textarea 
                value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="Describe how you will fix this..."
                style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', color: 'white', borderRadius: '6px', border: '1px solid #444', resize: 'vertical', boxSizing: 'border-box' }} rows="3"
              />
              <button onClick={report.status === 'Open' ? handleClaimSubmit : handleUpdatePlan} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {report.status === 'Open' ? 'Confirm Claim' : 'Save Update'}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '5px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.4' }}>{report.planOfAction}</p>
              {isMyTask && !report.afterPhoto && (
                <button onClick={() => setIsDraftingPlan(true)} style={{ background: 'none', border: '1px solid #444', color: '#ccc', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                  ✏️ Edit Plan
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* PROCESS PHOTOS DISPLAY */}
      {processCount > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ color: '#aaa' }}>Process Documentation ({processCount}/5):</strong>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '10px', paddingBottom: '5px' }}>
            {report.processPhotos.map((url, i) => (
              <img key={i} src={url} alt="Process" style={{ height: '80px', width: '80px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #444' }} />
            ))}
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

      <hr style={{ borderColor: '#333', margin: '20px 0' }} />

      {/* STATUS & ERROR ALERTS */}
      {statusMsg && <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#333', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '14px' }}>{statusMsg}</div>}

      {/* ACTION CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* AUTHOR ACTIONS */}
        {currentUser?.uid === report.userId && (report.status === 'Open' || report.status === 'Claimed') && (
          <button onClick={handleWithdraw} style={{ backgroundColor: '#ff4d4d', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Withdraw Report</button>
        )}
        {currentUser?.uid === report.userId && report.status === 'Pending Verification' && (
          <button onClick={handleVerify} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Verify Resolution ✓</button>
        )}

        {/* VOLUNTEER PIPELINE */}
        {report.category === 'Community Action' && (report.status === 'Open' || isClaimExpired()) && currentUser?.uid !== report.userId && !isDraftingPlan && (
          <button onClick={() => setIsDraftingPlan(true)} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Volunteer to Fix
          </button>
        )}

        {/* HIDDEN FILE INPUTS FOR MOBILE CAMERA */}
        <input type="file" accept="image/*" capture="environment" ref={processInputRef} onChange={handleProcessPhoto} style={{ display: 'none' }} />
        <input type="file" accept="image/*" capture="environment" ref={finalInputRef} onChange={handleFinalPhoto} style={{ display: 'none' }} />

        {isMyTask && !isDraftingPlan && !report.afterPhoto && (
          <>
            {processCount < 5 && (
              <button 
                onClick={() => processInputRef.current.click()} disabled={isUploading}
                style={{ backgroundColor: '#333', border: '1px solid #555', color: 'white', padding: '12px', borderRadius: '6px', cursor: isUploading ? 'wait' : 'pointer' }}
              >
                📸 Add Process Photo
              </button>
            )}
            
            {processCount >= 1 && (
              <button 
                onClick={() => finalInputRef.current.click()} disabled={isUploading}
                style={{ backgroundColor: '#2196F3', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: isUploading ? 'wait' : 'pointer', fontWeight: 'bold' }}
              >
                ✅ Submit Final 'After' Photo
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}