import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const imgBg = '/frame/img/pink-bg.jpg'; // Background image
const pngSequencePath = '/frame/png-seq/secret/khunpol/secret layer 1'; // PNG sequence path

const TOTAL_FRAMES = 30; // Total frames in sequence
const FRAME_RATE = 100; // Animation speed in ms per frame

// Set PNG Frame Size (3:4 Aspect Ratio)
const frameWidth = 350;
const frameHeight = 600;

// Reduce Camera Preview to Fit Inside PNG Frame
const cameraWidth = 350;
const cameraHeight = 600;

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const pngFramesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    const loadResources = async () => {
      const model = await bodyPix.load();
      setBodyPixModel(model);

      // Load background image
      const bgImage = new Image();
      bgImage.src = imgBg;
      bgImage.onload = () => {
        backgroundImageRef.current = bgImage;
      };

      // Load PNG sequence
      const frames: HTMLImageElement[] = [];
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = `${pngSequencePath}${String(i).padStart(4, '0')}.png`; // Zero-padded filenames
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

  return (
    <div style={{ width: frameWidth, height: frameHeight, position: 'relative' }}>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} width={frameWidth} height={frameHeight} />
    </div>
  );
};

export default CameraPreview;
