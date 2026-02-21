import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PersonTracker, TrackedPerson, findPersonAtPoint, Detection } from '@/lib/tracker';
import { renderWithSelectiveBlur } from '@/lib/blurRenderer';
import { Camera, Upload, X, Focus, Users, Zap, AlertCircle, Loader2 } from 'lucide-react';

type InputMode = 'none' | 'camera' | 'file';
type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

const SmartFocusTracker: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number>(0);
  const trackerRef = useRef(new PersonTracker());
  const modelRef = useRef<any>(null);

  const [inputMode, setInputMode] = useState<InputMode>('none');
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [trackedPersons, setTrackedPersons] = useState<TrackedPerson[]>([]);
  const [fps, setFps] = useState(0);
  const [blurAmount, setBlurAmount] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);

  const lastFrameTime = useRef(0);
  const frameCount = useRef(0);
  const fpsInterval = useRef<NodeJS.Timer>();

  // Load COCO-SSD model
  const loadModel = useCallback(async () => {
    if (modelRef.current) return;
    setModelStatus('loading');
    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      // Set backend
      if (tf.getBackend() !== 'webgl') {
        try { await tf.setBackend('webgl'); } catch { /* fallback */ }
      }
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      setModelStatus('ready');
    } catch (err) {
      console.error('Model load error:', err);
      setModelStatus('error');
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    await loadModel();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setInputMode('camera');
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  }, [loadModel]);

  // Load video file
  const loadVideoFile = useCallback(async (file: File) => {
    await loadModel();
    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.loop = true;
      videoRef.current.play();
      setInputMode('file');
    }
  }, [loadModel]);

  // Stop input
  const stopInput = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      videoRef.current.src = '';
    }
    cancelAnimationFrame(animFrameRef.current);
    trackerRef.current.reset();
    setInputMode('none');
    setSelectedPersonId(null);
    setTrackedPersons([]);
    setIsProcessing(false);
  }, []);

  // Detection + render loop
  useEffect(() => {
    if (inputMode === 'none' || modelStatus !== 'ready') return;

    let running = true;
    let detectEveryN = 3; // detect every N frames for performance
    let frameIdx = 0;
    let lastDetections: Detection[] = [];

    const loop = async () => {
      if (!running) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.paused || video.ended || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      canvas.width = canvas.clientWidth * (window.devicePixelRatio > 1 ? 1.5 : 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio > 1 ? 1.5 : 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      frameIdx++;
      frameCount.current++;

      // Run detection periodically
      if (frameIdx % detectEveryN === 0 && modelRef.current) {
        setIsProcessing(true);
        try {
          const predictions = await modelRef.current.detect(video, 10, 0.3);
          lastDetections = predictions
            .filter((p: any) => p.class === 'person')
            .map((p: any, i: number) => ({
              id: i,
              bbox: p.bbox as [number, number, number, number],
              score: p.score,
              class: p.class,
            }));
        } catch {
          // ignore detection errors
        }
        setIsProcessing(false);
      }

      // Update tracker
      const persons = trackerRef.current.update(lastDetections);
      setTrackedPersons([...persons]);

      // Check if selected person still exists
      if (selectedPersonId !== null && !persons.find(p => p.id === selectedPersonId)) {
        // Keep selected for a few frames in case of temporary occlusion
        // The tracker handles this internally with maxAge
      }

      // Render
      renderWithSelectiveBlur(ctx, video, canvas, persons, selectedPersonId, blurAmount);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    // FPS counter
    fpsInterval.current = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(fpsInterval.current as any);
    };
  }, [inputMode, modelStatus, selectedPersonId, blurAmount]);

  // Handle click on canvas to select person
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const person = findPersonAtPoint(
      trackerRef.current.getTracked(),
      x * (canvas.width / rect.width),
      y * (canvas.height / rect.height),
      canvas.width,
      canvas.height,
      video.videoWidth,
      video.videoHeight
    );

    if (person) {
      setSelectedPersonId(prev => prev === person.id ? null : person.id);
    } else {
      setSelectedPersonId(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Control Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {inputMode === 'none' ? (
            <>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-mono text-sm hover:opacity-90 transition-opacity glow-primary"
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-mono text-sm hover:bg-muted transition-colors border border-border"
              >
                <Upload className="w-4 h-4" />
                Load Video
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) loadVideoFile(file);
                }}
              />
            </>
          ) : (
            <button
              onClick={stopInput}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground font-mono text-sm hover:opacity-90 transition-opacity"
            >
              <X className="w-4 h-4" />
              Stop
            </button>
          )}

          {selectedPersonId !== null && (
            <button
              onClick={() => setSelectedPersonId(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-muted-foreground font-mono text-xs hover:text-foreground transition-colors border border-border"
            >
              <X className="w-3 h-3" />
              Clear Focus
            </button>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          {modelStatus === 'loading' && (
            <span className="flex items-center gap-1.5 text-warning">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading AI Model...
            </span>
          )}
          {modelStatus === 'ready' && (
            <span className="flex items-center gap-1.5 text-success">
              <Zap className="w-3 h-3" />
              Model Ready
            </span>
          )}
          {modelStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="w-3 h-3" />
              Model Error
            </span>
          )}
          {inputMode !== 'none' && (
            <>
              <span className="flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {trackedPersons.length} detected
              </span>
              <span className="flex items-center gap-1.5">
                <Focus className="w-3 h-3" />
                {selectedPersonId !== null ? `Tracking #${selectedPersonId}` : 'Click to focus'}
              </span>
              <span>{fps} FPS</span>
            </>
          )}
        </div>
      </div>

      {/* Blur control */}
      {inputMode !== 'none' && (
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>Blur:</span>
          <input
            type="range"
            min={5}
            max={30}
            value={blurAmount}
            onChange={e => setBlurAmount(Number(e.target.value))}
            className="w-32 accent-primary"
          />
          <span>{blurAmount}px</span>
        </div>
      )}

      {/* Video / Canvas area */}
      <div className="relative flex-1 rounded-lg overflow-hidden border border-border bg-secondary/50">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
        />

        {/* Scanline overlay */}
        {inputMode !== 'none' && (
          <div className="absolute inset-0 scanline pointer-events-none" />
        )}

        {/* Empty state */}
        {inputMode === 'none' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-grid">
            <div className="relative">
              <Focus className="w-16 h-16 text-primary animate-pulse-glow" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary/20 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-foreground font-medium">Smart Auto Focus System</p>
              <p className="text-muted-foreground text-sm max-w-sm">
                Start your camera or load a video file. Click on any person to lock focus — everything else will be blurred.
              </p>
            </div>
          </div>
        )}

        {/* Tracking indicator overlay */}
        {selectedPersonId !== null && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="font-mono text-xs text-primary text-glow">
              LOCKED — Person #{selectedPersonId}
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {inputMode !== 'none' && trackedPersons.length > 0 && selectedPersonId === null && (
        <div className="text-center py-2 px-4 rounded-md bg-primary/5 border border-primary/20">
          <p className="font-mono text-xs text-primary">
            ▸ Click on a detected person to lock focus and blur the background
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartFocusTracker;
