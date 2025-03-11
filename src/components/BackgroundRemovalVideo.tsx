import { useRef, useEffect } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const BackgroundRemovalVideo = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const startCamera = async () => {
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
        };
      }
    };
    
    const removeBackground = async () => {
      const net = await bodyPix.load();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const processFrame = async () => {
        if (!video.paused && !video.ended) {
          const segmentation = await net.segmentPerson(video, {
            internalResolution: 'high',
            segmentationThreshold: 0.7,
            flipHorizontal: false,
            scoreThreshold: 0.2,
            maxDetections: 2,
          });

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = frame.data;

          const maskData = segmentation.data;
          const width = canvas.width;
          const height = canvas.height;
          const flippedMask = new Uint8Array(maskData.length);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const originalIdx = y * width + x;
              const flippedIdx = y * width + (width - x - 1);
              flippedMask[flippedIdx] = maskData[originalIdx];
            }
          }

          for (let i = 0; i < pixels.length; i += 4) {
            const isPerson = flippedMask[i / 4];
            if (!isPerson) {
              pixels[i + 3] = 0;
            }
          }

          ctx.putImageData(frame, 0, 0);
          requestAnimationFrame(processFrame);
        }
      };

      processFrame();
    };

    startCamera().then(() => {
      removeBackground();
    });

    return () => {
      if (videoRef.current && videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className='relative w-full h-full'>
      <video ref={videoRef} className='hidden' />
      <canvas ref={canvasRef} className='w-full h-full' style={{ backgroundColor: 'transparent' }} />
    </div>
  );
};

export default BackgroundRemovalVideo;
