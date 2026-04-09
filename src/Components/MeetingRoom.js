import React, { useEffect, useRef, useState } from 'react';
import { database } from '../services/firebase';
import { ref, set, push, onValue, onChildAdded, remove } from 'firebase/database';
import './MeetingRoom.css';

function MeetingRoom({
  roomNumber,
  userData,
  currentUser,
  isHost,
  waitingUsers = [],
  onAdmitUser,
  onRejectUser,
  onLeave
}) {
  const [status, setStatus] = useState('Pripájam médiá...');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const unsubscribeCallbacksRef = useRef([]);
  const remoteDescriptionSetRef = useRef(false);
  const displayName = userData?.displayName || 'Používateľ';
  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return undefined;

    const setupCall = async () => {
      try {
        remoteDescriptionSetRef.current = false;

        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnectionRef.current = peerConnection;

        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
          });
          setStatus('Spojenie aktívne');
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === 'connected') {
            setStatus('Spojenie aktívne');
          } else if (peerConnection.connectionState === 'connecting') {
            setStatus('Prepájam...');
          } else if (peerConnection.connectionState === 'failed') {
            setStatus('Spojenie zlyhalo');
          }
        };

        const basePath = `webrtc/${roomNumber}`;
        const myRole = isHost ? 'host' : 'guest';
        const remoteRole = isHost ? 'guest' : 'host';
        const myCandidatesPath = `${basePath}/candidates/${myRole}`;
        const remoteCandidatesPath = `${basePath}/candidates/${remoteRole}`;
        const offerRef = ref(database, `${basePath}/offer`);
        const answerRef = ref(database, `${basePath}/answer`);
        const remoteCandidatesRef = ref(database, remoteCandidatesPath);

        peerConnection.onicecandidate = async (event) => {
          if (event.candidate) {
            await push(ref(database, myCandidatesPath), event.candidate.toJSON());
          }
        };

        const unsubscribeRemoteCandidates = onChildAdded(remoteCandidatesRef, async (snapshot) => {
          const candidateData = snapshot.val();
          if (!candidateData) return;
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
          } catch (error) {
            console.error('Chyba pri pridávaní ICE kandidáta:', error);
          }
        });
        unsubscribeCallbacksRef.current.push(unsubscribeRemoteCandidates);

        if (isHost) {
          await remove(ref(database, `${basePath}/offer`));
          await remove(ref(database, `${basePath}/answer`));
          await remove(ref(database, `${basePath}/candidates`));

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await set(offerRef, offer);
          setStatus('Čakám na druhého účastníka...');

          const unsubscribeAnswer = onValue(answerRef, async (snapshot) => {
            const answer = snapshot.val();
            if (!answer || remoteDescriptionSetRef.current) return;
            if (peerConnection.signalingState !== 'have-local-offer') return;

            remoteDescriptionSetRef.current = true;
            try {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              setStatus('Účastník sa pripojil');
            } catch (error) {
              remoteDescriptionSetRef.current = false;
              console.error('Chyba pri nastavovaní remote answer:', error);
            }
          });
          unsubscribeCallbacksRef.current.push(unsubscribeAnswer);
        } else {
          const unsubscribeOffer = onValue(offerRef, async (snapshot) => {
            const offer = snapshot.val();
            if (!offer || remoteDescriptionSetRef.current) return;
            if (peerConnection.signalingState !== 'stable') return;

            remoteDescriptionSetRef.current = true;
            try {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await set(answerRef, answer);
              setStatus('Pripojený k meetingu');
            } catch (error) {
              remoteDescriptionSetRef.current = false;
              console.error('Chyba pri nastavovaní remote offer:', error);
            }
          });
          unsubscribeCallbacksRef.current.push(unsubscribeOffer);
          setStatus('Čakám na hosta...');
        }
      } catch (error) {
        console.error('Chyba pri spúšťaní hovoru:', error);
        setStatus('Nepodarilo sa spustiť kameru/mikrofón');
      }
    };

    setupCall();

    return () => {
      unsubscribeCallbacksRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribeCallbacksRef.current = [];

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [roomNumber, uid, isHost]);

  const handleLeave = async () => {
    unsubscribeCallbacksRef.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeCallbacksRef.current = [];

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    try {
      if (isHost) {
        await remove(ref(database, `webrtc/${roomNumber}`));
      } else {
        await remove(ref(database, `webrtc/${roomNumber}/candidates/guest`));
      }
    } catch (error) {
      console.error('Chyba pri čistení WebRTC dát:', error);
    }
    onLeave();
  };

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <h2>📹 Miestnosť {roomNumber}</h2>
        <div className="header-info">
          <span>👤 {displayName}</span>
          <button className="btn-leave" onClick={handleLeave}>
            🚪 Opustiť
          </button>
        </div>
      </div>

      <div className="meeting-content">
        <p className="meeting-instruction">{status}</p>

        <div className="video-grid">
          <div className="video-card">
            <p>Ty ({displayName})</p>
            <video ref={localVideoRef} autoPlay playsInline muted />
          </div>

          <div className="video-card">
            <p>Druhý účastník</p>
            <video ref={remoteVideoRef} autoPlay playsInline />
          </div>
        </div>

        <p className="meeting-note">
          Jednoduchý 1:1 WebRTC hovor bez Jitsi SDK
        </p>

        {isHost && waitingUsers.length > 0 && (
          <div className="meeting-admin-panel">
            <h3>Čakajúci používatelia ({waitingUsers.length})</h3>
            <div className="meeting-waiting-list">
              {waitingUsers.map((user) => (
                <div key={user.id} className="meeting-waiting-user">
                  <span>👤 {user.displayName}</span>
                  <div className="meeting-user-actions">
                    <button
                      className="btn-admit"
                      onClick={() => onAdmitUser && onAdmitUser(user.id)}
                    >
                      Prijať
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => onRejectUser && onRejectUser(user.id)}
                    >
                      Zamietnuť
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

export default MeetingRoom;