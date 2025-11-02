
import React from 'react';
import { Loader } from './Loader';
import { SparklesIcon, MusicNoteIcon } from './IconComponents';
import type { SocialPost } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SocialPostGeneratorProps {
  onGenerate: (context: string, language: 'en' | 'it') => void;
  posts: SocialPost[];
  isProcessing: boolean;
  isImageLoaded: boolean;
  language: 'en' | 'it';
  setLanguage: (lang: 'en' | 'it') => void;
}

export const SocialPostGenerator: React.FC<SocialPostGeneratorProps> = ({ onGenerate, posts, isProcessing, isImageLoaded, language, setLanguage }) => {
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
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">Social Post Generator</h3>
        <p className="text-sm text-gray-400">Generate engaging social media captions for your edited image. Provide some optional context below.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2 space-y-4">
            <div>
                <label htmlFor="social-context" className="block text-sm font-medium mb-2">Context (Optional)</label>
                <textarea
                  id="social-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                  placeholder="e.g., 'Announcing a summer sale for our new product line!'"
                  disabled={isProcessing || !isImageLoaded}
                />
            </div>
            <LanguageSwitcher language={language} setLanguage={setLanguage} disabled={isProcessing || !isImageLoaded}/>
        </div>
        <button 
            onClick={handleGenerateClick}
            disabled={isProcessing || !isImageLoaded}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed h-[98px] md:h-auto"
        >
            {isProcessing ? (
                <>
                    <Loader />
                    <span>Generating...</span>
                </>
            ) : (
                <>
                    <SparklesIcon className="w-5 h-5"/>
                    <span>Generate Posts</span>
                </>
            )}
        </button>
      </div>

      {posts.length > 0 && !isProcessing && (
        <div className="mt-4 space-y-4">
          <h4 className="text-lg font-semibold">Generated Posts</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post, index) => (
              <div key={index} className="bg-gray-900/50 p-4 rounded-lg flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-bold text-indigo-400">{post.platform}</h5>
                  <button onClick={() => copyToClipboard(post.content)} className="text-xs text-gray-400 hover:text-white">Copy</button>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap flex-grow">{post.content}</p>
                {post.musicSuggestions && post.musicSuggestions.length > 0 && (
                  <div className="mt-4 border-t border-gray-700 pt-3">
                    <h6 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <MusicNoteIcon className="w-4 h-4" />
                        Music Suggestions
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