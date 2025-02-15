import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const solidColor = '#ff69b4'; // Change this to your preferred solid color

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);

  useEffect(() => {
    const loadResources = async () => {
      // Load BodyPix Model
      const model = await bodyPix.load();
      setBodyPixModel(model);

      // Access webcam
      const video = videoRef.current;
      if (video) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
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

  let lastTime = 0;

  const replaceBackground = async () => {
    if (!isProcessingReady || !bodyPixModel) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !video || !ctx) {
      return;
    }

    // Throttle FPS to ~30fps
    const now = performance.now();
    if (now - lastTime < 33) return;
    lastTime = now;

    // Get segmentation mask from BodyPix
    const segmentation = await bodyPixModel.segmentPerson(video, {
      internalResolution: 'high', // Higher for better accuracy
      segmentationThreshold: 0.8, // Adjust for better edge detection
    });

    // Generate RGBA mask with smooth edges
    const maskImageData = bodyPix.toMask(segmentation, { r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 0 });

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background with solid color
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw webcam feed onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply mask blending with smooth edges
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.putImageData(maskImageData, 0, 0);
      maskCtx.filter = 'blur(10px)';
    }

    // Apply the mask onto the main canvas
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    if (isProcessingReady && bodyPixModel) {
      const interval = setInterval(replaceBackground, 33); // Run at ~30fps
      return () => clearInterval(interval);
    }
  }, [isProcessingReady, bodyPixModel]);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline width="640" height="480" style={{ position: 'absolute', zIndex: -1, visibility: 'hidden' }} />
      <canvas ref={canvasRef} width='640' height='480' />
    </div>
  );
};

export default CameraPreview;
