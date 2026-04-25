// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALErMv7xPa-VFWhoqEMJF_GejAkINt8hc",
  authDomain: "civic-sense-app-f07f2.firebaseapp.com",
  projectId: "civic-sense-app-f07f2",
  storageBucket: "civic-sense-app-f07f2.firebasestorage.app",
  messagingSenderId: "316712525778",
  appId: "1:316712525778:web:c26494822c82a4b661320b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Authentication and Database so your React components can use them
export const auth = getAuth(app);
export const db = getFirestore(app);