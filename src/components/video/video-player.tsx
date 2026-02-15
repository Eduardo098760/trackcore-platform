'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Maximize, 
  Download, 
  Camera as CameraIcon,
  Volume2,
  VolumeX,
  RefreshCw,
  Settings
} from 'lucide-react';
import type { Camera, VideoStream } from '@/types';

interface VideoPlayerProps {
  camera: Camera;
  stream?: VideoStream;
  showControls?: boolean;
  autoPlay?: boolean;
  className?: string;
}

export function VideoPlayer({ 
  camera, 
  stream,
  showControls = true, 
  autoPlay = true,
  className = ''
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleMute = () => setIsMuted(!isMuted);
  
  const handleFullscreen = () => {
    // In real implementation, use Fullscreen API
    setIsFullscreen(!isFullscreen);
  };

  const handleSnapshot = () => {
    // In real implementation, capture video frame
    console.log('Snapshot captured');
  };

  // Alternar entre diferentes vídeos baseado na posição da câmera
  const getVideoId = () => {
    switch (camera.position) {
      case 'front':
      case 'cabin':
        return 'stvuWpttTSA'; // Vídeo telemetria 1
      case 'rear':
      case 'left':
      case 'right':
      case 'cargo':
        return 'iCMgYjuWZGA'; // Vídeo telemetria 2
      default:
        return 'stvuWpttTSA';
    }
  };

  const statusColor = {
    online: 'bg-green-500',
    recording: 'bg-red-500 animate-pulse',
    offline: 'bg-gray-500',
    error: 'bg-yellow-500'
  }[camera.status];

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0 relative group">
        {/* Video Container */}
        <div className="relative aspect-video bg-black">
          {/* Video feed */}
          <div className="absolute inset-0 flex items-center justify-center">
            {camera.status === 'online' || camera.status === 'recording' ? (
              <div className="relative w-full h-full">
                {/* YouTube embed para simulação */}
                <iframe
                  src={`https://www.youtube.com/embed/${getVideoId()}?autoplay=1&mute=1&controls=0&loop=1&playlist=${getVideoId()}&modestbranding=1&rel=0`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ pointerEvents: showControls ? 'none' : 'auto' }}
                ></iframe>
                
                {/* Camera name overlay */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs text-white z-10">
                  <CameraIcon className="inline h-3 w-3 mr-1" />
                  {camera.name}
                </div>
                {/* Recording indicator */}
                {camera.status === 'recording' && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-500/90 backdrop-blur-sm rounded text-xs text-white z-10">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    REC
                  </div>
                )}
                {/* Live stream info */}
                {stream && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs text-white z-10">
                    {stream.quality.toUpperCase()} • {stream.bitrate}kbps • {stream.latency}ms
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">
                <CameraIcon className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">{camera.status === 'offline' ? 'Câmera Offline' : 'Erro na Câmera'}</p>
              </div>
            )}
          </div>

          {/* Controls Overlay */}
          {showControls && (camera.status === 'online' || camera.status === 'recording') && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                {/* Progress bar placeholder */}
                <div className="h-1 bg-gray-600 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }}></div>
                </div>
                
                {/* Control buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={handleMute}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <Badge className={`${statusColor} text-white`}>
                      {camera.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={handleSnapshot}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-white hover:bg-white/20"
                      onClick={handleFullscreen}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
