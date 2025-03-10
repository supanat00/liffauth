'use client';

import { useEffect, useRef, useState } from 'react';
import MediaCapture from './MediaCapture';

const normalFrames = Array.from({ length: 90 }, (_, i) => `/frame/png-seq/got-standard/Comp 2_${String(i).padStart(5, '0')}.png`);
const secretFrames = Array.from({ length: 90 }, (_, i) => `/frame/png-seq/got-secret/Comp 1_${String(i).padStart(5, '0')}.png`);
const congratsFrames = Array.from({ length: 20 }, (_, i) => `/frame/png-seq/congrat-secret/congrat${String(i).padStart(4, '0')}.png`);

const Random = () => {
  const [frames, setFrames] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [isSecret] = useState(Math.random() < 0.2); // 20% secret, 80% normal
  const [preloadedImages, setPreloadedImages] = useState<HTMLImageElement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const selectedFrames = isSecret ? secretFrames : normalFrames;
    setFrames(selectedFrames);
    setIsLoaded(false);

    // Preload selected frames
    Promise.all(selectedFrames.map((src) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
    })).then((loadedImages) => {
      setPreloadedImages(loadedImages);
      setIsLoaded(true);
    });
  }, [isSecret]);

  useEffect(() => {
    if (!isLoaded || frames.length === 0) return;

    let frameCount = frames.length;
    let speedCurve = frames.map((_, index) => {
      let mid = Math.floor(frameCount / 2);
      let distanceToMid = Math.abs(index - mid);
      return distanceToMid < mid * 0.5 ? 40 : 100; // Middle frames are faster
    });

    let currentFrame = 0;
    
    const playFrames = () => {
      setCurrentIndex(currentFrame);
      currentFrame++;

      if (currentFrame < frameCount) {
        let nextSpeed = speedCurve[currentFrame];
        intervalRef.current = setTimeout(playFrames, nextSpeed);
      } else {
        handleSpinFinish();
      }
    };

    playFrames();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [frames, isLoaded]);

  const handleSpinFinish = () => {
    if (isSecret) {
      setFrames(congratsFrames);
      setCurrentIndex(0);
      setIsLoaded(false);

      // Preload congrats animation frames
      Promise.all(congratsFrames.map((src) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(img);
        });
      })).then((loadedImages) => {
        setPreloadedImages(loadedImages);
        setIsLoaded(true);

        // Show MediaCapture after congrats animation
        setTimeout(() => {
          setShowMediaCapture(true);
        }, congratsFrames.length * 100);
      });
    } else {
      setShowMediaCapture(true);
    }
  };

  return (
    <div className='flex justify-center items-center h-screen relative'>
      {!isLoaded && (
        <div className='flex flex-col items-center justify-center'>
          <span className='text-lg font-bold text-white'>⏳ Loading images...</span>
          <div className='w-12 h-12 border-4 border-white-300 border-t-blue-500 rounded-full animate-spin mt-2'></div>
        </div>
      )}
      
      {isLoaded && !showMediaCapture && (
        <img
          src={preloadedImages[currentIndex]?.src}
          alt='Animation Frame'
          width={600}
          height={600}
          style={{ width: '600px' }}
        />
      )}

      {showMediaCapture && <MediaCapture isSecret={isSecret} />}
    </div>
  );
};

export default Random;