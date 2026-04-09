import React, { useState, useEffect } from 'react';
import { database } from '../services/firebase';
import { ref, onValue } from 'firebase/database';
import './RoomList.css';

function RoomList({ blockName, onBack, onRoomSelect }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Načítaj miestnosti pre daný blok z Firebase
    const roomsRef = ref(database, 'rooms');
    
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        //Filtruj miestnosti podľa bloku
        const roomsArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(room => room.block === blockName);
        
        setRooms(roomsArray);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [blockName]);

  if (loading) {
    return (
      <div className="room-list">
        <div className="room-header">
          <button className="back-button" onClick={onBack}>
            ← Späť na bloky
          </button>
          <h2>Načítavam miestnosti...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="room-list">
      <div className="room-header">
        <button className="back-button" onClick={onBack}>
          ← Späť na bloky
        </button>
        <h2>Miestnosti - Blok {blockName}</h2>
        <p className="floor-info">4. poschodie</p>
      </div>

      <div className="rooms-grid">
        {rooms.length === 0 ? (
          <p style={{color: 'white', textAlign: 'center'}}>
            Žiadne miestnosti v tomto bloku
          </p>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id} 
              className={`room-card ${room.hasActiveMeeting ? 'active-meeting' : 'available'}`}
            >
              <div className="room-number">
                <h3>{room.number}</h3>
                <span className={`status-badge ${room.hasActiveMeeting ? 'busy' : 'free'}`}>
                  {room.hasActiveMeeting ? '🔴 Prebieha meeting' : '🟢 Voľná'}
                </span>
              </div>

              <div className="room-info">
                <p>👥 {room.hasActiveMeeting ? `${room.participants}/${room.capacity}` : `0/${room.capacity}`} účastníkov</p>
                <p>📍 {room.floor}. poschodie</p>
              </div>

              <div className="room-actions">
                {room.hasActiveMeeting ? (
                  <button 
                    className="btn-join"
                    onClick={() => onRoomSelect(room)}
                  >
                    Pripojiť sa
                  </button>
                ) : (
                  <button 
                    className="btn-start"
                    onClick={() => onRoomSelect(room)}
                  >
                    Začať meeting
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RoomList;