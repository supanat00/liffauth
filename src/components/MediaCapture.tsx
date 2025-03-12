import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

import { useRouteParams } from '@/context/ParamsContext';
import { artistsFrame } from '@/const/artistsFrame';

import ArtistFrame from './ArtistFrame';
import CustomBackground from './CustomBackground';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

interface MediaCaptureProps {
  isSecret: boolean;
}

const MediaCapture: React.FC<MediaCaptureProps> = ({ isSecret }) => {
  const { params } = useRouteParams();
  const componentRef = useRef<HTMLDivElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [artistFrame, setArtistFrame] = useState<string[]>([]);
  const [customBgImage, setCustomBgImage] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTakeMedia, setIsTakeMedia] = useState(true);
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    if (params?.artistId) {
      let artistData = artistsFrame.find(artist => artist.artistId === params.artistId);
      if (artistData) {
        setArtistFrame(isSecret ? artistData.artistSecretFrame : artistData.artistStandardFrame);
        setCustomBgImage(artistData.artistBgFrame);
      }
    }
  }, [params?.artistId, isSecret]);

  const handleTypeClick = () => {
    if (type === 'photo' || type === null) {
      capturePhoto();
    } else {
      if(isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const capturePhoto = async () => {
    if (componentRef.current) {
      const canvas = await html2canvas(componentRef.current, {
        ignoreElements: (element) => element.tagName === 'VIDEO' || element.classList.contains('hidden'),
        useCORS: true,
      });
      const image = canvas.toDataURL('image/png');
      setImageSrc(image);
      setIsTakeMedia(false);
    };
  };

  const startRecording = async () => {
    if (!componentRef.current) return;
  
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const rect = componentRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  
    setIsRecording(true);
    const stream = canvas.captureStream(30); // Capture at 30fps
    const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    const recorder = new MediaRecorder(stream, { mimeType: mimeType });
  
    const chunks: Blob[] = [];
  
    // Function to continuously update the canvas with captured frames
    const drawFrame = async () => {
      if (!componentRef.current) return;
  
      const tempCanvas = await html2canvas(componentRef.current, {
        useCORS: true,
        allowTaint: true,
      });
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  
      requestAnimationFrame(drawFrame);
    };
  
    await drawFrame(); // Start capturing frames
  
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      setVideoSrc(URL.createObjectURL(blob));
      setIsTakeMedia(false);
      setIsRecording(false);
    };

    recorder.start(1000);
    setMediaRecorder(recorder);
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
        setIsRecording(false);
      }
    }, 7000);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };
  
  const retakeMedia = () => {
    setImageSrc(null);
    setVideoSrc(null);
    setIsTakeMedia(true);
    setIsRecording(false);
  
    // Force ArtistFrame re-mount if needed by temporarily clearing frames
    setArtistFrame([]); 
  
    setTimeout(() => {
      if (params?.artistId) {
        const artistData = artistsFrame.find(a => a.artistId === params?.artistId);
        if (artistData) {
          setArtistFrame(isSecret ? artistData.artistSecretFrame : artistData.artistStandardFrame);
        }
      }
    }, 100); // small delay ensures clean re-mount
  };  

  const handleTypeEmit = (value: boolean) => {
    setType(!value ? 'video' : 'photo');
  };

  return (
    <>
    {isTakeMedia && <>
    <div ref={componentRef} className='relative w-full h-screen flex items-center justify-center overflow-hidden'>
      <CustomBackground customBgImage={customBgImage} />
      {/* Foreground (Highest z-index) */}
      <div className='absolute inset-0 z-20 h-full w-full flex items-center justify-center pointer-events-none'>
        <ArtistFrame artistFrame={artistFrame} />
      </div>
    </div>
    </>}

    {!isTakeMedia && (
      <>
        {imageSrc && <img src={imageSrc} alt='Screenshot Preview' className='preview-img' />}
        {videoSrc && <video src={videoSrc} controls autoPlay muted loop className='preview-vid'></video>}
      </>
    )}

    {/* Control Panel */}
    <div className='grid grid-cols-3 gap-4 place-items-center control-panel'>
      <div className='py-3 items-center justify-center col-css'>
        {/* Retake button */}
        {(imageSrc || videoSrc) && !isTakeMedia && (
          <>
            <div onClick={retakeMedia}><Icon type='backImg' /></div>
            <p className='text-xs mt-1 text-white'>Back</p>
          </>
        )}
      </div>
      <div className='py-3 items-center justify-center col-css'>
        {/* Capture controls */}
        {isTakeMedia &&
          <button className={`w-12 h-12 rounded-full border-[1px] outline outline-4 shadow-md transition-all duration-300
            ${isRecording ? 'bg-red-500 border-red-500 outline-red-300 shadow-lg' : 'bg-white border-white outline-white hover:bg-gray-100'}`}
            onClick={handleTypeClick}
          >
          </button>
        }
        {/* Retake button */}
        {(imageSrc || videoSrc) && !isTakeMedia && (
          <UploadToS3 downloadMedia={(imageSrc ? imageSrc : videoSrc)} />
        )}
      </div>
      <div className='py-3 items-center justify-center col-css'>
        {isTakeMedia && !isRecording &&
          <Toggle type={type} emitValue={handleTypeEmit} />
        }
        {(imageSrc || videoSrc) && !isTakeMedia && (
          <>
            <a href='https://planetofgame.com/ar/22'>
              <Icon type='playAgain' />
            </a>
            <p className='text-xs mt-1 text-white'>Start Again</p>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default MediaCapture;
