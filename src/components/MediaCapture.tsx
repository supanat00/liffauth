'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';
import html2canvas from 'html2canvas';

const normalFrame = '/frame/KP_Layer_2-1.png';
const secretFrame = '/frame/KP_Layer_4-1.png';

const MediaCapture = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [frameType, setFrameType] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' or 'video'
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakeMedia, setIsTakeMedia] = useState(true);

  // Randomly select frame type (70% normal, 30% secret)
  useEffect(() => {
    const random = Math.random();
    setFrameType(random < 0.7 ? 'normal' : 'secret');
  }, []);

  useEffect(() => {
    const loadModel = async () => {
      const model = await bodyPix.load();
      setBodyPixModel(model);
    };
    loadModel();
  }, []);

  const processFrame = async () => {
    if (bodyPixModel && webcamRef.current && canvasRef.current) {
      const video = webcamRef.current.video as HTMLVideoElement;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (video.readyState === 4) {
        const segmentation = await bodyPixModel.segmentPerson(video, {
          internalResolution: 'medium',
          segmentationThreshold: 0.7,
        });
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // remove mask
          bodyPix.drawMask(canvas, video, null, 0.7, 0, false);
        }
      }
    }
    const frame = new Image();
    frame.src = frameType === 'normal' ? normalFrame : secretFrame; // Customize frame image
    // load image only one time
    let imageLoaded = false;
    frame.onload = () => {
      imageLoaded = true;
    };
    const drawFrame = () => {
      if (canvasRef.current && imageLoaded) {
        const ctxFrame = canvasRef.current.getContext('2d');
        if (ctxFrame) {
          ctxFrame.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      requestAnimationFrame(drawFrame); // repeat call
    };
    requestAnimationFrame(drawFrame);
    requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (bodyPixModel) processFrame();
  }, [bodyPixModel]);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }, []);

  // Handle photo capture
  const capturePhoto = () => {
    // capture from preview
    const element = document.getElementById('preview'); // Replace with your target element's ID
    if (element) {
      html2canvas(element).then((canvas) => {
        const imageSrc = canvas.toDataURL(); // Converts canvas to image URL
        // Optionally, display the captured image in an <img> tag or elsewhere
        const previewElement = document.getElementById('preview') as HTMLImageElement; // The preview image ID
        if (previewElement) {
          previewElement.src = imageSrc; // Set the image URL to the preview
          setCapturedMedia(imageSrc);
          setIsTakeMedia(false);
        }
      });
    }
  };

  // Handle video recording start
  const startRecording = () => {
    if (!webcamRef.current || !webcamRef.current.video) {
      return;
    }  
    setIsRecording(true);
    setIsTakeMedia(true);
    const videoElement = webcamRef.current.video as HTMLVideoElement;  
    // Create a hidden canvas for overlay
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");  
    if (!ctx) {
      setIsRecording(false);
      return;
    }  
    // Set canvas size to match webcam video
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;  
    // Load the frame PNG
    const frame = new Image();
    frame.src = frameType === "normal" ? normalFrame : secretFrame;  
    // Capture frames at 30 FPS
    const stream = canvas.captureStream(30); // Capture from canvas
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });  
    let chunks: Blob[] = [];  
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };  
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      setIsTakeMedia(false);
    };  
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();  
    let recording = true;
    const captureFrame = () => {
      if (!recording) return;  
      // Draw webcam video on canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);  
      // Draw PNG frame on top
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);  
      requestAnimationFrame(captureFrame);
    };  
    frame.onload = () => {
      requestAnimationFrame(captureFrame);
    };
  };
  
  // Handle stop record video
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsTakeMedia(false);
    }
  };  

  // Handle replay/retake
  const retakeMedia = () => {
    setCapturedMedia(null);
    setVideoUrl(null);
    setRecordedChunks([]);
    setIsTakeMedia(true);
  };

  // Display captured photo or video
  const renderCapturedMedia = () => {
    if (mediaType === 'photo' && capturedMedia) {
      return <img src={capturedMedia} alt='Captured' />;
    } else if(mediaType === 'video' && videoUrl) {
      return (
        <video controls autoPlay loop width="100%">
          <source src={videoUrl} type="video/webm" />
        </video>
      );
    }
    return null;
  };

  return (
    <div>
      <h1>Random Frame App</h1>
      <div style={{ marginBottom: '50px' }}>
        {isTakeMedia ? (
        <div>
          {isLoading ? (
            <p className='text-lg font-semibold'>Selecting frame...</p>
          ) : (
          <div>
            <p>Selected Frame: {frameType}</p>
            {/* Display random graphic based on frame type */}
            {frameType && (
              <div style={{ border: '10px solid', padding: '10px', margin: '10px' }}>
                {frameType === 'normal' ? (
                  <p>Normal Frame</p>
                ) : (
                  <p>Secret Frame</p>
                )}
                <div style={{ width: '100%' }}>
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat='image/jpeg'
                    width='50%'
                    videoConstraints={{ facingMode: 'user' }}
                    style={{ position: 'absolute', top: 0, left: 0, opacity: 0 }} // Hide original video
                  />
                  <canvas id='preview' ref={canvasRef} />
                </div>
              </div>
            )}
          </div>
          )}
        </div>) : (
        <div>
          {/* Display captured media */}
          {renderCapturedMedia()}
        </div>
        )}
      </div>

      {/* Capture controls */}
      {isTakeMedia ? (<div>
        <button className='px-4 py-2 m-2 bg-green-500 text-white rounded' onClick={() => setMediaType('photo')}>Take Photo</button>
        <button className='px-4 py-2 m-2 bg-blue-500 text-white rounded' onClick={() => setMediaType('video')}>Record Video</button>
      </div>) : null}

      {/* Capture/Record button */}
      {mediaType === 'photo' && isTakeMedia ? (
        <button className='px-4 py-2 m-2 bg-orange-500 text-white rounded' onClick={capturePhoto}>Capture Photo</button>
      ) : null}
      {mediaType === 'video' && isTakeMedia ? (
        <button className='px-4 py-2 m-2 bg-red-500 text-white rounded' onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      ) : null}

      {/* Retake/Replay button */}
      {(capturedMedia || recordedChunks.length > 0 || videoUrl) && !isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-yellow-500 text-white rounded' onClick={retakeMedia}>Retake</button>
      )}
    </div>
  );
};

export default MediaCapture;
