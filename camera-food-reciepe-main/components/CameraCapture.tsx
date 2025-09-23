import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photo: Blob) => Promise<void> | void;
  isProcessing?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ isOpen, onClose, onCapture, isProcessing = false }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhotoPreview(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('cameraModalErrorUnsupported'));
        return;
      }

      try {
        setError(null);
        setIsVideoReady(false);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsVideoReady(true);
        }
      } catch (err) {
        console.error('Camera permission denied', err);
        setError(t('cameraModalErrorPermission'));
      }
    };

    if (isOpen && !photoPreview) {
      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isOpen, photoPreview, t]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPhotoPreview(dataUrl);
  };

  const handleConfirm = async () => {
    if (!photoPreview) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(photoPreview);
      const blob = await response.blob();
      await onCapture(blob);
    } catch (err) {
      console.error('Error sending captured image', err);
      setError(t('cameraModalErrorSend'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative bg-black aspect-[3/4] sm:aspect-video">
          {photoPreview ? (
            <img src={photoPreview} alt="Captured fridge" className="w-full h-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 text-sm bg-gradient-to-b from-black/40 via-transparent to-black/60">
                  <span className="px-4 py-2 bg-black/60 rounded-full">{t('cameraModalPrompt')}</span>
                  {!isVideoReady && <span className="mt-3 text-xs">{t('cameraModalInitializing')}</span>}
                </div>
              )}
            </>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="p-6 space-y-4">
          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <p className="text-sm text-gray-500">
              {t('cameraModalInstructions')}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-sm font-medium"
            >
              {t('cameraModalClose')}
            </button>
            {photoPreview ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-sm font-medium"
                  disabled={isSubmitting || isProcessing}
                >
                  {t('cameraModalRetake')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 rounded-xl bg-brand-blue text-white shadow-md hover:bg-blue-600 transition text-sm font-semibold disabled:opacity-60"
                  disabled={isSubmitting || isProcessing}
                >
                  {isSubmitting || isProcessing ? t('cameraModalAnalyzing') : t('cameraModalUsePhoto')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                className="px-6 py-2 rounded-full bg-brand-orange text-white shadow-lg hover:bg-orange-500 transition text-sm font-semibold disabled:opacity-60"
                disabled={!!error || !isVideoReady}
              >
                {t('cameraModalCapture')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
