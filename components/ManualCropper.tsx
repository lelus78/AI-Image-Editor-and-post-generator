
import React, { useState, useRef, useEffect } from 'react';
import { translations } from '../translations';
import { ScissorsIcon } from './IconComponents';

interface ManualCropperProps {
  imageUrl: string;
  onConfirm: (croppedImageUrl: string) => void;
  onCancel: () => void;
  t: typeof translations.en;
}

export const ManualCropper: React.FC<ManualCropperProps> = ({ imageUrl, onConfirm, onCancel, t }) => {
  const [selection, setSelection] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !imageRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setStartPos({ x, y });
    setSelection({ x, y, w: 0, h: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const w = Math.abs(currentX - startPos.x);
    const h = Math.abs(currentY - startPos.y);
    
    setSelection({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleApplyCrop = async () => {
    if (!imageRef.current || selection.w === 0 || selection.h === 0) return;
    
    const img = imageRef.current;
    const renderedWidth = img.width;
    const renderedHeight = img.height;
    
    const scaleX = img.naturalWidth / renderedWidth;
    const scaleY = img.naturalHeight / renderedHeight;
    
    const cropX = selection.x * scaleX;
    const cropY = selection.y * scaleY;
    const cropW = selection.w * scaleX;
    const cropH = selection.h * scaleY;
    
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
    onConfirm(croppedUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
      <div className="text-gray-300 text-sm">{t.drawCropInstruction}</div>
      <div 
        ref={containerRef}
        className="relative select-none cursor-crosshair border-2 border-gray-600 rounded-lg overflow-hidden inline-block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          ref={imageRef}
          src={imageUrl} 
          alt="Crop source" 
          className="max-h-[60vh] object-contain block pointer-events-none"
          draggable={false}
        />
        {/* Dark overlay outside selection */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none">
           {/* Clear selection area using clip-path */}
           <div 
              className="absolute bg-transparent border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.w,
                  height: selection.h,
              }}
           />
        </div>
      </div>
      
      <div className="flex gap-4">
        <button 
          onClick={onCancel}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
        >
          {t.cancelCrop}
        </button>
        <button 
          onClick={handleApplyCrop}
          disabled={selection.w === 0 || selection.h === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <ScissorsIcon className="w-5 h-5" />
          {t.applyCrop}
        </button>
      </div>
    </div>
  );
};
