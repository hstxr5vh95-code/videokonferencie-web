import React, { useState, useEffect } from 'react';
import { database } from '../services/firebase';
import { ref, onValue, update, set, remove, onDisconnect } from 'firebase/database';
import MeetingRoom from './MeetingRoom';
import './RoomDetail.css';

function RoomDetail({ room, blockName, currentUser, userData, onBack }) {
  const [roomData, setRoomData] = useState(room);
  const [isHost, setIsHost] = useState(false);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [showMeeting, setShowMeeting] = useState(false);

  // Real-time načítanie miestnosti
  useEffect(() => {
    const roomRef = ref(database, `rooms/${room.number}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        const amIHost = data.hostId === currentUser.uid && data.hasActiveMeeting;
        setIsHost(amIHost);
      }
    });
    return () => unsubscribe();
  }, [room.number, currentUser.uid]);

  // Real-time načítanie čakajúcich používateľov
  useEffect(() => {
    const waitingRef = ref(database, `waiting/${room.number}`);
    const unsubscribe = onValue(waitingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const waitingArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setWaitingUsers(waitingArray);
      } else {
        setWaitingUsers([]);
      }
    });
    return () => unsubscribe();
  }, [room.number]);

  // Keď ťa host prijme - sleduj či si bol prijatý
  useEffect(() => {
    if (!isWaiting) return;

    const admittedRef = ref(database, `admitted/${room.number}/${currentUser.uid}`);
    const unsubscribe = onValue(admittedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // Bol si prijatý!
        setIsWaiting(false);
        setIsInMeeting(true);
        setShowMeeting(true);
        // Odstráň zo zoznamu prijatých
        remove(admittedRef);
        // Zvýš počet účastníkov
        update(ref(database, `rooms/${room.number}`), {
          participants: (roomData.participants || 0) + 1
        });
      }
    });
    return () => unsubscribe();
  }, [isWaiting, currentUser.uid, room.number, roomData.participants]);

  const handleStartMeeting = async () => {
    try {
      await update(ref(database, `rooms/${room.number}`), {
        hasActiveMeeting: true,
        participants: 1,
        hostId: currentUser.uid,
        hostName: userData?.displayName || 'Host'
      });

      // Ak host zavrie kartu/aplikáciu bez kliknutia na "Opustiť", meeting sa korektne ukončí.
      await onDisconnect(ref(database, `rooms/${room.number}`)).update({
        hasActiveMeeting: false,
        participants: 0,
        hostId: null,
        hostName: null
      });
      await onDisconnect(ref(database, `waiting/${room.number}`)).remove();
      await onDisconnect(ref(database, `admitted/${room.number}`)).remove();
      await onDisconnect(ref(database, `webrtc/${room.number}`)).remove();

      setIsHost(true);
      setIsInMeeting(true);
      setShowMeeting(true);
    } catch (error) {
      console.error('Chyba:', error);
      alert('Nepodarilo sa spustiť meeting');
    }
  };

  const handleRequestJoin = async () => {
    try {
      // Pridaj sa do waiting listu
      await set(ref(database, `waiting/${room.number}/${currentUser.uid}`), {
        uid: currentUser.uid,
        displayName: userData?.displayName || 'Používateľ',
        requestedAt: Date.now()
      });
      await onDisconnect(ref(database, `waiting/${room.number}/${currentUser.uid}`)).remove();
      setIsWaiting(true);
      alert('Žiadosť odoslaná! Čakáš na schválenie hostom.');
    } catch (error) {
      console.error('Chyba:', error);
      alert('Nepodarilo sa odoslať žiadosť');
    }
  };

  const handleCancelWaiting = async () => {
    try {
      await remove(ref(database, `waiting/${room.number}/${currentUser.uid}`));
      setIsWaiting(false);
    } catch (error) {
      console.error('Chyba:', error);
    }
  };

  const handleAdmitUser = async (userId) => {
    try {
      // Označ používateľa ako prijatého
      await set(ref(database, `admitted/${room.number}/${userId}`), true);
      // Odstráň z waiting listu
      await remove(ref(database, `waiting/${room.number}/${userId}`));
    } catch (error) {
      console.error('Chyba:', error);
    }
  };

  const handleRejectUser = async (userId) => {
    try {
      await remove(ref(database, `waiting/${room.number}/${userId}`));
    } catch (error) {
      console.error('Chyba:', error);
    }
  };

  const handleLeaveMeeting = async () => {
    setShowMeeting(false);
    setIsInMeeting(false);
    setIsHost(false);

    if (isHost) {
      await update(ref(database, `rooms/${room.number}`), {
        hasActiveMeeting: false,
        participants: 0,
        hostId: null,
        hostName: null
      });
      // Vymaž všetkých čakajúcich
      await remove(ref(database, `waiting/${room.number}`));
    } else {
      const currentParticipants = roomData.participants || 0;
      if (currentParticipants > 0) {
        await update(ref(database, `rooms/${room.number}`), {
          participants: currentParticipants - 1
        });
      }
      await remove(ref(database, `waiting/${room.number}/${currentUser.uid}`));
      await remove(ref(database, `admitted/${room.number}/${currentUser.uid}`));
    }
  };

  // Zobraz Jitsi meeting cez celú obrazovku
  if (showMeeting) {
    return (
      <MeetingRoom
        roomNumber={room.number}
        userData={userData}
        currentUser={currentUser}
        isHost={isHost}
        waitingUsers={waitingUsers}
        onAdmitUser={handleAdmitUser}
        onRejectUser={handleRejectUser}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  return (
    <div className="room-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ← Späť na miestnosti
        </button>
        <div className="room-title">
          <h2>Miestnosť {roomData.number}</h2>
          <span className={`status-indicator ${roomData.hasActiveMeeting ? 'active' : 'inactive'}`}>
            {roomData.hasActiveMeeting ? '🔴 Meeting prebieha' : '🟢 Voľná miestnosť'}
          </span>
        </div>
      </div>

      <div className="detail-content">
        {/* Informácie o miestnosti */}
        <div className="info-card">
          <h3>📋 Informácie</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Blok:</span>
              <span className="value">Blok {blockName}</span>
            </div>
            <div className="info-item">
              <span className="label">Poschodie:</span>
              <span className="value">{roomData.floor}. poschodie</span>
            </div>
            <div className="info-item">
              <span className="label">Kapacita:</span>
              <span className="value">{roomData.capacity} osôb</span>
            </div>
            <div className="info-item">
              <span className="label">Účastníci:</span>
              <span className="value">{roomData.participants}/{roomData.capacity}</span>
            </div>
            {roomData.hostName && (
              <div className="info-item">
                <span className="label">Host:</span>
                <span className="value">👑 {roomData.hostName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ovládanie */}
        <div className="video-section">
          <div className="video-placeholder">
            {roomData.hasActiveMeeting ? (
              <div className="video-active">
                <div className="video-screen">
                  📹
                  <p>Meeting prebieha</p>
                  <p className="participant-count">👥 {roomData.participants} účastníkov</p>
                  {roomData.hostName && (
                    <p style={{color: '#ffd700', marginTop: '10px'}}>
                      👑 Host: {roomData.hostName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="video-inactive">
                <p>💤</p>
                <p>Žiadny aktívny meeting</p>
                <p>Klikni na "Začať meeting" pre spustenie</p>
              </div>
            )}
          </div>

          <div className="controls">
            {!roomData.hasActiveMeeting ? (
              <button className="btn-primary" onClick={handleStartMeeting}>
                🎬 Začať meeting
              </button>
            ) : isWaiting ? (
              <div className="waiting-status">
                <p>⏳ Čakáš na schválenie...</p>
                <button className="btn-danger" onClick={handleCancelWaiting}>
                  ❌ Zrušiť žiadosť
                </button>
              </div>
            ) : !isInMeeting ? (
              <button className="btn-primary" onClick={handleRequestJoin}>
                🚪 Požiadať o vstup
              </button>
            ) : null}
          </div>
        </div>

        {/* Admin panel - len pre hosta */}
        {isHost && waitingUsers.length > 0 && (
          <div className="admin-panel">
            <h3>👨‍💼 Čakajú na vstup ({waitingUsers.length})</h3>
            <div className="waiting-list">
              {waitingUsers.map(user => (
                <div key={user.id} className="waiting-user">
                  <div className="user-info">
                    <span className="user-name">👤 {user.displayName}</span>
                  </div>
                  <div className="user-actions">
                    <button
                      className="btn-admit"
                      onClick={() => handleAdmitUser(user.id)}
                    >
                      ✅ Pustiť
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleRejectUser(user.id)}
                    >
                      ❌ Odmietnuť
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomDetail;