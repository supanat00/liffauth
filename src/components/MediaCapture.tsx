'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

interface MediaCaptureProps {
  isSecret: boolean; // Define type for isSecret
}

// Preload PNG Frames (3:4 Aspect Ratio)
const frameNormal = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/normal/standard${String(i).padStart(4, '0')}.png`);
const frameSecret = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/secret/khunpol/secret layer 1${String(i).padStart(4, '0')}.png`);

const loadedFrames: HTMLImageElement[] = [];

const MediaCapture : React.FC<MediaCaptureProps> = ({ isSecret }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTakeMedia, setIsTakeMedia] = useState(true);

  // Set PNG Frame Size (3:4 Aspect Ratio)
  const frameWidth = 350;
  const frameHeight = 600;

  // Reduce Camera Preview to Fit Inside PNG Frame
  const cameraWidth = 350;  // Smaller than frameWidth
  const cameraHeight = 600; // Maintain 3:4 ratio

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

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCanvas.width = frameWidth;
    tempCanvas.height = frameHeight;

    setTimeout(() => {
      if (!canvasRef.current) return;

      tempCtx.drawImage(canvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);

      const imageSrc = tempCanvas.toDataURL("image/png");
      setCapturedMedia(imageSrc);
      setIsTakeMedia(false);
    }, 50);
  };

  // Start Video Recording (Includes PNG Overlay)
  const startRecording = () => {
    if (!canvasRef.current) return;

    setIsRecording(true);
    setIsTakeMedia(true);

    const stream = canvasRef.current.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    let chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      setIsTakeMedia(false);
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

  return (
    <div>
      <div style={{ marginTop: '50px' }}>
        {isTakeMedia ? (<div style={{
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
        </div>) : null }
        
        <div>
          {videoUrl ? (
            <video controls autoPlay loop width="100%">
              <source src={videoUrl} type="video/webm" />
            </video>
          ) : null}
          {capturedMedia ? (
            <img src={capturedMedia || ''} alt='Captured' />
          ) : null}
        </div>
      </div>

      {/* Capture controls */}
      {isTakeMedia && (
        <div>
          <button className='px-4 py-2 m-2 bg-green-500 text-white rounded' onClick={capturePhoto}>Take Photo</button>
          <button className='px-4 py-2 m-2 bg-blue-500 text-white rounded' onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? 'Stop Recording' : 'Record Video'}
          </button>
        </div>
      )}

      {/* Retake button */}
      {(capturedMedia || videoUrl) && !isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-yellow-500 text-white rounded' onClick={retakeMedia}>Retake</button>
      )}
    </div>
  );
};

export default MediaCapture;
