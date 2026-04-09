import React, { useState, useEffect } from 'react';
import { database } from '../services/firebase';
import { ref, onValue } from 'firebase/database';

function BlockList({ onBlockSelect }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Načítaj bloky z Firebase
    const blocksRef = ref(database, 'blocks');
    
    const unsubscribe = onValue(blocksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Preveď objekt na pole
        const blocksArray = Object.keys(data).map(key => ({
          id: key,
          name: key,
          ...data[key]
        }));
        setBlocks(blocksArray);
      }
      setLoading(false);
    });

    // Cleanup
    return () => unsubscribe();
  }, []);

  // Funkcia na spočítanie aktívnych meetingov pre blok
  const countActiveMeetings = (blockName) => {
    // TODO: Neskôr spočítame z Firebase rooms
    return Math.floor(Math.random() * 3); // Zatiaľ random
  };

  if (loading) {
    return (
      <div className="block-list">
        <h2>Načítavam bloky...</h2>
      </div>
    );
  }

  return (
    <div className="block-list">
      <h2>Výber blok</h2>
      <div className="blocks-grid">
        {blocks.map(block => (
          <div 
            key={block.id} 
            className="block-card"
            onClick={() => onBlockSelect(block.name)}
          >
            <h3>Blok {block.name}</h3>
            <div className="block-info">
              <p>📍 {block.roomCount} miestností</p>
              <p className={countActiveMeetings(block.name) > 0 ? 'active' : 'inactive'}>
                {countActiveMeetings(block.name) > 0 
                  ? `🔴 ${countActiveMeetings(block.name)} aktívnych meetingov` 
                  : '⚪ Žiadne aktívne meetingy'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BlockList;