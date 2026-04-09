import React, { useState } from 'react';
import { auth, database } from '../services/firebase';
import { signInAnonymously } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      alert('Zadaj svoje meno!');
      return;
    }

    setLoading(true);
    
    try {
      // Anonymné prihlásenie
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;
      
      // Ulož používateľa do databázy s menom
      await set(ref(database, `users/${userId}`), {
        uid: userId,
        displayName: username,
        createdAt: Date.now()
      });
      
      // Nastav displayName lokálne
      userCredential.user.displayName = username;
      
      onLogin(userCredential.user);
    } catch (error) {
      console.error('Chyba pri prihlásení:', error);
      alert('Nepodarilo sa prihlásiť');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🎥 Videokonferenčné miestnosti</h1>
        <p>Zadaj svoje meno pre vstup</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Tvoje meno"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-input"
            disabled={loading}
          />
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Prihlasovanie...' : 'Vstúpiť'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;