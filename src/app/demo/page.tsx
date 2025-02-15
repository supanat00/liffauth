'use client';

import ImageBg from './components/ImageBg';
import SolidColor from './components/SolidColor';

export default function App() {

  return (
    <section className='relative flex flex-col items-center justify-center'>
      <div className='m-4'><ImageBg /></div>
      <div className='m-4'><SolidColor /></div>
    </section>
  );
}