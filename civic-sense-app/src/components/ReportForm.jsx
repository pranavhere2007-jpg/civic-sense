// src/components/ReportForm.jsx
import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase'; 

export default function ReportForm() {
  const [imageBlob, setImageBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Community Action');
  const [location, setLocation] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Camera specific states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); 

  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload";
  const CLOUDINARY_UPLOAD_PRESET = "civic_reports";

  const startCamera = async () => {
    setStatusMsg('');
    setExifError('');
    setIsStartingCamera(true);
    
    try {
      // FIX: Using "ideal" allows laptops to fall back to their default webcam
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: "environment" } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      // More descriptive error handling
      if (err.name === 'NotAllowedError') {
        setStatusMsg('Camera access denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError') {
        setStatusMsg('No camera found on this device.');
      } else {
        setStatusMsg('Error accessing camera. Please try reloading the page.');
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const capturePhoto = () => {
    setStatusMsg('Capturing photo and GPS location...');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video is ready before capturing
    if (!video || video.videoWidth === 0) {
        setStatusMsg('Camera not ready. Please wait a second and try again.');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      setImageBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      stopCamera(); 
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setStatusMsg('📍 Live photo and secure GPS location captured!');
        },
        (err) => {
          console.error(err);
          // Block submission if GPS fails
          setImageBlob(null);
          setPreviewUrl(null);
          setStatusMsg('Photo taken, but GPS failed. Location permissions are REQUIRED to submit.');
        },
        { enableHighAccuracy: true, timeout: 10000 } 
      );
    }, 'image/jpeg', 0.8);
  };

  const handleRetake = () => {
    setImageBlob(null);
    setPreviewUrl(null);
    setLocation(null);
    setStatusMsg('');
    startCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Strict Guard: Prevent submission if any data is missing
    if (!imageBlob || !location) {
      setStatusMsg('Cannot submit: Valid photo and GPS location are strictly required.');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('Uploading securely...');

    try {
      const formData = new FormData();
      formData.append("file", imageBlob, "live-capture.jpg"); 
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const cloudinaryResponse = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const cloudinaryData = await cloudinaryResponse.json();
      const imageUrl = cloudinaryData.secure_url; 

      setStatusMsg('Saving to database...');

      await addDoc(collection(db, 'Reports'), {
        userId: auth.currentUser.uid,
        imageUrl: imageUrl,
        description: description,
        category: category,
        latitude: location.lat,
        longitude: location.lng,
        status: 'Open',
        createdAt: serverTimestamp()
      });

      const userRef = doc(db, 'Users', auth.currentUser.uid);
      await updateDoc(userRef, { points: increment(10) });

      setStatusMsg('Success! You earned 10 points.');
      
      setTimeout(() => {
        setImageBlob(null);
        setPreviewUrl(null);
        setLocation(null);
        setDescription('');
        setStatusMsg('');
      }, 2000);

    } catch (err) {
      console.error(err);
      setStatusMsg('Error processing report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Condition to check if the form is fully ready to submit
  const isReadyToSubmit = imageBlob && location && !isSubmitting;

  // Helper to clear undefined errors from EXIF code removal
  const [exifError, setExifError] = useState('');

  return (
    <div style={{ padding: '25px', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        Report an Issue (Live Capture)
      </h3>

      {/* STAGE 1: Activate Camera Button */}
      {!isCameraActive && !previewUrl && (
        <button 
          onClick={startCamera}
          disabled={isStartingCamera}
          style={{ width: '100%', padding: '20px', backgroundColor: '#2a2a2a', border: '2px dashed #4CAF50', color: '#4CAF50', borderRadius: '8px', cursor: isStartingCamera ? 'wait' : 'pointer', fontSize: '18px', fontWeight: 'bold' }}
        >
          {isStartingCamera ? 'Starting Camera...' : '📷 Open Camera Viewfinder'}
        </button>
      )}

      {/* Warning/Status Messages for Camera/GPS */}
      {statusMsg && !previewUrl && (
         <div style={{ padding: '10px', marginTop: '15px', backgroundColor: '#3a1e1e', borderLeft: '4px solid #ff4d4d', color: '#ff4d4d', fontSize: '14px', borderRadius: '4px' }}>
           {statusMsg}
         </div>
      )}

      {/* STAGE 2: Live Video Viewfinder */}
      <div style={{ display: isCameraActive ? 'block' : 'none', position: 'relative' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', borderRadius: '8px', border: '1px solid #444', backgroundColor: 'black', minHeight: '200px' }}
        />
        <button 
          onClick={capturePhoto}
          style={{ width: '100%', padding: '15px', backgroundColor: '#e91e63', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' }}
        >
          📸 Capture Photo
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* STAGE 3: Review & Submit Form */}
      {previewUrl && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
          <div style={{ position: 'relative' }}>
            <img src={previewUrl} alt="Preview" style={{ width: '100%', borderRadius: '8px', border: '1px solid #444' }} />
            <button type="button" onClick={handleRetake} style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', border: '1px solid #fff', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>
              🔄 Retake
            </button>
          </div>

          {statusMsg && (
            <div style={{ padding: '10px', backgroundColor: location ? '#1e3a1e' : '#3a1e1e', borderLeft: location ? '4px solid #4CAF50' : '4px solid #ff4d4d', color: location ? '#4CAF50' : '#ff4d4d', fontSize: '14px', borderRadius: '4px' }}>
              {statusMsg}
            </div>
          )}

          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '12px', backgroundColor: '#2a2a2a', color: 'white', border: '1px solid #444', borderRadius: '6px' }}>
            <option value="Community Action">Community Action (Garbage, Clearing)</option>
            <option value="Infrastructure">Infrastructure (Potholes, Broken Pipes)</option>
          </select>

          <textarea 
            placeholder="Brief description (e.g., Pothole on Main St)" 
            value={description} onChange={(e) => setDescription(e.target.value)} required rows="4"
            style={{ padding: '12px', backgroundColor: '#2a2a2a', color: 'white', border: '1px solid #444', borderRadius: '6px', resize: 'vertical' }}
          />
          
          <button 
            type="submit" disabled={!isReadyToSubmit}
            style={{ 
              padding: '14px', 
              backgroundColor: isReadyToSubmit ? '#2196F3' : '#555', 
              color: 'white', border: 'none', borderRadius: '6px', 
              cursor: isReadyToSubmit ? 'pointer' : 'not-allowed', 
              fontWeight: 'bold',
              opacity: isReadyToSubmit ? 1 : 0.6
            }}
          >
            {isSubmitting ? 'Uploading...' : 'Confirm & Submit Report'}
          </button>
        </form>
      )}
    </div>
  );
}