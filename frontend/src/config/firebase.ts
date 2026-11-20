import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBBn7EiLQ-5yF37jmg2iMeBqdAf8HsbVrI",
  authDomain: "stockpilot-5b992.firebaseapp.com",
  projectId: "stockpilot-5b992",
  storageBucket: "stockpilot-5b992.firebasestorage.app",
  messagingSenderId: "421414088597",
  appId: "1:421414088597:web:e776a00c469e0e8720109c",
  measurementId: "G-18BT8WWH1W"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
if (import.meta.env.DEV) {
  (window as any).__stockpilotAuth = auth;
}