import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBRz-WubZ9tsp_bfaiGpu5Iz_kOgC68vbQ",
  authDomain: "lengocminh-74a9e.firebaseapp.com",
  projectId: "lengocminh-74a9e",
  storageBucket: "lengocminh-74a9e.firebasestorage.app",
  messagingSenderId: "528797008471",
  appId: "1:528797008471:web:d2c169aa256980a7645912",
  measurementId: "G-BSG9SQDGJR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
