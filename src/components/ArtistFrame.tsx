import React from 'react';
import Image from 'next/image';

interface ArtistFrameProps {
  artistFrame?: string;
}

const ArtistFrame: React.FC<ArtistFrameProps> = ({ artistFrame }) => {
  if (!artistFrame) return null; // Don't render if no image source
  return (
    <div>
      <Image
        alt='artist-gif'
        src={artistFrame}
        width={300}
        height={300}
      />
    </div>
  );
};

export default ArtistFrame;
