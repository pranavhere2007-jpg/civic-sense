// src/components/ReportForm.jsx
import { useState } from 'react';
import { db, auth } from '../firebase'; 
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore'; 
import { analyzeCivicIssue } from '../aiService'; 

export default function ReportForm() {
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('Community Action');

  // Replace these with your actual Cloudinary details from Steps 1 & 2
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dnnwlkgcl/image/upload";
  const CLOUDINARY_UPLOAD_PRESET = "civic-sense-app";

  const handleGetLocation = () => {
    setStatusMsg('Getting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setStatusMsg('Location acquired!');
      },
      (err) => {
        setStatusMsg('Error getting location. Please enable permissions.');
        console.error(err);
      }
    );
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image || !location) {
      setStatusMsg('Please provide both an image and your location.');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('AI is analyzing your image...');

    try {
      // 1. AI Verification Step
      const aiResult = await analyzeCivicIssue(image);
      if (!aiResult.isValid) {
        setStatusMsg('AI Error: This does not look like a valid civic issue. Please take a clearer photo.');
        setIsSubmitting(false);
        return; // Stop the process here!
      }

      setStatusMsg('AI Approved! Uploading image securely...');

      // 2. Upload to Cloudinary (Same as before)
      const formData = new FormData();
      formData.append("file", image);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const cloudinaryResponse = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
      const cloudinaryData = await cloudinaryResponse.json();
      const imageUrl = cloudinaryData.secure_url; 

      setStatusMsg('Saving to database and awarding points...');

      // 3. Save Data to Firestore (Same as before)
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

      // 4. GAMIFICATION: Give the user 10 points!
      const userRef = doc(db, 'Users', auth.currentUser.uid);
      await updateDoc(userRef, {
        points: increment(10) // Firebase automatically adds 10 to their current score
      });

      setStatusMsg('Success! You earned 10 points.');
      setImage(null);
      setDescription('');
      setLocation(null);
    } catch (err) {
      console.error(err);
      setStatusMsg('Error processing report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px' }}>
      <h3>Report an Issue</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => setImage(e.target.files[0])} 
          required 
        />
        <select 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '10px', fontSize: '16px', borderRadius: '4px' }}
        >
          <option value="Community Action">Community Action (Garbage, Clearing)</option>
          <option value="Infrastructure">Infrastructure (Potholes, Broken Pipes)</option>
        </select>
        <textarea 
          placeholder="Brief description (e.g., Pothole, Garbage dump)" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <button type="button" onClick={handleGetLocation}>
          {location ? 'Location Saved ✓' : 'Get My GPS Location'}
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
      {statusMsg && <p>{statusMsg}</p>}
    </div>
  );
}