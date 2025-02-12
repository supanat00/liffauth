'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as bodyPix from '@tensorflow-models/body-pix';
import '@tensorflow/tfjs';

const normalFrame = '/frame/khunpol-layer-1.gif'; // Normal GIF frame
const secretFrame = '/frame/khunpol-layer-1.gif'; // Secret GIF frame

const BACKGROUND_COLOR = '#2D2D2D'; // Solid background color

const MediaCapture = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [frameType, setFrameType] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' or 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [isTakeMedia, setIsTakeMedia] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    console.log("Setting frame type...");
    setFrameType(Math.random() < 0.7 ? 'normal' : 'secret');
  }, []);

  useEffect(() => {
    console.log("Loading BodyPix model...");
    const loadModel = async () => {
      const model = await bodyPix.load();
      setBodyPixModel(model);
      console.log("BodyPix model loaded!");
    };
    loadModel();
  }, []);

  // ✅ Load GIF Image Correctly
  useEffect(() => {
    console.log("Loading GIF image...");
    frameImgRef.current = new Image();
    frameImgRef.current.src = frameType === 'normal' ? normalFrame : secretFrame;
    frameImgRef.current.onload = () => {
      setIsLoaded(true);
      console.log("GIF Loaded:", frameImgRef.current?.src);
    };
  }, [frameType]);

  // ✅ Process Camera Frame & Remove Background
  const processFrame = async () => {
    if (!bodyPixModel || !webcamRef.current || !canvasRef.current) {
      requestAnimationFrame(processFrame);
      return;
    }

    const video = webcamRef.current.video as HTMLVideoElement;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== 4) {
      requestAnimationFrame(processFrame);
      return;
    }

    console.log("Processing frame...");

    // ✅ Set canvas size to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // ✅ Get segmentation from BodyPix
    const segmentation = await bodyPixModel.segmentPerson(video, {
      internalResolution: 'medium',
      segmentationThreshold: 0.7,
    });

    // ✅ Create a mask with transparency for background
    const mask = bodyPix.toMask(segmentation, { r: 0, g: 0, b: 0, a: 0 }, { r: 255, g: 255, b: 255, a: 255 });

    // ✅ Clear canvas & draw solid background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ✅ Draw the webcam video with the segmented person
    bodyPix.drawMask(canvas, video, mask, 1, 0, false);

    requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (bodyPixModel) {
      console.log("Starting processFrame...");
      requestAnimationFrame(processFrame);
    }
  }, [bodyPixModel]);

  const capturePhoto = () => {
    // ✅ Ensure canvas and GIF frame exist before capturing
    if (!canvasRef.current) {
      console.warn("Canvas reference is null!");
      return;
    }
    if (!frameImgRef.current) {
      console.warn("GIF frame reference is null!");
      return;
    }
  
    // ✅ Create a new temporary canvas for capturing the snapshot
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
  
    if (!tempCtx) {
      console.warn("Canvas context is null!");
      return;
    }
  
    // ✅ Match the size of the preview canvas
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
  
    // ✅ Ensure the GIF is fully drawn before capturing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!canvasRef.current || !frameImgRef.current) {
          console.warn("Canvas or GIF frame became null before capture!");
          return;
        }
  
        // ✅ Capture the current processed webcam feed (segmented person)
        tempCtx.drawImage(canvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
  
        // ✅ Overlay the animated GIF frame on the snapshot
        tempCtx.drawImage(frameImgRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
  
        // ✅ Convert the new canvas to a PNG image
        const imageSrc = tempCanvas.toDataURL("image/png");
  
        // ✅ Save the captured photo with the frame at the exact displayed moment
        setCapturedMedia(imageSrc);
        setIsTakeMedia(false);
      });
    });
  };  

  // ✅ Start Video Recording
  const startRecording = () => {
    if (!canvasRef.current || !frameImgRef.current || !webcamRef.current) {
      console.warn("Canvas, GIF frame, or webcam reference is null! Cannot start recording.");
      return;
    }
  
    setIsRecording(true);
    setIsTakeMedia(true);
  
    // ✅ Create an offscreen recording canvas
    const recordCanvas = document.createElement("canvas");
    const recordCtx = recordCanvas.getContext("2d");
  
    if (!recordCtx) {
      console.warn("Failed to create recording canvas context.");
      return;
    }
  
    // ✅ Set the size of the recording canvas to match the webcam feed
    recordCanvas.width = canvasRef.current.width;
    recordCanvas.height = canvasRef.current.height;
  
    // ✅ Capture stream from the recording canvas
    const stream = recordCanvas.captureStream(30); // 30 FPS
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
  
    // ✅ Continuously draw the segmented webcam feed and GIF on the recording canvas
    const drawFrame = () => {
      if (!canvasRef.current || !frameImgRef.current || !isRecording) return;
  
      const video = webcamRef.current?.video;
      if (!video || video.readyState !== 4) return;
  
      // ✅ Clear the recording canvas
      recordCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
  
      // ✅ Draw a solid background
      recordCtx.fillStyle = "#2D2D2D"; // Background color
      recordCtx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);
  
      // ✅ Draw the segmented person from the preview canvas
      recordCtx.drawImage(canvasRef.current, 0, 0, recordCanvas.width, recordCanvas.height);
  
      // ✅ Draw the animated GIF overlay
      recordCtx.drawImage(frameImgRef.current, 0, 0, recordCanvas.width, recordCanvas.height);
  
      // ✅ Continue drawing frames until recording stops
      if (isRecording) {
        requestAnimationFrame(drawFrame);
      }
    };
  
    requestAnimationFrame(drawFrame);
  };  

  // ✅ Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsTakeMedia(false);
    }
  };

  // ✅ Retake Media
  const retakeMedia = () => {
    setCapturedMedia(null);
    setVideoUrl(null);
    setIsTakeMedia(true);
  };

  return (
    <div>
      <h1>Background Removal Debugging</h1>

      <div style={{ position: "relative", width: "100%", maxWidth: "640px", height: "480px", marginBottom: '50px' }}>
        <p>Selected Frame: {frameType}</p>

        {isTakeMedia ? <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {/* Webcam */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat='image/jpeg'
            videoConstraints={{ facingMode: 'user' }}
            style={{ position: 'absolute', top: 0, left: 0, width: "100%", height: "100%", opacity: 1 }}
          />

          {/* Canvas */}
          <canvas id='preview' ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "transparent" }} />

          {/* ✅ Animated GIF Overlay (Fixes GIF Not Animating) */}
          {isLoaded && (
            <img
              src={frameType === 'normal' ? normalFrame : secretFrame}
              alt="Animated Frame"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none", // Prevents blocking interactions
              }}
            />
          )}
        </div> :
        <div>
          {videoUrl ? (
            <video controls autoPlay loop width="100%">
              <source src={videoUrl} type="video/webm" />
            </video>
          ) : (
            capturedMedia && <img src={capturedMedia} alt='Captured'
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none"
            }} />
          )}
        </div>
        }
      </div>

      {/* Capture controls */}
      {isTakeMedia && (
        <div>
          <button className='px-4 py-2 m-2 bg-green-500 text-white rounded' onClick={() => setMediaType('photo')}>
            Take Photo
          </button>
          <button className='px-4 py-2 m-2 bg-blue-500 text-white rounded' onClick={() => setMediaType('video')}>
            Record Video
          </button>
        </div>
      )}

      {/* Capture/Record button */}
      {mediaType === 'photo' && isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-orange-500 text-white rounded' onClick={capturePhoto}>
          Capture Photo
        </button>
      )}
      {mediaType === 'video' && isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-red-500 text-white rounded' onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      )}

      {/* Retake button */}
      {(capturedMedia || videoUrl) && !isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-yellow-500 text-white rounded' onClick={retakeMedia}>
          Retake
        </button>
      )}
    </div>
  );
};

export default MediaCapture;
