import React, { useState, useEffect } from 'react';
import { auth, database } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import './App.css';
import Login from './Components/Login';
import BlockList from './Components/BlockList';
import RoomList from './Components/RoomList';
import RoomDetail from './Components/RoomDetail';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    // Sleduj prihlásenie
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Načítaj údaje používateľa z databázy
        const userRef = ref(database, `users/${currentUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          setUserData(data);
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedBlock(null);
      setSelectedRoom(null);
    } catch (error) {
      console.error('Chyba pri odhlásení:', error);
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          color: 'white',
          fontSize: '24px'
        }}>
          Načítavam...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="App">
      <header>
        <div className="header-left">
          <span className="app-icon">🎥</span>
        </div>
        <h1>Videokonferenčné miestnosti</h1>
        <div className="user-info">
          <span>👤 {userData?.displayName || 'Používateľ'}</span>
          <button onClick={handleLogout} className="logout-btn">
            Odhlásiť sa
          </button>
        </div>
      </header>
      
      <main>
        {selectedRoom ? (
          <RoomDetail 
            room={selectedRoom}
            blockName={selectedBlock}
            currentUser={user}
            userData={userData}
            onBack={() => setSelectedRoom(null)}
          />
        ) : selectedBlock ? (
          <RoomList 
            blockName={selectedBlock} 
            onBack={() => setSelectedBlock(null)}
            onRoomSelect={setSelectedRoom}
          />
        ) : (
          <BlockList onBlockSelect={setSelectedBlock} />
        )}
      </main>
    </div>
  );
}

export default App;