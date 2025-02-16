'use client';

import { useState, useRef, useEffect } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

interface MediaCaptureProps {
  isSecret: boolean;
  artistName: string;
}

const imgWhiteBg = '/frame/img/white-bg.jpg'; // Background image
const imgPinkBg = '/frame/img/pink-bg.jpg'; // Background image
const frameNormal = '/frame/png-seq/normal/standard'; // PNG sequence path
const frameSecret = '/frame/png-seq/secret/khunpol/secret layer 1'; // PNG sequence path

const TOTAL_FRAMES = 30; // Total frames in sequence
const FRAME_RATE = 100; // Animation speed in ms per frame

const MediaCapture: React.FC<MediaCaptureProps> = ({ isSecret, artistName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTakeMedia, setIsTakeMedia] = useState(true);
  const [type, setType] = useState<string | null>(null);
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const pngFramesRef = useRef<HTMLImageElement[]>([]);

  const loadResources = async () => {
    const model = await bodyPix.load();
    setBodyPixModel(model);

    // Load background image
    const bgImage = new Image();
    bgImage.src = (isSecret ? imgWhiteBg : imgPinkBg);
    bgImage.onload = () => {
      backgroundImageRef.current = bgImage;
    };

    // Load PNG sequence
    const frames: HTMLImageElement[] = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = `${isSecret ? frameSecret : frameNormal}${String(i).padStart(4, '0')}.png`; // Zero-padded filenames
      frames.push(img);
    }
    pngFramesRef.current = frames;

    // Access webcam
    const video = videoRef.current;
    if (video) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: cameraWidth, height: cameraHeight },
      });
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        setIsProcessingReady(true);
      };
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  useEffect(() => {
    if (isProcessingReady) {
      const interval = setInterval(() => {
        setFrameIndex((prevIndex) => (prevIndex + 1) % TOTAL_FRAMES);
      }, FRAME_RATE);
      return () => clearInterval(interval);
    }
  }, [isProcessingReady]);

  const replaceBackground = async () => {
    if (!isProcessingReady || !bodyPixModel) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !video || !ctx || !backgroundImageRef.current) return;

    // Step 1: Perform segmentation
    const segmentation = await bodyPixModel.segmentPerson(video, {
      internalResolution: 'high',
      segmentationThreshold: 0.8,
    });

    // Step 2: Get raw mask as pixel data
    const mask = bodyPix.toMask(
      segmentation,
      { r: 255, g: 255, b: 255, a: 255 }, // Keep person (White)
      { r: 0, g: 0, b: 0, a: 0 } // Remove background (Transparent)
    );

    // Step 3: Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Step 4: Draw the background image **first**
    ctx.drawImage(backgroundImageRef.current, 0, 0, frameWidth, frameHeight);

    // Step 5: Create an offscreen canvas for the person (camera preview)
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = frameWidth;
    offscreenCanvas.height = frameHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    if (offscreenCtx) {
      // Draw the camera preview onto the offscreen canvas
      offscreenCtx.drawImage(video, 0, 0, cameraWidth, cameraHeight);

      // Apply the mask pixel-by-pixel to show only the person
      const imageData = offscreenCtx.getImageData(0, 0, cameraWidth, cameraHeight);
      const maskData = mask.data;

      for (let i = 0; i < maskData.length; i += 4) {
        if (maskData[i] === 0 && maskData[i + 1] === 0 && maskData[i + 2] === 0) {
          // Background pixel: Set it to transparent
          imageData.data[i + 3] = 0;
        }
      }
      offscreenCtx.putImageData(imageData, 0, 0);

      // Draw the masked person (camera preview) onto the main canvas **(This was missing)**
      ctx.drawImage(offscreenCanvas, 0, 0);
    }

    // Step 6: Draw PNG frame sequence on top
    if (pngFramesRef.current[frameIndex]) {
      ctx.drawImage(pngFramesRef.current[frameIndex], 0, 0, frameWidth, frameHeight);
    }
  };

  useEffect(() => {
    if (isProcessingReady && bodyPixModel) {
      const interval = setInterval(replaceBackground, 33);
      return () => clearInterval(interval);
    }
  }, [isProcessingReady, bodyPixModel, frameIndex]);

  const handleTypeEmit = (value: boolean) => {
    setType(!value ? 'video' : 'photo');
  };

  // Set PNG Frame Size (3:4 Aspect Ratio)
  const frameWidth = 350;
  const frameHeight = 600;

  // Reduce Camera Preview to Fit Inside PNG Frame
  const cameraWidth = 350;  // Smaller than frameWidth
  const cameraHeight = 600; // Maintain 3:4 ratio

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

    setIsRecording(true);
    setIsTakeMedia(true);

    const stream = canvasRef.current.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    let chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setVideoUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      setIsTakeMedia(false);

      // Convert Blob to File for upload
      const fileUpload = new File([blob], `${artistName}-video.webm`, { type: 'video/webm' });
      setFileUpload(fileUpload);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
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
    setFrameIndex(0); // Reset animation frame index  
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

  return (
    <div>
      <>
        {isTakeMedia && <>
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} width={frameWidth} height={frameHeight} />
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
      
      {/* Control Panel */}
      <div className='grid grid-cols-3 gap-4'>
        <div className='p-3'>
          <button className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'>
            <Icon type='back' />
          </button>
        </div>
        <div className='p-3'>
          {/* Capture controls */}
          {isTakeMedia &&
            <button className={`w-12 h-12 rounded-full border-[1px] outline outline-4 shadow-md transition-all duration-300
              ${isRecording ? 'bg-red-500 border-red-500 outline-red-300 shadow-lg' : 'bg-white border-white outline-white hover:bg-gray-100'}`}
            onClick={handleTypeClick}>
          </button>}
          {/* Retake button */}
          {(capturedMedia || videoUrl) && !isTakeMedia && (
            <>
              <button
              className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'
              onClick={retakeMedia}
              >
                <Icon type='retake' />
              </button>
              <p className='text-xs'>Retake</p>
              <UploadToS3 downloadMedia={(capturedMedia ? capturedMedia : videoUrl)} uploadMedia={fileUpload} artistName={artistName} />
            </>
          )}
        </div>
        <div className='p-3'>
          {isTakeMedia && <Toggle type={type} emitValue={handleTypeEmit} />}
          {(capturedMedia || videoUrl) && !isTakeMedia && (
            <>
              <button
              className='w-12 h-12 bg-white text-gray-800 font-semibold rounded-full border border-gray-300 shadow-md hover:bg-gray-100 flex items-center justify-center'
              >
                <Icon type='qrcode' />
              </button>
              <p className='text-xs'>Play Again</p>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default MediaCapture;
