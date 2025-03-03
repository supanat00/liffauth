'use client';

export const dynamic = 'force-static';  // Ensure static export

import React, { useEffect } from 'react';
import Random from '@/components/Random';

import CryptoJS from 'crypto-js';
import { useRouteParams } from '@/context/ParamsContext';
import { useSearchParams } from 'next/navigation';

// https://nestle-project-61016.web.app/?userid=U2FsdGVkX19tslTlS0bcOKfrnkvtZDubYGk7e60rdYM3kFCUvYC3QMr7YoX/Vpfy&consent=aX/PhJj+W7DHLjVQ9Rrk3Q==&age=U2FsdGVkX1+zfEhVD1MNDbSXI0oKIHYTVdLbzD7A8r0=&artistId=2
// userid=U2FsdGVkX19tslTlS0bcOKfrnkvtZDubYGk7e60rdYM3kFCUvYC3QMr7YoX/Vpfy
// &consent=U2FsdGVkX1+fV3lzwtKKLeczfw1uEeNejMw9qDo0OA0 // true
// &consent=aX/PhJj+W7DHLjVQ9Rrk3Q== // false
// &age=U2FsdGVkX1+zfEhVD1MNDbSXI0oKIHYTVdLbzD7A8r0= // >20 (26)
// &age= // 20
// &age= // <20
// &artistId=2';

const App = () => {
  const { params, setParams } = useRouteParams();
  const searchParams = useSearchParams();
  
  const userid = searchParams.get('userid');
  const consent = searchParams.get('consent');
  const age = searchParams.get('age');
  const artistId = searchParams.get('artistId');

  useEffect(() => {
    setParams({
      userId: userid ? decrypt(userid) : null,
      consent: consent ? decrypt(consent).toLowerCase() === 'true' : false,
      age: age ? Number(decrypt(age)) : 0,
      artistId: Number(artistId)
    });
  }, [setParams]);

  const decrypt = (encryptedData: string) => {
    const key = process.env.NEXT_PUBLIC_key || '';
    const iv = process.env.NEXT_PUBLIC_iv || '';
    const formattedData = encryptedData.replaceAll(/ /g, '+'); // Fix '+' issue
    const bytes = CryptoJS.AES.decrypt(formattedData, key, { iv, mode: CryptoJS.mode.CBC });
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  return (
    <section className='relative flex flex-col items-center justify-center bg-backgroundImg'>
      <Random />
    </section>
  );
};

export default App;