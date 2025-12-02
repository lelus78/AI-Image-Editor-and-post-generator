
import React from 'react';
import { Loader } from './Loader';
import { CubeIcon } from './IconComponents';
import type { MakerWorldPost, CraftMode } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { translations } from '../translations';

interface MakerWorldPostGeneratorProps {
  onGenerate: (context: string, language: 'en' | 'it') => void;
  post: MakerWorldPost | null;
  isProcessing: boolean;
  isImageLoaded: boolean;
  language: 'en' | 'it';
  setLanguage: (lang: 'en' | 'it') => void;
  t: typeof translations.en;
  craftMode: CraftMode;
  setCraftMode: (mode: CraftMode) => void;
}

export const MakerWorldPostGenerator: React.FC<MakerWorldPostGeneratorProps> = ({ t, onGenerate, post, isProcessing, isImageLoaded, language, setLanguage, craftMode, setCraftMode }) => {
  const [context, setContext] = React.useState('');

  const handleGenerateClick = () => {
    onGenerate(context, language);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 mb-2">{t.makerWorldPostGeneratorTitle}</h3>
        <p className="text-sm text-gray-400">{t.makerWorldPostGeneratorDescription}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label htmlFor="makerworld-context" className="block text-sm font-medium mb-2">{t.modelContext}</label>
            <textarea
              id="makerworld-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
              placeholder={t.modelContextPlaceholder}
              disabled={isProcessing || !isImageLoaded}
            />
          </div>
          <div className="flex gap-4">
             <div className="flex-1">
                 <LanguageSwitcher t={t} language={language} setLanguage={setLanguage} disabled={isProcessing || !isImageLoaded} />
             </div>
             <div className="flex-1">
                <label className="block text-sm font-medium mb-2">{t.craftType}</label>
                <div className="flex rounded-lg bg-gray-900 p-1">
                    <button
                        onClick={() => setCraftMode('3d-printing')}
                        disabled={isProcessing || !isImageLoaded}
                        className={`w-full px-2 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                        craftMode === '3d-printing' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {t.printing3d}
                    </button>
                    <button
                        onClick={() => setCraftMode('laser-engraving')}
                        disabled={isProcessing || !isImageLoaded}
                        className={`w-full px-2 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                        craftMode === 'laser-engraving' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                        }`}
                    >
                        {t.laserEngraving}
                    </button>
                </div>
             </div>
          </div>
        </div>
        <button 
            onClick={handleGenerateClick}
            disabled={isProcessing || !isImageLoaded || !context.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed h-[98px] md:h-auto"
        >
            {isProcessing ? (
                <>
                    <Loader />
                    <span>{t.generating}</span>
                </>
            ) : (
                <>
                    <CubeIcon className="w-5 h-5"/>
                    <span>{t.generateMakerPost}</span>
                </>
            )}
        </button>
      </div>

      {post && !isProcessing && (
        <div className="mt-4 space-y-6 bg-gray-900/50 p-4 rounded-lg">
            
            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🏷️ {t.modelName}</h4>
                <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <p className="text-gray-300 font-semibold">{post.modelName}</p>
                    <button onClick={() => copyToClipboard(post.modelName)} className="text-xs text-gray-400 hover:text-white">{t.copy}</button>
                </div>
            </div>

             <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🧩 {t.category}</h4>
                <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <p className="text-gray-300">{post.category}</p>
                    <button onClick={() => copyToClipboard(post.category)} className="text-xs text-gray-400 hover:text-white">{t.copy}</button>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🪄 {t.tags}</h4>
                 <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                            <span key={tag} className="bg-gray-700 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">{tag}</span>
                        ))}
                    </div>
                    <button onClick={() => copyToClipboard(post.tags.join(', '))} className="text-xs text-gray-400 hover:text-white flex-shrink-0 ml-4">{t.copy}</button>
                </div>
            </div>
          
            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">📝 {t.description}</h4>
                <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.description}</p>
                    <button onClick={() => copyToClipboard(post.description)} className="text-xs text-gray-400 hover:text-white mt-2">{t.copyDescription}</button>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">📢 {t.communityPost}</h4>
                <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.communityPost}</p>
                    <button onClick={() => copyToClipboard(post.communityPost)} className="text-xs text-gray-400 hover:text-white mt-2">{t.copyPost}</button>
                </div>
            </div>

        </div>
      )}
    </div>
  );
};