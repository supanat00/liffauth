'use client';

export const dynamic = 'force-static';  // Ensure static export

import React, { useEffect, Suspense } from 'react';
import Random from '@/components/Random';

import CryptoJS from 'crypto-js';
import { useRouteParams } from '@/context/ParamsContext';
import { useSearchParams } from 'next/navigation';

// https://nestle-project-61016.web.app/?userid=U2FsdGVkX19tslTlS0bcOKfrnkvtZDubYGk7e60rdYM3kFCUvYC3QMr7YoX/Vpfy&consent=U2FsdGVkX1/afpVGbSsy0Vzl7C92iiusJxhfYQuXeh8&age=U2FsdGVkX1+zfEhVD1MNDbSXI0oKIHYTVdLbzD7A8r0=&artistId=1
// userid=U2FsdGVkX19tslTlS0bcOKfrnkvtZDubYGk7e60rdYM3kFCUvYC3QMr7YoX/Vpfy
// &consent=U2FsdGVkX1+fV3lzwtKKLeczfw1uEeNejMw9qDo0OA0 // true
// &consent=U2FsdGVkX1/afpVGbSsy0Vzl7C92iiusJxhfYQuXeh8 // false
// &age=U2FsdGVkX1+zfEhVD1MNDbSXI0oKIHYTVdLbzD7A8r0= // >20 (26)
// &age=U2FsdGVkX18bD9F8eFpq3Focg/5MJK9Dc9AZTb1m/0U= // 20
// &age=U2FsdGVkX1+IUVktIs3wpNOVbHqIxQj0oBXnNuXRNE0= // <20
// &artistId=2';

const AppContent = () => {
  const { params, setParams } = useRouteParams();
  const searchParams = useSearchParams();
  
  const userId = searchParams.get('userid') || null;
  const consent = searchParams.get('consent') || null;
  const age = searchParams.get('age') || null;
  const artistId = searchParams.get('artistId') || null;

  useEffect(() => {
    setParams({
      userId: userId ? decrypt(userId) : null,
      consent: consent ? decrypt(consent).toLowerCase() === 'true' : false,
      age: age ? Number(decrypt(age)) : 0,
      artistId: Number(artistId)
    });
  }, [setParams]);

  const decrypt = (encryptedData: string) => {
    const key = process.env.NEXT_PUBLIC_key || '';
    const ivString = process.env.NEXT_PUBLIC_iv || '';
    const iv = CryptoJS.enc.Utf8.parse(ivString);
    const formattedData = encryptedData.replaceAll(/ /g, '+'); // Fix '+' issue
    const bytes = CryptoJS.AES.decrypt(formattedData, key, { iv: iv, mode: CryptoJS.mode.CBC });
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  return (
    <section className='relative flex flex-col items-center justify-center bg-backgroundImg'>
      {userId && consent && age && artistId ?
        <Random /> :
        <p>Please scan bottle.</p>
      }
    </section>
  );
};

const App = () => {
  return (
    <Suspense fallback={<div className='relative flex flex-col items-center justify-center bg-backgroundImg'>Loading...</div>}>
      <AppContent /> 
    </Suspense>
  );
};

export default App;