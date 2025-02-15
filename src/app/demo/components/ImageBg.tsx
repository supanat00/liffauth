import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const imgBg = '/frame/img/pink-bg.jpg'; // Change this to your background image

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);

  useEffect(() => {
    const loadResources = async () => {

      // Load BodyPix Model
      const model = await bodyPix.load();
      setBodyPixModel(model);

      // Load background image
      const bgImage = new Image();
      bgImage.src = imgBg;
      bgImage.onload = () => {
        backgroundImageRef.current = bgImage;
      };

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

    if (!canvas || !video || !ctx || !backgroundImageRef.current) {
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

    // Generate RGBA mask and dilate the edges
    const mask = bodyPix.toMask(segmentation, { r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 0 });

    // Expand mask by dilating it
    const dilatedMask = document.createElement('canvas');
    dilatedMask.width = canvas.width;
    dilatedMask.height = canvas.height;
    const maskCtx = dilatedMask.getContext('2d');

    if (maskCtx) {
        maskCtx.putImageData(mask, 0, 0);
        maskCtx.filter = 'blur(10px)'; // Increase this to expand the space
        maskCtx.drawImage(dilatedMask, -5, -5, canvas.width + 10, canvas.height + 10); // Expand mask outward
    }

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image first (Behind Person)
    ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);

    // Create an offscreen canvas for applying the mask
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    if (offscreenCtx) {
      // Draw webcam feed onto the offscreen canvas
      offscreenCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Apply mask blending
      offscreenCtx.globalCompositeOperation = 'destination-in';
      offscreenCtx.drawImage(dilatedMask, 0, 0);

      // Draw final blended image onto the main canvas
      ctx.drawImage(offscreenCanvas, 0, 0);
    }
  };

  useEffect(() => {
    if (isProcessingReady && bodyPixModel) {
      const interval = setInterval(replaceBackground, 33); // Run at ~30fps
      return () => clearInterval(interval);
    }
  }, [isProcessingReady, bodyPixModel]);

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} width='640' height='480' />
    </div>
  );
};

export default CameraPreview;
