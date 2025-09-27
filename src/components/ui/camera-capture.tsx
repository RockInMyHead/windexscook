import React, { useRef, useState } from 'react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Camera, X, RotateCcw, Check, Upload } from 'lucide-react';
import { toast } from './use-toast';

interface CameraCaptureProps {
  onImageCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [imageQuality, setImageQuality] = useState<'good' | 'medium' | 'poor'>('good');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Ошибка доступа к камере:', error);
      toast({
        title: "Ошибка камеры",
        description: "Не удалось получить доступ к камере. Проверьте разрешения.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        // Анализируем качество изображения
        const quality = analyzeImageQuality(canvas);
        setImageQuality(quality);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        setIsCapturing(true);
        stopCamera();
      }
    }
  };

  const analyzeImageQuality = (canvas: HTMLCanvasElement): 'good' | 'medium' | 'poor' => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'medium';

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    
    let brightness = 0;
    let contrast = 0;
    
    // Анализируем яркость и контраст
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightness += (r + g + b) / 3;
    }
    
    brightness /= (data.length / 4);
    
    // Простая оценка качества
    if (brightness > 150 && brightness < 200) return 'good';
    if (brightness > 100 && brightness < 250) return 'medium';
    return 'poor';
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsCapturing(false);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onImageCapture(capturedImage);
      onClose();
    }
  };

  const switchCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(startCamera, 100);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        if (imageData) {
          // Анализируем качество загруженного изображения
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              const quality = analyzeImageQuality(canvas);
              setImageQuality(quality);
            }
          };
          img.src = imageData;
          
          setCapturedImage(imageData);
          setIsCapturing(true);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📸 Фотографирование продуктов</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!isCapturing ? (
            <div className="space-y-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex gap-2 justify-center">
                <Button onClick={capturePhoto} className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Сделать фото
                </Button>
                <Button variant="outline" onClick={switchCamera}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Галерея
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <p className="text-sm text-muted-foreground text-center">
                📸 Сфотографируйте продукты или выберите из галереи
              </p>
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>💡 Советы для лучшего результата:</p>
                <p>• Хорошее освещение</p>
                <p>• Четкий фокус на продуктах</p>
                <p>• Минимум фона</p>
                <p>• Разместите продукты на светлом фоне</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                <img
                  src={capturedImage || ''}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex gap-2 justify-center">
                <Button onClick={confirmPhoto} className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Использовать фото
                </Button>
                <Button variant="outline" onClick={retakePhoto}>
                  <RotateCcw className="h-4 w-4" />
                  Переснять
                </Button>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Фото готово! Нажмите "Использовать фото" для анализа продуктов
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Качество:</span>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    imageQuality === 'good' ? 'bg-green-100 text-green-800' :
                    imageQuality === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {imageQuality === 'good' ? '✅ Отличное' :
                     imageQuality === 'medium' ? '⚠️ Хорошее' :
                     '❌ Плохое'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
