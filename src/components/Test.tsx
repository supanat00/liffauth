import React, { useRef, useEffect, useState } from "react";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const [bodyPixModel, setBodyPixModel] = useState<bodyPix.BodyPix | null>(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);

  useEffect(() => {
    const loadResources = async () => {
      console.log("🔄 Loading resources...");

      // Load BodyPix Model
      const model = await bodyPix.load();
      setBodyPixModel(model);
      console.log("✅ BodyPix Model Fully Loaded");

      // Load background image
      const bgImage = new Image();
      bgImage.src = "/frame/img/test-bg.png"; // Change this to your background image
      bgImage.onload = () => {
        backgroundImageRef.current = bgImage;
        console.log("✅ Background Image Fully Loaded:", bgImage.src);
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
          console.log("✅ Webcam is Ready");
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
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !video || !ctx || !backgroundImageRef.current) {
      console.log("❌ Skipping frame: Resources not ready.");
      return;
    }

    // Throttle FPS to ~30fps
    const now = performance.now();
    if (now - lastTime < 33) return;
    lastTime = now;

    // Get segmentation mask from BodyPix
    const segmentation = await bodyPixModel.segmentPerson(video, {
      internalResolution: "low",
      segmentationThreshold: 0.7, // Adjust for better results
    });

    // Draw background image first (Behind Person)
    ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);

    // Get video frame and pixels
    const videoFrame = document.createElement("canvas");
    videoFrame.width = canvas.width;
    videoFrame.height = canvas.height;
    const videoCtx = videoFrame.getContext("2d");
    videoCtx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get pixel data from video
    const videoPixels = videoCtx?.getImageData(0, 0, canvas.width, canvas.height);
    if (!videoPixels) return;

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;

    // Apply segmentation mask (Only show person)
    for (let i = 0; i < pixels.length; i += 4) {
      if (segmentation.data[i / 4] === 1) {
        // If the pixel belongs to the person, replace it with the video frame
        pixels[i] = videoPixels.data[i]; // Red
        pixels[i + 1] = videoPixels.data[i + 1]; // Green
        pixels[i + 2] = videoPixels.data[i + 2]; // Blue
        pixels[i + 3] = videoPixels.data[i + 3]; // Alpha
      }
    }

    // Update canvas with new frame
    ctx.putImageData(frame, 0, 0);

    // Debug pixel data
    // console.log("📌 Frame Pixel Check:", frame.data.slice(0, 100));
  };

  useEffect(() => {
    if (isProcessingReady && bodyPixModel) {
      const interval = setInterval(replaceBackground, 33); // Run at ~30fps
      return () => clearInterval(interval);
    }
  }, [isProcessingReady, bodyPixModel]);

  return (
    <div>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} width="640" height="480" />
    </div>
  );
};

export default CameraPreview;
