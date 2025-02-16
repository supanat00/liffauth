import React, { useState, useRef, useEffect } from 'react';

const CameraZoom = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(10);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];

        // Get the camera capabilities
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities;

        // Ensure zoom is an object with min and max
        if ('zoom' in capabilities && typeof capabilities.zoom === 'object') {
          const zoomCapabilities = capabilities.zoom as { min: number; max: number; step?: number };

          const minZoom = zoomCapabilities.min ?? 1;
          const maxZoomValue = zoomCapabilities.max ?? 1;

          setMaxZoom(maxZoomValue);
          setZoomLevel(minZoom);
        }

        videoRef.current!.srcObject = stream;
        videoRef.current!.play();
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    setupCamera();
  }, []);

  const handleZoomChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(event.target.value);
    setZoomLevel(newZoom);

    const stream = videoRef.current!.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];

    try {
      await videoTrack.applyConstraints({
        advanced: [{ zoom: newZoom }] as unknown as MediaTrackConstraintSet[], // TypeScript workaround
      });
    } catch (error) {
      console.error('Failed to apply zoom:', error);
    }
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: 'auto' }} />
      <input
        type="range"
        min="-1"
        max={maxZoom}
        step="0.1"
        value={zoomLevel}
        onChange={handleZoomChange}
        // disabled={maxZoom === 1} // Disable if zoom is not supported
      />
      <p>Zoom: {zoomLevel.toFixed(1)}x</p>
    </div>
  );
};

export default CameraZoom;
