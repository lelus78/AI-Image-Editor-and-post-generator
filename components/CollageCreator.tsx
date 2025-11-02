import React from 'react';
import { Loader } from './Loader';
import { DownloadIcon, SparklesIcon } from './IconComponents';
import { translations } from '../translations';

interface CollageCreatorProps {
  theme: string;
  setTheme: (theme: string) => void;
  onGenerate: () => void;
  resultUrl: string | null;
  isProcessing: boolean;
  selectedCount: number;
  enhancedTheme: string | null;
  t: typeof translations.en;
}

const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const CollageCreator: React.FC<CollageCreatorProps> = ({ t, theme, setTheme, onGenerate, resultUrl, isProcessing, selectedCount, enhancedTheme }) => {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 mb-2">{t.collageCreatorTitle}</h3>
        <p className="text-sm text-gray-400">{t.collageCreatorDescription}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2">
            <label htmlFor="collage-theme" className="block text-sm font-medium mb-2">{t.collageTheme}</label>
            <textarea
              id="collage-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
              placeholder={t.collageThemePlaceholder}
              disabled={isProcessing}
            />
        </div>
        <button 
            onClick={onGenerate}
            disabled={isProcessing || selectedCount < 2}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-teal-500 hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isProcessing ? (
                <>
                    <Loader />
                    <span>{t.creating}</span>
                </>
            ) : (
                <>
                    <SparklesIcon className="w-5 h-5"/>
                    <span>{t.generateCollage}</span>
                </>
            )}
        </button>
      </div>

      {(!isProcessing && (resultUrl || enhancedTheme)) && (
        <div className="mt-4 space-y-4">
          <h4 className="text-lg font-semibold">{t.collageResult}</h4>
          {resultUrl && (
            <div className="relative group">
              <img src={resultUrl} alt="Generated Collage" className="w-full h-auto rounded-lg" />
              <button
                  onClick={() => downloadImage(resultUrl, `collage-result.jpg`)}
                  aria-label="Download collage"
                  className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                  <DownloadIcon className="w-6 h-6" />
              </button>
            </div>
          )}
          {enhancedTheme && (
            <div className="text-left bg-gray-900/50 p-3 rounded-lg">
              <h4 className="text-sm font-semibold text-indigo-400 mb-1">{t.enhancedPromptUsed}</h4>
              <p className="text-xs text-gray-300 italic">{enhancedTheme}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};