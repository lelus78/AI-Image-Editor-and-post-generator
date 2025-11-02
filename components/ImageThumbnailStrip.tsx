import React, { useEffect, useMemo } from 'react';

interface ImageThumbnailStripProps {
  images: File[];
  currentIndex: number;
  onSelect: (index: number) => void;
  disabled: boolean;
  selectedIndices: number[];
  onToggleSelection: (index: number) => void;
}

export const ImageThumbnailStrip: React.FC<ImageThumbnailStripProps> = ({ images, currentIndex, onSelect, disabled, selectedIndices, onToggleSelection }) => {
  const imageUrls = useMemo(() => images.map(file => URL.createObjectURL(file)), [images]);

  useEffect(() => {
    // Cleanup object URLs on component unmount or when images change
    return () => {
      imageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  return (
    <div className="bg-gray-800 rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-400">Image Queue</h3>
        <p className="text-xs text-gray-500">Select images for collage</p>
      </div>
      <div className="flex space-x-3 overflow-x-auto pb-2">
        {images.map((image, index) => {
          const isSelectedForCollage = selectedIndices.includes(index);
          return (
            <div key={image.name + index} className="relative flex-shrink-0 w-24 h-24 group">
              <button
                onClick={() => onSelect(index)}
                disabled={disabled}
                className={`w-full h-full rounded-lg overflow-hidden border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500
                  ${currentIndex === index ? 'border-indigo-500' : 'border-gray-600 hover:border-gray-500'}
                  ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <img
                  src={imageUrls[index]}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />
              </button>
              <button
                onClick={() => onToggleSelection(index)}
                disabled={disabled}
                className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 border-white/50 bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all
                  ${isSelectedForCollage ? 'bg-indigo-600 border-indigo-400' : 'hover:bg-black/60'}
                  ${disabled ? 'cursor-not-allowed' : ''}`}
                aria-label={isSelectedForCollage ? 'Deselect for collage' : 'Select for collage'}
              >
                {isSelectedForCollage && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};