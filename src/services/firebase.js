import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1W3zdGZXgRO0DN3vVQaEC1W0ujOgeGuU",
  authDomain: "bakalarka-e2eeb.firebaseapp.com",
  databaseURL: "https://bakalarka-e2eeb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bakalarka-e2eeb",
  storageBucket: "bakalarka-e2eeb.firebasestorage.app",
  messagingSenderId: "492452884639",
  appId: "1:492452884639:web:883292b81974873befb2aa",
};

export const DAILY_API_KEY = '834d4f11880f16065d4a60b4db718f69bc67a19377b013ddafaffacb1fe38350';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const database = getDatabase(app);
export const auth = getAuth(app);

export default app;