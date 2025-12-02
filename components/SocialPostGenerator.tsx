
import React from 'react';
import { Loader } from './Loader';
import { SparklesIcon, MusicNoteIcon } from './IconComponents';
import type { SocialPost, CraftMode } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { translations } from '../translations';

interface SocialPostGeneratorProps {
  onGenerate: (context: string, language: 'en' | 'it') => void;
  posts: SocialPost[];
  isProcessing: boolean;
  isImageLoaded: boolean;
  language: 'en' | 'it';
  setLanguage: (lang: 'en' | 'it') => void;
  t: typeof translations.en;
  craftMode: CraftMode;
  setCraftMode: (mode: CraftMode) => void;
}

export const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({ t, onGenerate, posts, isProcessing, isImageLoaded, language, setLanguage, craftMode, setCraftMode }) => {
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
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">{t.socialPostGeneratorTitle}</h3>
        <p className="text-sm text-gray-400">{t.socialPostGeneratorDescription}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2 space-y-4">
            <div>
                <label htmlFor="social-context" className="block text-sm font-medium mb-2">{t.contextOptional}</label>
                <textarea
                  id="social-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                  placeholder={t.contextPlaceholder}
                  disabled={isProcessing || !isImageLoaded}
                />
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <LanguageSwitcher t={t} language={language} setLanguage={setLanguage} disabled={isProcessing || !isImageLoaded}/>
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">{t.craftType}</label>
                    <div className="flex rounded-lg bg-gray-900 p-1">
                        <button
                            onClick={() => setCraftMode('3d-printing')}
                            disabled={isProcessing || !isImageLoaded}
                            className={`w-full px-2 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                            craftMode === '3d-printing' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            {t.printing3d}
                        </button>
                        <button
                            onClick={() => setCraftMode('laser-engraving')}
                            disabled={isProcessing || !isImageLoaded}
                            className={`w-full px-2 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
                            craftMode === 'laser-engraving' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
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
            disabled={isProcessing || !isImageLoaded}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed h-[98px] md:h-auto"
        >
            {isProcessing ? (
                <>
                    <Loader />
                    <span>{t.generating}</span>
                </>
            ) : (
                <>
                    <SparklesIcon className="w-5 h-5"/>
                    <span>{t.generatePosts}</span>
                </>
            )}
        </button>
      </div>

      {posts.length > 0 && !isProcessing && (
        <div className="mt-4 space-y-4">
          <h4 className="text-lg font-semibold">{t.generatedPosts}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post, index) => (
              <div key={index} className="bg-gray-900/50 p-4 rounded-lg flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-bold text-indigo-400">{post.platform}</h5>
                  <button onClick={() => copyToClipboard(post.content)} className="text-xs text-gray-400 hover:text-white">{t.copy}</button>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap flex-grow">{post.content}</p>
                {post.musicSuggestions && post.musicSuggestions.length > 0 && (
                  <div className="mt-4 border-t border-gray-700 pt-3">
                    <h6 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <MusicNoteIcon className="w-4 h-4" />
                        {t.musicSuggestions}
                    </h6>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1">
                      {post.musicSuggestions.map((song, i) => <li key={i} className="pl-2">{song}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};