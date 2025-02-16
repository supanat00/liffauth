'use client';

export const dynamic = "force-static";  // Ensure static export

import ImageBg from './components/ImageBg';
import SolidColor from './components/SolidColor';
import MergeColorBgCapture from './components/MergeColorBgCapture';
import MergeImgBgCapture from './components/MergeImgBgCapture';
import CaptureNonBg from './components/CaptureNonBg';

export default function App() {

  return (
    <section className='relative flex flex-col items-center justify-center' style={{ backgroundColor: '#ddd' }}>
      <div className='grid grid-cols-3 gap-4'>
        <div className='p-4'>
          <h1 className='m-2'>Image BG</h1>
          {/* <ImageBg /> */}
          <MergeImgBgCapture isSecret={true} artistName={'normal'} />
        </div>
        <div className='p-4'>
          <h1 className='m-2'>Solid Color BG</h1>
          {/* <SolidColor /> */}
          <MergeColorBgCapture isSecret={true} artistName={'normal'} />
        </div>
        <div className='p-4'>
          <h1 className='m-2'>Without BG</h1>
          <CaptureNonBg isSecret={true} artistName={'normal'} />
        </div>
      </div>
    </section>
  );
}