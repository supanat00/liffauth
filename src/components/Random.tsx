'use client';

import { useEffect, useState } from 'react';
import MediaCapture from './MediaCapture';
import Image from 'next/image';

const standardFrameGif = '/frame/gif/standard.gif';
const secretFrameGif = '/frame/gif/secret.gif';
const congratsFrameGif = '/frame/gif/congrat.gif';

const gifDurations = {
  [standardFrameGif]: 2650, // 2.65 seconds
  [secretFrameGif]: 2650, // 2.65 seconds
  [congratsFrameGif]: 1000 // 1 second
};

const Random = () => {
  const [isSecret] = useState(Math.random() < 0.2); // 20% secret, 80% normal
  const [gifStage, setGifStage] = useState('playing'); // 'playing' -> 'congrats' -> 'done'
  
  const selectedGif = isSecret ? secretFrameGif : standardFrameGif;

  useEffect(() => {
    // Wait for the first GIF to finish
    const firstTimer = setTimeout(() => {
      if (isSecret) {
        setGifStage('congrats'); // Show congrats GIF
        // Wait for the congrats GIF to finish
        setTimeout(() => {
          setGifStage('done'); // Move to MediaCapture
        }, gifDurations[congratsFrameGif]);
      } else {
        setGifStage('done'); // If not secret, go directly to MediaCapture
      }
    }, gifDurations[selectedGif]);

    return () => clearTimeout(firstTimer);
  }, [selectedGif, isSecret]);

  return (
    <div className='flex justify-center items-center h-screen relative'>

      {gifStage === 'playing' && (
        <Image
          alt={isSecret ? 'secret-gif' : 'standard-gif'}
          src={selectedGif}
          width={300}
          height={300}
        />
      )}

      {gifStage === 'congrats' && isSecret && (
        <Image
          alt='congrats-gif'
          src={congratsFrameGif}
          width={300}
          height={300}
        />
      )}

      {gifStage === 'done' && <MediaCapture isSecret={isSecret} />}
      
    </div>
  );
};

export default Random;
