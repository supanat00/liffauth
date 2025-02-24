'use client';

import { useEffect, useState } from 'react';
import MediaCapture from './MediaCapture';

const normalFrames = Array.from({ length: 75 }, (_, i) => `/frame/png-seq/got-normal/Comp 2_${String(i).padStart(5, '0')}.png`);
const secretFrames = Array.from({ length: 74 }, (_, i) => `/frame/png-seq/got-secret/Comp 1_${String(i).padStart(5, '0')}.png`);
const congratsFrames = Array.from({ length: 28 }, (_, i) => `/frame/png-seq/congrat-secret/Comp 4_${String(i).padStart(5, '0')}.png`);
const artistId = 4;

const Random = () => {
  const [frames, setFrames] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showMediaCapture, setShowMediaCapture] = useState(false);
  const [isSecret] = useState(Math.random() < 0.3); // Randomly choose normal (70%) or secret (30%)
  const [preloadedImages, setPreloadedImages] = useState<HTMLImageElement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false); // Ensures all images are preloaded

  useEffect(() => {
    const selectedFrames = !isSecret ? normalFrames : secretFrames;
    setFrames(selectedFrames);
    setIsLoaded(false); // Reset loading state

    // Show loading message while images are preloading
    Promise.all(
      selectedFrames.map((src) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(img);
        });
      })
    ).then((loadedImages) => {
      setPreloadedImages(loadedImages);
      setIsLoaded(true); // Mark images as fully loaded
    });
  }, [isSecret]);

  useEffect(() => {
    if (isLoaded && frames.length > 0) {
      const timeout = setTimeout(() => {
        if (isSecret) {
          setShowCongrats(true);
          setFrames(congratsFrames);
          setCurrentIndex(0);
          setIsLoaded(false);

          // Preload congratulation frames
          Promise.all(
            congratsFrames.map((src) => {
              return new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
              });
            })
          ).then((loadedImages) => {
            setPreloadedImages(loadedImages);
            setIsLoaded(true);
          });

          setTimeout(() => {
            setShowMediaCapture(true);
          }, congratsFrames.length * 100);
        } else {
          setShowMediaCapture(true);
        }
      }, frames.length * 100);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded, frames, isSecret]);

  useEffect(() => {
    if (!isLoaded) return; // Ensure animation starts only when images are loaded

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % frames.length);
    }, 100);
    return () => clearInterval(interval);
  }, [frames, isLoaded]);

  return (
    <div className='flex justify-center items-center h-screen relative'>
      {!isLoaded && (
        <div className='flex flex-col items-center justify-center'>
          <span className='text-lg font-bold text-white'>⏳ Loading images...</span>
          <div className='w-12 h-12 border-4 border-white-300 border-t-blue-500 rounded-full animate-spin mt-2'></div>
        </div>
      )}
      
      {isLoaded && frames[currentIndex] && !showMediaCapture && (
        <img
          src={preloadedImages[currentIndex].src}
          alt='Animation Frame'
          width={600}
          height={600}
          style={{ width: '600px' }}
        />
      )}

      {showMediaCapture && <MediaCapture isSecret={isSecret} artistId={isSecret ? artistId : 0} />}
    </div>
  );
};

export default Random;
