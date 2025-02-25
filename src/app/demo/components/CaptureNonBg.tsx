'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

interface MediaCaptureProps {
  isSecret: boolean;
  artistName: string;
}

// Preload PNG Frames (3:4 Aspect Ratio)
const frameNormal = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/normal/standard${String(i).padStart(4, '0')}.png`);
const frameSecret = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/secret/khunpol/secret layer 1${String(i).padStart(4, '0')}.png`);

const loadedFrames: HTMLImageElement[] = [];

const MediaCapture: React.FC<MediaCaptureProps> = ({ isSecret, artistName }) => {
  const webcamRef = useRef<Webcam>(null);
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

  const handleTypeEmit = (value: boolean) => {
    setType(!value ? 'video' : 'photo');
  };

  // Set PNG Frame Size (3:4 Aspect Ratio)
  const frameWidth = 350;
  const frameHeight = 600;

  // Reduce Camera Preview to Fit Inside PNG Frame
  const cameraWidth = 350;  // Smaller than frameWidth
  const cameraHeight = 600; // Maintain 3:4 ratio

  useEffect(() => {
    const loadBodyPix = async () => {
      const model = await bodyPix.load();
      setBodyPixModel(model);
    };
    loadBodyPix();
  }, []);

  useEffect(() => {
    // Preload all frames into memory
    let loadedCount = 0;
    // if(framePaths) {
      (isSecret ? frameSecret : frameNormal).forEach((src, i) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          loadedFrames[i] = img;
          loadedCount++;
        };
      });
    // }
  }, []);

  // Cycle through PNG frames at correct speed
  useEffect(() => {
    const frameInterval = setInterval(() => {
      setFrameIndex((prevIndex) => (prevIndex + 1) % ((isSecret ? frameSecret : frameNormal) ? (isSecret ? frameSecret : frameNormal).length : 1));
    }, 100);

    return () => clearInterval(frameInterval);
  }, []);

  // Update Canvas: Keep PNG Full Size, Reduce Camera Preview
  const updateCanvas = () => {
    if (!webcamRef.current || !canvasRef.current) return;

    const video = webcamRef.current.video as HTMLVideoElement;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== 4) return;

    // Set Canvas Size to Match PNG Frame
    canvas.width = frameWidth;
    canvas.height = frameHeight;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Webcam Preview Smaller Than PNG Frame
    const camX = (canvas.width - cameraWidth) / 2;
    const camY = (canvas.height - cameraHeight) / 2;
    ctx.drawImage(video, camX, camY, cameraWidth, cameraHeight);

    // Draw PNG Frame Without Stretching (Centered)
    if (loadedFrames[frameIndex]) {
      ctx.drawImage(loadedFrames[frameIndex], 0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    const interval = setInterval(updateCanvas, 33);
    return () => clearInterval(interval);
  }, [frameIndex]);

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
  const retakeMedia = () => {
    setCapturedMedia(null);
    setVideoUrl(null);
    setIsTakeMedia(true);
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
      <div>
        {isTakeMedia && (<div style={{
          position: 'relative',
          width: `${frameWidth}px`,
          height: `${frameHeight}px`
        }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat='image/jpeg'
            videoConstraints={{
              width: cameraWidth,
              height: cameraHeight,
              aspectRatio: 3 / 4,
              facingMode: 'user',
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${cameraWidth}px`,
              height: `${cameraHeight}px`,
              transform: 'translate(-50%, -50%)', // Center it within the frame
              objectFit: 'cover',
              opacity: 0, // Hide original video
            }}
          />
          <canvas id='preview' ref={canvasRef} style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }} />
        </div>)}
        
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
      </div>
      
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
              <UploadToS3 downloadMedia={(capturedMedia ? capturedMedia : videoUrl)} videoType='' uploadMedia={fileUpload} artistName={artistName} />
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
