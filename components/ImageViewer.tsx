
import React, { useState, useEffect, useRef } from 'react';
import type { ImageResult } from '../types';
import { DownloadIcon, RefreshIcon, ZoomInIcon, ZoomOutIcon, ExpandIcon } from './IconComponents';
import { translations } from '../translations';

export type ViewTab = 'original' | 'cleaned' | 'removedBg' | 'themedBg' | 'crops' | 'filtered' | 'report';

interface ImageViewerProps {
  imageResult: ImageResult | null;
  originalImage: File | null;
  onRegenerateTheme: () => void;
  isProcessing: boolean;
  t: typeof translations.en;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
}

const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Internal component for Zoom/Pan functionality
interface ZoomableImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  isTransparent?: boolean;
  t: typeof translations.en;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt, style, className, isTransparent, t }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 1));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Reset position if we zoom out completely
  useEffect(() => {
      if (scale === 1) {
          setPosition({ x: 0, y: 0 });
      }
  }, [scale]);

  // Use a native event listener with { passive: false } to reliably prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
        if (e.cancelable) {
            e.preventDefault();
        }
        const delta = e.deltaY * -0.001;
        
        setScale(prevScale => {
            return Math.min(Math.max(prevScale + delta, 1), 5);
        });
    };

    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
        container.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset state when src changes
  useEffect(() => {
    handleReset();
  }, [src]);

  const cursorStyle = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default';
  const containerClasses = isTransparent 
    ? `bg-grid-pattern p-4 rounded-lg relative overflow-hidden group ${className?.includes('max-h') ? className : ''}` 
    : `relative overflow-hidden rounded-lg group ${className?.includes('max-h') ? className : ''}`;
  
  // We strip layout classes from the img itself because it's now managed by the container wrapper for zoom
  const imageClasses = "w-full h-full object-contain transition-transform duration-75 ease-out max-h-[70vh]";

  return (
    <div 
      ref={containerRef}
      className={`${containerClasses} flex items-center justify-center bg-gray-900/20 min-h-[300px] select-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: cursorStyle }}
    >
       <img 
          src={src} 
          alt={alt} 
          className={imageClasses} 
          crossOrigin="anonymous" 
          style={{
            ...style,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }} 
          draggable={false}
        />
        
        {/* Floating Zoom Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gray-800/80 backdrop-blur-md p-1.5 rounded-full border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors" title={t.zoomOut}>
                <ZoomOutIcon className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono w-10 text-center text-gray-300">{Math.round(scale * 100)}%</span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors" title={t.zoomIn}>
                <ZoomInIcon className="w-5 h-5" />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={handleReset} className="p-1.5 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors" title={t.resetZoom}>
                <ExpandIcon className="w-4 h-4" />
            </button>
        </div>
    </div>
  );
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ t, imageResult, originalImage, onRegenerateTheme, isProcessing, activeTab, setActiveTab }) => {
  const [isInverted, setIsInverted] = useState(false);

  // Reset inversion when tab changes or image changes
  useEffect(() => {
    setIsInverted(false);
  }, [activeTab, imageResult]);

  const originalUrl = originalImage ? URL.createObjectURL(originalImage) : "https://picsum.photos/1024/768";
  const baseFilename = originalImage?.name.split('.').slice(0, -1).join('.') || 'download';
  
  const handleDownloadAll = () => {
    if (!imageResult) return;
    if (imageResult.cleaned) downloadImage(imageResult.cleaned, `${baseFilename}-cleaned.jpg`);
    if (imageResult.removedBg) downloadImage(imageResult.removedBg, `${baseFilename}-removed-bg.png`);
    if (imageResult.themedBg) downloadImage(imageResult.themedBg, `${baseFilename}-themed-bg.jpg`);
    if (imageResult.filtered) downloadImage(imageResult.filtered, `${baseFilename}-filtered.jpg`);
    imageResult.cropProposals.forEach((crop, index) => {
      if (crop.imageUrl) {
        downloadImage(crop.imageUrl, `${baseFilename}-crop-${crop.aspectRatio.replace(':', 'x')}-${index + 1}.jpg`);
      }
    });
  };

  const processAndDownload = async (url: string, filename: string) => {
    if (!isInverted) {
        downloadImage(url, filename);
        return;
    }

    try {
        // If inverted, draw to canvas, invert, and download
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.filter = 'invert(1)';
            ctx.drawImage(img, 0, 0);
            const invertedUrl = canvas.toDataURL(filename.endsWith('.png') ? 'image/png' : 'image/jpeg');
            const nameParts = filename.split('.');
            const ext = nameParts.pop();
            const newFilename = `${nameParts.join('.')}-inverted.${ext}`;
            downloadImage(invertedUrl, newFilename);
        } else {
            // Fallback
             downloadImage(url, filename);
        }
    } catch (e) {
        console.error("Failed to invert image for download:", e);
        downloadImage(url, filename);
    }
  };

  const renderContent = () => {
    const imageToDisplay = imageResult?.original || originalUrl;
    const imageStyle = isInverted ? { filter: 'invert(1)' } : undefined;

    const mainImage = (src: string, alt: string, isTransparent = false) => {
      return (
        <ZoomableImage 
            src={src} 
            alt={alt} 
            isTransparent={isTransparent} 
            style={imageStyle} 
            t={t}
        />
      );
    };

    const renderPromptBox = (title: string, prompt: string, onRegen?: () => void) => (
      <div className="text-left bg-gray-900/50 p-3 rounded-lg max-w-2xl mx-auto mt-2">
        <div className="flex justify-between items-center mb-1">
            <h4 className="text-sm font-semibold text-indigo-400">{title}</h4>
            {onRegen && (
                <button onClick={onRegen} disabled={isProcessing} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Regenerate">
                    <RefreshIcon className="w-3.5 h-3.5"/> {t.regenerate}
                </button>
            )}
        </div>
        <p className="text-xs text-gray-300 italic">{prompt}</p>
      </div>
    );

    switch (activeTab) {
      case 'cleaned':
        return imageResult?.cleaned ? mainImage(imageResult.cleaned, t.cleaned) : <p>{t.notGenerated}</p>;
      case 'removedBg':
        return imageResult?.removedBg ? mainImage(imageResult.removedBg, t.removedBg, true) : <p>{t.notGenerated}</p>;
      case 'themedBg':
        return imageResult?.themedBg ? (
            <div className="w-full text-center h-full flex flex-col">
              {mainImage(imageResult.themedBg, t.themedBg)}
              {imageResult.enhancedTheme && renderPromptBox(t.enhancedPromptUsed, imageResult.enhancedTheme, onRegenerateTheme)}
            </div>
          ) : <p>{t.notGenerated}</p>;
      case 'filtered':
        return imageResult?.filtered ? (
            <div className="w-full text-center h-full flex flex-col">
              {mainImage(imageResult.filtered, t.filtered)}
              {imageResult.enhancedFilterPrompt && renderPromptBox(t.enhancedFilterPrompt, imageResult.enhancedFilterPrompt)}
            </div>
          ) : <p>{t.notGenerated}</p>;
      case 'crops':
         return (
          <div className="space-y-4 w-full">
            <h3 className="text-xl font-semibold">{t.cropSuggestions}</h3>
            {imageResult.cropProposals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {imageResult.cropProposals.map((crop, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded-lg text-center relative group flex flex-col h-full">
                      <div className="relative flex-grow flex items-center justify-center bg-gray-900/50 rounded-lg p-2 min-h-[200px]">
                          <img 
                            src={crop.imageUrl} 
                            alt={`${t.crops} ${index + 1}`} 
                            className="max-w-full max-h-[300px] object-contain rounded-md shadow-sm" 
                            style={imageStyle} 
                          />
                      </div>
                      <div className="my-3">
                          <p className="font-bold text-sm">{crop.aspectRatio} - {t.score}: {crop.compositionScore}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-3" title={crop.rationale}>{crop.rationale}</p>
                      </div>
                      <button 
                        onClick={() => downloadImage(crop.imageUrl!, `${baseFilename}-crop-${crop.aspectRatio.replace(':', 'x')}.jpg`)} 
                        className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded-lg transition-colors text-sm font-medium mt-auto"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        {t.download}
                      </button>
                    </div>
                ))}
                </div>
            ) : <p className="text-gray-400">{t.noCropProposals}</p>}
          </div>
        );
      case 'report':
        return imageResult?.report ? (
            <div className="text-left p-4 sm:p-6 bg-gray-900/50 rounded-lg max-w-2xl mx-auto space-y-4 w-full">
                <h3 className="text-xl font-semibold text-indigo-400">{t.processingReport}</h3>
                <dl className="space-y-4">
                    <div>
                        <dt className="font-semibold text-gray-300">{t.subjectDescription}</dt>
                        <dd className="text-gray-400 mt-1 ml-4 italic">{imageResult.report.subjectDescription}</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-gray-300">{t.interventionType}</dt>
                        <dd className="text-gray-400 mt-1 ml-4">{imageResult.report.interventionType}</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-gray-300">{t.parametersUsed}</dt>
                        <dd className="text-gray-400 mt-1 ml-4 font-mono text-sm bg-gray-900 p-2 rounded">{imageResult.report.parametersUsed}</dd>
                    </div>
                </dl>
            </div>
        ) : <p className="text-gray-400">{t.notGenerated}</p>;
      case 'original':
      default:
        return mainImage(imageToDisplay, t.original);
    }
  };

  const getCurrentDownload = () => {
    if(!imageResult) {
        return { url: originalUrl, filename: `${baseFilename}-original.${originalImage?.name.split('.').pop()}`};
    }
    switch(activeTab) {
        case 'original': return { url: imageResult.original, filename: `${baseFilename}-original.${originalImage?.name.split('.').pop()}`};
        case 'cleaned': return imageResult.cleaned ? { url: imageResult.cleaned, filename: `${baseFilename}-cleaned.jpg`} : null;
        case 'removedBg': return imageResult.removedBg ? { url: imageResult.removedBg, filename: `${baseFilename}-removed-bg.png`} : null;
        case 'themedBg': return imageResult.themedBg ? { url: imageResult.themedBg, filename: `${baseFilename}-themed-bg.jpg`} : null;
        case 'filtered': return imageResult.filtered ? { url: imageResult.filtered, filename: `${baseFilename}-filtered.jpg`} : null;
        default: return null;
    }
  }
  const currentDownload = getCurrentDownload();

  const showInvertToggle = activeTab !== 'report';

  return (
    <div className="bg-gray-800 rounded-2xl p-4 sm:p-6">
      <style>{`.bg-grid-pattern { background-image: linear-gradient(45deg, #4b5563 25%, transparent 25%), linear-gradient(-45deg, #4b5563 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b5563 75%), linear-gradient(-45deg, transparent 75%, #4b5563 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }`}</style>
      
      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-700 pb-3 justify-between items-center">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('original')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'original' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.original}</button>
            {imageResult?.cleaned && <button onClick={() => setActiveTab('cleaned')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'cleaned' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.cleaned}</button>}
            {imageResult?.removedBg && <button onClick={() => setActiveTab('removedBg')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'removedBg' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gamma-600'} disabled:opacity-50`}>{t.removedBg}</button>}
            {imageResult?.themedBg && <button onClick={() => setActiveTab('themedBg')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'themedBg' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.themedBg}</button>}
            {imageResult?.filtered && <button onClick={() => setActiveTab('filtered')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'filtered' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.filtered}</button>}
            {imageResult?.cropProposals.length > 0 && <button onClick={() => setActiveTab('crops')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'crops' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.crops}</button>}
            {imageResult?.report && <button onClick={() => setActiveTab('report')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'report' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>{t.report}</button>}
          </div>
          
          <div className="flex items-center gap-2">
            {showInvertToggle && (
                <button 
                    onClick={() => setIsInverted(!isInverted)} 
                    disabled={isProcessing}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-colors border disabled:opacity-50 ${isInverted ? 'bg-white text-gray-900 border-white' : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" fill="currentColor" className={isInverted ? 'hidden' : 'block'}/>
                         <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" fill="currentColor" className={isInverted ? 'block' : 'hidden'}/>
                    </svg>
                    {t.invertColors}
                </button>
            )}
            {imageResult && (
                <button onClick={handleDownloadAll} disabled={isProcessing} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50">
                    <DownloadIcon className="w-4 h-4" />
                    <span>{t.downloadAll}</span>
                </button>
            )}
          </div>
      </div>

      <div className="flex justify-center items-center min-h-[300px] relative">
        {renderContent()}
        {currentDownload && (
            <button onClick={() => processAndDownload(currentDownload.url, currentDownload.filename)} aria-label="Download current view" className="absolute top-2 right-2 bg-gray-900/60 hover:bg-gray-900/80 p-2 rounded-full text-white transition-colors z-20">
                <DownloadIcon className="w-6 h-6" />
            </button>
        )}
      </div>

    </div>
  );
};
