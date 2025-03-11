import React from 'react';
import Image from 'next/image';
import BackgroundRemovalVideo from './BackgroundRemovalVideo';

interface CustomBackgroundProps {
  customBgImage?: string;
}

const CustomBackground: React.FC<CustomBackgroundProps> = ({ customBgImage }) => {
  if (!customBgImage) return null; // Avoid rendering if no image source
  return (
    <div className='relative w-full h-full'>
      {/* Background Image (Lower Layer) */}
      <Image
        alt='custom-bg-gif'
        src={customBgImage}
        width={300}
        height={300}
        className='inset-0 w-full h-full object-cover z-10'
      />
      {/* Video (Foreground, Above the Image) */}
      <div className='absolute inset-0 z-20 flex items-center justify-center'>
        <BackgroundRemovalVideo />
      </div>
    </div>
  );
};

export default CustomBackground;
