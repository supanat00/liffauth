import React, { useState, useEffect, useRef } from 'react';

interface ArtistFrameProps {
  artistFrame?: string[];
  isRecording?: boolean;
}

const ArtistFrame: React.FC<ArtistFrameProps> = ({ artistFrame = [], isRecording }) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    if (!artistFrame.length || isRecording) return;

    artistFrame.forEach(src => {
      const img = new Image();
      img.src = srcWithVersion(src);
    });

    let frameIndex = 0;
    intervalCleanup.current = setInterval(() => {
      setCurrentFrame(frameIndex % artistFrame.length);
      frameIndex++;
    }, 1000 / artistFrame.length);

    return () => {
      if (intervalCleanup.current) clearInterval(intervalCleanup.current);
    };
  }, [artistFrame, isRecording]);

  const intervalCleanup = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalCleanup.current) clearInterval(intervalCleanup.current);
    };
  }, []);

  if (!artistFrame.length) return null;

  return (
    <div>
      <img
        src={srcWithVersion(artistFrame[currentFrame])}
        alt="artist-sequence"
        width={300}
        height={300}
        draggable={false}
      />
    </div>
  );
};

export default ArtistFrame;

const srcWithVersion = (src: string) => `${src}?v=1`;
