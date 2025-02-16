import React, { useRef, useEffect, useState } from 'react';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import Icon from '@/components/Icon';
import UploadToS3 from '@/components/UploadToS3';
import Toggle from '@/components/Toggle';

interface MediaCaptureProps {
  isSecret: boolean;
  artistName: string;
}

const solidWhiteColor = '#ffffff'; // White background
const solidPinkColor = '#ffb3c3'; // Soft pink background
const frameNormal = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/normal/standard${String(i).padStart(4, '0')}.png`);
const frameSecret = Array.from({ length: 30 }, (_, i) => `/frame/png-seq/secret/khunpol/secret layer 1${String(i).padStart(4, '0')}.png`);

// Set PNG Frame Size (3:4 Aspect Ratio)
const frameWidth = 350;
const frameHeight = 600;

// Reduce Camera Preview to Fit Inside PNG Frame
const cameraWidth = 350;  // Smaller than frameWidth
const cameraHeight = 600; // Maintain 3:4 ratio

const CameraPreview: React.FC<MediaCaptureProps> = ({ isSecret, artistName }) => {
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
    ctx.fillStyle = (isSecret ? solidWhiteColor : solidPinkColor);
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
    ctx.fillStyle = (isSecret ? solidWhiteColor : solidPinkColor);
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
        {isTakeMedia && <>
          <video ref={videoRef} autoPlay playsInline width='350' height='600' style={{ position: 'absolute', zIndex: -1, visibility: 'hidden' }} />
          <canvas ref={canvasRef} width='350' height='600' />
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

export default CameraPreview;
