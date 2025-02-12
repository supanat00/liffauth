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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frameType, setFrameType] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' or 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakeMedia, setIsTakeMedia] = useState(true);
  
  useEffect(() => {
    const random = Math.random();
    setFrameType(random < 0.7 ? 'normal' : 'secret');
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  // ✅ Efficiently Updates Canvas
  const updateCanvas = () => {
    if (!webcamRef.current || !canvasRef.current) return;

    const video = webcamRef.current.video as HTMLVideoElement;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== 4) return;

    // ✅ Set correct canvas size (once)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // ✅ Draw the webcam video
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // ✅ Draw the overlay frame
    const frame = new Image();
    frame.src = frameType === 'normal' ? normalFrame : secretFrame;
    frame.onload = () => ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const interval = setInterval(updateCanvas, 33); // Updates at ~30FPS
    return () => clearInterval(interval);
  }, [frameType]);

  // ✅ Capture Photo Without Delay
  const capturePhoto = () => {
    if (!canvasRef.current) return;

    const imageSrc = canvasRef.current.toDataURL();
    setCapturedMedia(imageSrc);
    setIsTakeMedia(false);
  };

  // ✅ Start Video Recording
  const startRecording = () => {
    if (!canvasRef.current) return;

    setIsRecording(true);
    setIsTakeMedia(true);

    const stream = canvasRef.current.captureStream(30); // ✅ Use existing preview canvas
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
      <h1>Random Frame App</h1>
      <div style={{ marginBottom: '50px' }}>
        {isTakeMedia ? (
        <div>
          {isLoading ? (
            <p className='text-lg font-semibold'>Selecting frame...</p>
          ) : (
          <div>
            <p>Selected Frame: {frameType}</p>
            {frameType && (
              <div style={{ border: '10px solid', padding: '10px', margin: '10px' }}>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat='image/jpeg'
                  videoConstraints={{ facingMode: 'user' }}
                  style={{ position: 'absolute', top: 0, left: 0, opacity: 0 }} // Hide original video
                />
                <canvas id='preview' ref={canvasRef} />
              </div>
            )}
          </div>
          )}
        </div>) : (
        <div>
          {videoUrl ? (
            <video controls autoPlay loop width="100%">
              <source src={videoUrl} type="video/webm" />
            </video>
          ) : (
            <img src={capturedMedia || ''} alt='Captured' />
          )}
        </div>
        )}
      </div>

      {/* Capture controls */}
      {isTakeMedia && (
        <div>
          <button className='px-4 py-2 m-2 bg-green-500 text-white rounded' onClick={() => setMediaType('photo')}>Take Photo</button>
          <button className='px-4 py-2 m-2 bg-blue-500 text-white rounded' onClick={() => setMediaType('video')}>Record Video</button>
        </div>
      )}

      {/* Capture/Record button */}
      {mediaType === 'photo' && isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-orange-500 text-white rounded' onClick={capturePhoto}>Capture Photo</button>
      )}
      {mediaType === 'video' && isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-red-500 text-white rounded' onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      )}

      {/* Retake/Replay button */}
      {(capturedMedia || videoUrl) && !isTakeMedia && (
        <button className='px-4 py-2 m-2 bg-yellow-500 text-white rounded' onClick={retakeMedia}>Retake</button>
      )}
    </div>
  );
};

export default MediaCapture;
