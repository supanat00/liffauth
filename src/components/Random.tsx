'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import MediaCapture from './MediaCapture';

const normalFrames = Array.from({ length: 75 }, (_, i) => `/frame/png-seq/got-normal/Comp 2_${String(i).padStart(5, '0')}.png`);
const secretFrames = Array.from({ length: 74 }, (_, i) => `/frame/png-seq/got-secret/Comp 1_${String(i).padStart(5, '0')}.png`);
const congratsFrames = Array.from({ length: 28 }, (_, i) => `/frame/png-seq/congrat-secret/Comp 4_${String(i).padStart(5, '0')}.png`);
const artistName = 'Khunpol';

const Random = () => {
  const [frames, setFrames] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [isSecret] = useState(Math.random() < 0.3); // Randomly choose normal (70%) or secret (30%)

  useEffect(() => {
    setFrames(!isSecret ? normalFrames : secretFrames);
  }, []);
    
  // If secret, show congratulation sequence after it ends
  useEffect(() => {
    if (frames?.length > 0) {
      const timeout = setTimeout(() => {
        if (isSecret) {
          setShowCongrats(true);
          setFrames(congratsFrames);
          setCurrentIndex(0);
          setTimeout(() => {
            setShowMediaCapture(true);
          }, (congratsFrames.length * 100));
        } else {
          setShowMediaCapture(true);
        }
      }, (frames?.length * 100));
      return () => clearTimeout(timeout);
    }
  }, [frames, isSecret]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % frames?.length);
    }, 100);
    return () => clearInterval(interval);
  }, [frames]);
  
  return (
    <div className='flex justify-center items-center h-screen'>
      {frames[currentIndex] && !showMediaCapture &&
      (<Image 
        src={frames[currentIndex]} 
        alt='Animation Frame' 
        width={400}
        height={400}
        priority
        style={{ width: '600px' }}
      />)}
      {showMediaCapture && <MediaCapture isSecret={isSecret} artistName={isSecret ? artistName : 'normal'} />}
    </div>
  );
}

export default Random;
