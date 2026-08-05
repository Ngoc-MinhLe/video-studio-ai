import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Cấu hình mẫu Firebase (Người dùng có thể bổ sung API Key cá nhân sau)
const firebaseConfig = {
  apiKey: "AIzaSyDemoConfigKeyForFutureSetup12345",
  authDomain: "studio-video-app.firebaseapp.com",
  projectId: "studio-video-app",
  storageBucket: "studio-video-app.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export default app;
