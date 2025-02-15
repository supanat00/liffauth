import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const solidColor = '#ffb3c3'; // Soft pink background
const frameSecret = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/secret/khunpol/secret layer 1${String(i).padStart(4, '0')}.png`);

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const [pngFrames, setPngFrames] = useState<HTMLImageElement[]>([]);
  const frameIndex = useRef(0);

  useEffect(() => {
    const loadResources = async () => {
      const model = await bodyPix.load();
      setBodyPixModel(model);

      const video = videoRef.current;
      if (video) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 350, height: 600 } });
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
    const loadImages = async () => {
      const images = await Promise.all(
        frameSecret.map((src) => {
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
  
    const segmentation = await bodyPixModel.segmentPerson(video, {
      internalResolution: 'high',
      segmentationThreshold: 0.8,
    });
  
    const maskImageData = bodyPix.toMask(
      segmentation,
      { r: 255, g: 255, b: 255, a: 255 },  // White mask for the person
      { r: 0, g: 0, b: 0, a: 0 }  // Transparent background
    );
  
    // 1. **Clear the canvas**
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // 2. **Apply solid background color (MUST be first)**
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // 3. **Draw the person on top (video feed)**
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    // 4. **Create a separate mask canvas**
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.putImageData(maskImageData, 0, 0);
    }
  
    // 5. **Apply the mask to keep only the person**
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
  
    // 6. **Reapply the solid color BEHIND the person (ensures no white areas)**
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // 7. **Reset composite mode & overlay PNG frame**
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

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline width='350' height='600' style={{ position: 'absolute', zIndex: -1, visibility: 'hidden' }} />
      <canvas ref={canvasRef} width='350' height='600' />
    </div>
  );
};

export default CameraPreview;
