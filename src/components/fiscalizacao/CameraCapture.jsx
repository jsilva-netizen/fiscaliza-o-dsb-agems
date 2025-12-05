import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CameraCapture({ onCapture, onCancel, minPhotos = 1, currentPhotos = 0 }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [location, setLocation] = useState(null);

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            
            // Obter localização
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => console.log('Localização não disponível')
                );
            }
        } catch (err) {
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
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
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(imageData);
            stopCamera();
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    const confirmPhoto = async () => {
        if (!capturedImage) return;
        
        setIsLoading(true);
        try {
            // Converter base64 para blob
            const response = await fetch(capturedImage);
            const blob = await response.blob();
            const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Upload
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            onCapture({
                url: file_url,
                latitude: location?.lat,
                longitude: location?.lng,
                data_hora: new Date().toISOString()
            });
            
            setCapturedImage(null);
        } catch (err) {
            setError('Erro ao salvar foto. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        stopCamera();
        setCapturedImage(null);
        onCancel();
    };

    React.useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const remaining = minPhotos - currentPhotos;

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="bg-black/80 text-white p-4 flex justify-between items-center">
                <div>
                    <p className="text-sm opacity-70">Fotos: {currentPhotos}/{minPhotos}</p>
                    {remaining > 0 && (
                        <p className="text-yellow-400 text-xs">Faltam {remaining} foto(s) obrigatória(s)</p>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={handleCancel} className="text-white">
                    <X className="h-6 w-6" />
                </Button>
            </div>

            {/* Camera/Preview */}
            <div className="flex-1 relative">
                {error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
                        <div>
                            <p className="mb-4">{error}</p>
                            <Button onClick={startCamera}>Tentar novamente</Button>
                        </div>
                    </div>
                ) : capturedImage ? (
                    <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" />
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                )}
                <canvas ref={canvasRef} className="hidden" />
                
                {/* GPS indicator */}
                {location && (
                    <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                        📍 GPS OK
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-black/80 p-6 flex justify-center gap-6">
                {capturedImage ? (
                    <>
                        <Button 
                            variant="outline" 
                            size="lg" 
                            onClick={retakePhoto}
                            className="bg-white/10 border-white/30 text-white"
                        >
                            <RotateCcw className="h-5 w-5 mr-2" />
                            Refazer
                        </Button>
                        <Button 
                            size="lg" 
                            onClick={confirmPhoto}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Check className="h-5 w-5 mr-2" />
                            {isLoading ? 'Salvando...' : 'Confirmar'}
                        </Button>
                    </>
                ) : (
                    <Button 
                        size="lg" 
                        onClick={capturePhoto}
                        className="w-20 h-20 rounded-full bg-white hover:bg-gray-200"
                    >
                        <Camera className="h-8 w-8 text-black" />
                    </Button>
                )}
            </div>
        </div>
    );
}