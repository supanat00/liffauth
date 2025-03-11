import React, { useState, useEffect, useRef } from 'react';

interface ArtistFrameProps {
  artistFrame?: string[];
}

const ArtistFrame: React.FC<ArtistFrameProps> = ({ artistFrame = [] }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!artistFrame.length) return;

    let frameIndex = 0;
    const frameDuration = 1000 / artistFrame.length;

    intervalRef.current = setInterval(() => {
      setCurrentFrame(frameIndex % artistFrame.length);
      frameIndex++;
    }, frameDuration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [artistFrame]);

  if (!artistFrame.length) return null;

  return (
    <img
      src={artistFrame[currentFrame]}
      alt="artist-sequence"
      width={300}
      height={300}
      draggable={false}
    />
  );
};

export default ArtistFrame;
