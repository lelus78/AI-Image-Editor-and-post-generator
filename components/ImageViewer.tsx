import React, { useState, useEffect, useRef } from 'react';
import type { ImageResult } from '../types';
import { DownloadIcon, RefreshIcon } from './IconComponents';

interface ImageViewerProps {
  imageResult: ImageResult | null;
  originalImage: File | null;
  onRegenerateTheme: () => void;
  isProcessing: boolean;
}

type ViewTab = 'original' | 'cleaned' | 'removedBg' | 'themedBg' | 'crops' | 'filtered' | 'report';

const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageResult, originalImage, onRegenerateTheme, isProcessing }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('original');
  const imageRef = useRef<HTMLImageElement>(null);
  const prevImageResultRef = useRef<ImageResult | null>(null);

  useEffect(() => {
    // Logic to switch tab to the newest generated content
    if (imageResult) {
      if (imageResult.filtered && !prevImageResultRef.current?.filtered) {
        setActiveTab('filtered');
      } else if (imageResult.themedBg && !prevImageResultRef.current?.themedBg) {
        setActiveTab('themedBg');
      } else if (imageResult.cleaned && !prevImageResultRef.current?.cleaned) {
        setActiveTab('cleaned');
      } else if (imageResult.removedBg && !prevImageResultRef.current?.removedBg) {
        setActiveTab('removedBg');
      } else if (!prevImageResultRef.current || !imageResult) {
        setActiveTab('original');
      }
    } else {
        setActiveTab('original');
    }
    prevImageResultRef.current = imageResult;
  }, [imageResult]);


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

  const renderContent = () => {
    const imageToDisplay = imageResult?.original || originalUrl;

    const mainImage = (src: string, alt: string, isTransparent = false) => {
      const containerClasses = isTransparent ? "bg-grid-pattern p-4 rounded-lg" : "";
      const imageClasses = isTransparent ? "w-full h-auto object-contain max-h-[65vh]" : "w-full h-auto object-contain rounded-lg max-h-[70vh]";
      return (
        <div className={containerClasses}>
          <img ref={imageRef} src={src} alt={alt} className={imageClasses} crossOrigin="anonymous" />
        </div>
      );
    };

    const renderPromptBox = (title: string, prompt: string, onRegen?: () => void) => (
      <div className="text-left bg-gray-900/50 p-3 rounded-lg max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-1">
            <h4 className="text-sm font-semibold text-indigo-400">{title}</h4>
            {onRegen && (
                <button onClick={onRegen} disabled={isProcessing} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Regenerate">
                    <RefreshIcon className="w-3.5 h-3.5"/> Regenerate
                </button>
            )}
        </div>
        <p className="text-xs text-gray-300 italic">{prompt}</p>
      </div>
    );

    switch (activeTab) {
      case 'cleaned':
        return imageResult?.cleaned ? mainImage(imageResult.cleaned, "Cleaned") : <p>Not generated.</p>;
      case 'removedBg':
        return imageResult?.removedBg ? mainImage(imageResult.removedBg, "Background Removed", true) : <p>Not generated.</p>;
      case 'themedBg':
        return imageResult?.themedBg ? (
            <div className="w-full text-center space-y-4">
              <img src={imageResult.themedBg} alt="Themed Background" className="w-full h-auto object-contain rounded-lg max-h-[60vh]" />
              {imageResult.enhancedTheme && renderPromptBox("Enhanced Prompt Used:", imageResult.enhancedTheme, onRegenerateTheme)}
            </div>
          ) : <p>Not generated.</p>;
      case 'filtered':
        return imageResult?.filtered ? (
            <div className="w-full text-center space-y-4">
              <img src={imageResult.filtered} alt="AI Filtered" className="w-full h-auto object-contain rounded-lg max-h-[60vh]" />
              {imageResult.enhancedFilterPrompt && renderPromptBox("Enhanced Filter Prompt:", imageResult.enhancedFilterPrompt)}
            </div>
          ) : <p>Not generated.</p>;
      case 'crops':
         return (
          <div className="space-y-4 w-full">
            <h3 className="text-xl font-semibold">Crop Suggestions</h3>
            {imageResult.cropProposals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {imageResult.cropProposals.map((crop, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded-lg text-center relative group">
                      <img src={crop.imageUrl} alt={`Crop ${index + 1}`} className="w-full h-auto rounded-md mb-2" />
                      <button onClick={() => downloadImage(crop.imageUrl!, `${baseFilename}-crop-${crop.aspectRatio.replace(':', 'x')}.jpg`)} aria-label="Download crop" className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                        <DownloadIcon className="w-5 h-5" />
                      </button>
                      <p className="font-bold text-sm mt-2">{crop.aspectRatio} - Score: {crop.compositionScore}</p>
                      <p className="text-xs text-gray-400">{crop.rationale}</p>
                    </div>
                ))}
                </div>
            ) : <p className="text-gray-400">No crop proposals available.</p>}
          </div>
        );
      case 'report':
        return imageResult?.report ? (
            <div className="text-left p-4 sm:p-6 bg-gray-900/50 rounded-lg max-w-2xl mx-auto space-y-4 w-full">
                <h3 className="text-xl font-semibold text-indigo-400">Processing Report</h3>
                <dl className="space-y-4">
                    <div>
                        <dt className="font-semibold text-gray-300">Subject Description</dt>
                        <dd className="text-gray-400 mt-1 ml-4 italic">{imageResult.report.subjectDescription}</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-gray-300">Intervention Type</dt>
                        <dd className="text-gray-400 mt-1 ml-4">{imageResult.report.interventionType}</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-gray-300">Parameters Used</dt>
                        <dd className="text-gray-400 mt-1 ml-4 font-mono text-sm bg-gray-900 p-2 rounded">{imageResult.report.parametersUsed}</dd>
                    </div>
                </dl>
            </div>
        ) : <p className="text-gray-400">Report not generated.</p>;
      case 'original':
      default:
        return mainImage(imageToDisplay, "Original");
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

  return (
    <div className="bg-gray-800 rounded-2xl p-4 sm:p-6">
      <style>{`.bg-grid-pattern { background-image: linear-gradient(45deg, #4b5563 25%, transparent 25%), linear-gradient(-45deg, #4b5563 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b5563 75%), linear-gradient(-45deg, transparent 75%, #4b5563 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }`}</style>
      
      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-700 pb-3 justify-between items-center">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveTab('original')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'original' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Original</button>
            {imageResult?.cleaned && <button onClick={() => setActiveTab('cleaned')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'cleaned' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Cleaned</button>}
            {imageResult?.removedBg && <button onClick={() => setActiveTab('removedBg')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'removedBg' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gamma-600'} disabled:opacity-50`}>Removed BG</button>}
            {imageResult?.themedBg && <button onClick={() => setActiveTab('themedBg')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'themedBg' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Themed BG</button>}
            {imageResult?.filtered && <button onClick={() => setActiveTab('filtered')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'filtered' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Filtered</button>}
            {imageResult?.cropProposals.length > 0 && <button onClick={() => setActiveTab('crops')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'crops' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Crops</button>}
            {imageResult?.report && <button onClick={() => setActiveTab('report')} disabled={isProcessing} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'report' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>Report</button>}
          </div>
          {imageResult && (
            <button onClick={handleDownloadAll} disabled={isProcessing} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50">
                <DownloadIcon className="w-4 h-4" />
                <span>Download All</span>
            </button>
          )}
      </div>

      <div className="flex justify-center items-center min-h-[300px] relative">
        {renderContent()}
        {currentDownload && (
            <button onClick={() => downloadImage(currentDownload.url, currentDownload.filename)} aria-label="Download current view" className="absolute top-2 right-2 bg-gray-900/60 hover:bg-gray-900/80 p-2 rounded-full text-white transition-colors">
                <DownloadIcon className="w-6 h-6" />
            </button>
        )}
      </div>

    </div>
  );
};