import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

import artists from '../../public/artist.json';

interface MediaCaptureProps {
  isSecret: boolean;
  artistId: number;
}

const solidWhiteColor = '#ffffff'; // White background
const solidPinkColor = '#ffb3c3'; // Soft pink background
const frameNormal = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/normal/standard${String(i).padStart(4, '0')}.png`);
const frameSecret = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/secret/khunpol/secret layer 1${String(i).padStart(4, '0')}.png`);

// Set PNG Frame Size  9:16 Aspect Ratio)
const frameWidth = 300;
const frameHeight = 533;

// Reduce Camera Preview to Fit Inside PNG Frame
const cameraWidth = 300;  // Smaller than frameWidth
const cameraHeight = 533; // Maintain 9:16 ratio

// modify on mobile differently
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const MediaCapture: React.FC<MediaCaptureProps> = ({ isSecret, artistId }) => {
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
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [artistName, setArtistName] = useState<string>('');

  useEffect(() => {
    loadResources();
    let name = artists.find(artist => artist.artistId === artistId)?.artistName;
    setArtistName(name || 'NORMAL');
  }, []);

  const loadResources = async () => {
    const model = await bodyPix.load();
    setBodyPixModel(model);
  
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
    loadResources();
  }, []);

  useEffect(() => {
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
    const videoWidth = previewWidth * videoScale; // Reduce video size
    const videoHeight = previewHeight * videoScale;
  
    // **DYNAMIC POSITION BASED ON `isSecret`**
    let horizontalPosition = isSecret ? 'left' : 'center'; // 'left', 'center', 'right'
    let verticalPosition = isSecret ? 'bottom' : 'top'; // 'top', 'center', 'bottom'
  
    let xOffset, yOffset;
  
    // **Compute X Position (Horizontal) with Fallback**
    if (previewWidth > canvas.width) {
      horizontalPosition = 'center'; // Fallback if too large
    }
    switch (horizontalPosition) {
      case 'left':
        xOffset = 0;
        break;
      case 'right':
        xOffset = canvas.width - videoWidth;
        break;
      default: // 'center'
        xOffset = (canvas.width - videoWidth) / 2;
        break;
    }
  
    // **Compute Y Position (Vertical) with Fallback**
    if (previewHeight > canvas.height) {
      verticalPosition = 'center'; // Fallback if too large
    }
    switch (verticalPosition) {
      case 'top':
        yOffset = 0;
        break;
      case 'bottom':
        yOffset = canvas.height - videoHeight;
        break;
      default: // 'center'
        yOffset = (canvas.height - videoHeight) / 2;
        break;
    }
  
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
      console.warn("No person detected. Keeping last frame.");
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
  
    // **DRAW SOLID BACKGROUND COLOR**
    ctx.fillStyle = isSecret ? solidWhiteColor : solidPinkColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
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
  
    // **DRAW SOLID COLOR BEHIND PERSON**
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = isSecret ? solidWhiteColor : solidPinkColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // **RESET TRANSFORMATION**
    ctx.restore();
  
    // **DRAW PNG FRAME OVERLAY**
    ctx.globalCompositeOperation = 'source-over';
    const frame = pngFrames[frameIndex.current];
    if (frame) {
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    }
  
    frameIndex.current = (frameIndex.current + 1) % pngFrames.length;
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
        setCapturedMedia(imageSrc);
        setIsTakeMedia(false);
      }, 'image/png');
    }, 50);
  };

  // Start Video Recording (Includes PNG Overlay)
  const startRecording = () => {
    if (!canvasRef.current) return;
  
    // Check if captureStream is supported
    if (typeof canvasRef.current.captureStream !== "function") {
      alert("Recording is not supported on this browser.");
      return;
    }
  
    setIsRecording(true);
    setIsTakeMedia(true);
  
    const stream = canvasRef.current.captureStream(30);
  
    // Check MediaRecorder MIME support
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
  
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      let chunks: Blob[] = [];
  
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
  
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setVideoUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setIsTakeMedia(false);
  
        // Convert Blob to File for upload
        const fileUpload = new File(
          [blob],
          `${artistName}-video.webm`,
          { type: "video/webm" }
        );
        setFileUpload(fileUpload);
      };
  
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (error) {
      console.error("Error starting media recorder:", error);
      alert("Recording is not supported on this browser.");
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
    setCapturedMedia(null);
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
    } else {
      if(isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const handleTypeEmit = (value: boolean) => {
    setType(!value ? 'video' : 'photo');
  };

  return (
    <div>
      <>
        {(!isProcessingReady || !bodyPixModel || !pngFrames) && (
          <div className='flex flex-col items-center justify-center'>
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
            style={{ aspectRatio: '9 / 16', marginLeft: 'auto', marginRight: 'auto' }}
          />
        </>}
        
        <div>
          {videoUrl && (
            <video controls autoPlay loop width='100%'>
              <source src={videoUrl} type='video/webm' />
            </video>
          )}
          {capturedMedia && (
            <img src={capturedMedia || ''} alt='Captured' />
          )}
        </div>
      </>
      
      {(isProcessingReady && bodyPixModel && pngFrames) && <>
      {/* Control Panel */}
      <div className='grid grid-cols-3 gap-4'>
        <div className='py-3'>
          {/* Retake button */}
          {(capturedMedia || videoUrl) && !isTakeMedia && (
            <>
              <button
              className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'
              onClick={retakeMedia}
              >
                <Icon type='retake' />
              </button>
              <p className='text-xs mt-1 ml-[5px]'>Retake</p>
            </>
          )}
        </div>
        <div className='py-3'>
          {/* Capture controls */}
          {isTakeMedia &&
            <button className={`w-12 h-12 rounded-full border-[1px] outline outline-4 shadow-md transition-all duration-300
              ${isRecording ? 'bg-red-500 border-red-500 outline-red-300 shadow-lg' : 'bg-white border-white outline-white hover:bg-gray-100'}`}
              onClick={handleTypeClick}>
            </button>
          }
          {/* Retake button */}
          {(capturedMedia || videoUrl) && !isTakeMedia && (
            <UploadToS3 downloadMedia={(capturedMedia ? capturedMedia : videoUrl)} uploadMedia={fileUpload} artistName={artistName} />
          )}
        </div>
        <div className='py-3'>
          {isTakeMedia && !isRecording &&
            <Toggle type={type} emitValue={handleTypeEmit} />
          }
          {(capturedMedia || videoUrl) && !isTakeMedia && (
            <>
              <button
              className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'
              >
                <Icon type='qrcode' />
              </button>
              <p className='text-xs mt-1 ml-[-5px]'>Play Again</p>
            </>
          )}
        </div>
      </div>
      </>}

    </div>
  );
};

export default MediaCapture;
