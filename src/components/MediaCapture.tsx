import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

import artists from '../../public/artist.json';
import { useRouteParams } from '@/context/ParamsContext';
import { artistsFrame } from '@/const/artistsFrame';

interface MediaCaptureProps {
  isSecret: boolean;
}

// Set 9:16 Aspect Ratio)
const frameWidth = 450;
const frameHeight = 800;
const cameraWidth = 450;
const cameraHeight = 800;

// modify on mobile differently
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const MediaCapture: React.FC<MediaCaptureProps> = ({ isSecret }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const [pngFrames, setPngFrames] = useState<HTMLImageElement[]>([]);
  const frameIndex = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTakeMedia, setIsTakeMedia] = useState(true);
  const [type, setType] = useState<string | null>(null);
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [artistName, setArtistName] = useState<string>('');
  const [videoType, setVideoType] = useState<string>('');
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  const { params } = useRouteParams();
  const accessId = params?.accessId || '';

  useEffect(() => {
    loadResources();
    const name = artists.find(artist => artist.artistId === params?.artistId)?.artistName;
    setArtistName(name || 'N/A');
  }, []);

  const loadResources = async () => {
    const model = await bodyPix.load();
    setBodyPixModel(model);

    // Load custom background image
    const customBg = artistsFrame.find(artist => artist.artistId === params?.artistId)?.artistBgFrame || '';
    const bgImage = new Image();
    bgImage.src = customBg; // Replace with actual URL
    bgImage.onload = () => {
      // Save the background in state
      setCustomBgImage(bgImage);
      setIsBgLoaded(true);
    };
  
    const video = videoRef.current;
    if (video) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: isMobile ? 720 : 1080 }, // Reduce width for mobile to avoid distortion
          height: { ideal: isMobile ? 1280 : 1920 }, // Keep 9:16 aspect ratio
          facingMode: 'user',
        },
      });
  
      video.srcObject = stream;
      video.onloadedmetadata = async () => {
        video.play();
        setIsProcessingReady(true);
      };
    }
  };

  useEffect(() => {
    const frameNormal = artistsFrame.find(artist => artist.artistId === params?.artistId)?.artistNormalFrame || [];
    const frameSecret = artistsFrame.find(artist => artist.artistId === params?.artistId)?.artisSecretFrame || [];
    const loadImages = async () => {
      const images = await Promise.all(
        (isSecret ? frameSecret : frameNormal).map((src) => {
          return new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
          });
        })
      );
      setPngFrames(images);
    };
    loadImages();
  }, []);

  let lastTime = 0;

  const replaceBackground = async () => {
    if (!isProcessingReady || !bodyPixModel || pngFrames.length === 0) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  
    if (!canvas || !video || !ctx) return;
  
    const now = performance.now();
    if (now - lastTime < 33) return;
    lastTime = now;
  
    // **SET CAMERA PREVIEW SIZE**
    const previewScale = isMobile ? 2 : 1; // Slightly larger for mobile
    const previewWidth = canvas.width * previewScale;
    const previewHeight = canvas.height;
    const videoScale = isMobile ? 0.5 : 1;
    const videoWidth = previewWidth * videoScale
    const videoHeight = previewHeight * videoScale
  
    // Set Camera Preview Position Center-Bottom
    const xOffset = (canvas.width - videoWidth) / 2;
    const yOffset = (canvas.height - videoHeight) - 10;
  
    // **CREATE TEMP CANVAS FOR BODYPIX PROCESSING**
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoWidth;
    tempCanvas.height = videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
  
    // **DRAW VIDEO TO TEMP CANVAS**
    tempCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
  
    // **BODY SEGMENTATION**
    const segmentation = await bodyPixModel.segmentPerson(tempCanvas, {
      internalResolution: 'high',
      segmentationThreshold: 0.7,
      flipHorizontal: false,
      scoreThreshold: 0.2,
      maxDetections: 2,
    });    

    // If no person is detected, return without updating the canvas
    if (!segmentation || segmentation.allPoses.length === 0) {
      console.warn('No person detected. Keeping last frame.');
      return;
    }
  
    const maskImageData = bodyPix.toMask(
      segmentation,
      { r: 255, g: 255, b: 255, a: 255 }, // White mask for the person
      { r: 0, g: 0, b: 0, a: 0 } // Transparent background
    );
  
    // **CLEAR MAIN CANVAS**
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // **FLIP CONTEXT HORIZONTALLY**
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
  
    // **DRAW VIDEO PREVIEW (SCALED & POSITIONED)**
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(video, xOffset, yOffset, videoWidth, videoHeight); // Use adjusted video size
  
    // **MASK CANVAS FOR SEGMENTATION**
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = videoWidth;
    maskCanvas.height = videoHeight;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.putImageData(maskImageData, 0, 0);
    }
  
    // **DRAW MASK OVER VIDEO**
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, xOffset, yOffset, videoWidth, videoHeight);
  
    // **RESET TRANSFORMATION**
    ctx.restore();
  
    // Set frame index based on time to ensure accurate playback
    const totalFrames = 30; // Total frames for 0.99 sec at 30fps
    const currentTime = (Date.now() % 990) / 990; // Normalized 0-1 time
    frameIndex.current = Math.floor(currentTime * totalFrames) % pngFrames.length;
    // **DRAW PNG FRAME OVERLAY**
    ctx.globalCompositeOperation = 'source-over';
    const frame = pngFrames[frameIndex.current];
    if (frame) {
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    }  
    frameIndex.current = (frameIndex.current + 1) % pngFrames.length;

    // **DRAW STATIC BACKGROUND FIRST**
    if (customBgImage && isBgLoaded) {
      ctx.globalCompositeOperation = 'destination-over'; // Ensure normal drawing mode
      ctx.drawImage(customBgImage, 0, 0, canvas.width, canvas.height);
    }
  };
  
  useEffect(() => {
    if (isProcessingReady && bodyPixModel) {
      const interval = setInterval(replaceBackground, 33);
      return () => clearInterval(interval);
    }
  }, [isProcessingReady, bodyPixModel, pngFrames]);

  // Capture Photo with Correct Camera & Frame Size
  const capturePhoto = () => {
    if (!canvasRef.current) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = frameWidth;
    tempCanvas.height = frameHeight;

    setTimeout(() => {
      if (!canvasRef.current) return;

      tempCtx.drawImage(canvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);

      // Convert canvas to Blob
      tempCanvas.toBlob((blob) => {
        if (!blob) return;
        // Create a file from the Blob
        const file = new File([blob], `${artistName}-image.png`, { type: 'image/png' });
        setFileUpload(file);
        // Create a URL for the Blob and trigger the download
        const url = URL.createObjectURL(file);
        // Cleanup Blob URL
        URL.revokeObjectURL(url);

        const imageSrc = tempCanvas.toDataURL('image/png');
        setImageUrl(imageSrc);
        setIsTakeMedia(false);
      }, 'image/png');
    }, 50);
  };

  // Start Video Recording (Includes PNG Overlay)
  const startRecording = () => {
    if (!canvasRef.current) return;
  
    // Check if captureStream is supported
    if (typeof canvasRef.current.captureStream !== 'function') {
      alert('Recording is not supported on this browser.');
      return;
    }
  
    setIsRecording(true);
    setIsTakeMedia(true);
  
    const stream = canvasRef.current.captureStream(30);
  
    // Check MIME type support for different browsers
    let mimeType = '';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else {
      alert('Recording is not supported on this browser.');
      return;
    }
    setVideoType(mimeType);
  
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      let chunks: Blob[] = [];
  
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
  
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setVideoUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setIsTakeMedia(false);
  
        // Convert Blob to File for upload
        const fileUpload = new File([blob], `${artistName}-video.${mimeType.split('/')[1]}`, { type: mimeType });
        setFileUpload(fileUpload);
      };
  
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (error) {
      console.error('Error starting media recorder:', error);
      alert('Recording is not supported on this browser.');
    }
  };
  
  // Stop Video Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsTakeMedia(false);
    }
  };

  // Retake Media
  const retakeMedia = async () => {
    setImageUrl(null);
    setVideoUrl(null);
    setIsTakeMedia(true);
    setIsRecording(false);
    setFileUpload(null);
    frameIndex.current = 0; // Reset animation frame index  
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }  
    // Restart video stream
    if (videoRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: cameraWidth, height: cameraHeight },
      });
  
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
      };
    }  
    // Reload PNG frames and background image
    loadResources();
  };

  const handleTypeClick = () => {
    if (type === 'photo' || type === null) {
      capturePhoto();
      updateTransaction(accessId, 'takePhoto');
    } else {
      if(isRecording) {
        stopRecording();
      } else {
        startRecording();
        updateTransaction(accessId, 'takeVideo');
      }
    }
  };

  const handleTypeEmit = (value: boolean) => {
    setType(!value ? 'video' : 'photo');
  };

  const updateTransaction = async (accessId: string, field: string) => {
    try {
      const response = await fetch('/api/updateTransaction', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessId, field })
      });
  
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
  
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  return (
    <div>
      <>
        {(!isProcessingReady || !bodyPixModel || !pngFrames) && (
          <div className='flex flex-col items-center justify-center prepare-frame'>
            <span className='text-lg font-bold text-white'>🎥 Preparing frame...</span>
            <div className='w-12 h-12 border-4 border-white-300 border-t-blue-500 rounded-full animate-spin mt-2'></div>
          </div>
        )}

        {isTakeMedia && <>
          <video
            ref={videoRef} autoPlay playsInline muted
            width={cameraWidth} height={cameraHeight}
            style={{ position: 'absolute', zIndex: -1, visibility: 'hidden'}}
          />
          <canvas
            ref={canvasRef} width={cameraWidth} height={cameraHeight}
            id='canvas'
            style={{ aspectRatio: '9 / 16', marginLeft: 'auto', marginRight: 'auto' }}
          />
        </>}
        
        <div className='display-media'>
          {videoUrl && (
            <video controls autoPlay loop width='100%'>
              <source src={videoUrl} type={isIOS || videoType.includes('mp4') ? 'video/mp4' : 'video/webm'} />
            </video>
          )}
          {imageUrl && (
            <img src={imageUrl || ''} alt='Captured' />
          )}
        </div>
      </>
      {(isProcessingReady && bodyPixModel && pngFrames) && <>
      {/* Control Panel */}
      <div className='grid grid-cols-3 gap-4 place-items-center control-panel'>
        <div className='py-3 items-center justify-center col-css'>
          {/* Retake button */}
          {(imageUrl || videoUrl) && !isTakeMedia && (
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
              onClick={handleTypeClick}>
            </button>
          }
          {/* Retake button */}
          {(imageUrl || videoUrl) && !isTakeMedia && (
            <UploadToS3 downloadMedia={(imageUrl ? imageUrl : videoUrl)} artistName={artistName} />
          )}
        </div>
        <div className='py-3 items-center justify-center col-css'>
          {isTakeMedia && !isRecording &&
            <Toggle type={type} emitValue={handleTypeEmit} />
          }
          {(imageUrl || videoUrl) && !isTakeMedia && (
            <>
              <a href='https://planetofgame.com/ar/22'>
                <Icon type='playAgain' />
              </a>
              <p className='text-xs mt-1 text-white'>Start Again</p>
            </>
          )}
        </div>
      </div>
      </>}

    </div>
  );
};

export default MediaCapture;
