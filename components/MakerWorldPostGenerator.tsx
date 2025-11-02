import React from 'react';
import { Loader } from './Loader';
import { CubeIcon } from './IconComponents';
import type { MakerWorldPost } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';

interface MakerWorldPostGeneratorProps {
  onGenerate: (context: string, language: 'en' | 'it') => void;
  post: MakerWorldPost | null;
  isProcessing: boolean;
  isImageLoaded: boolean;
  language: 'en' | 'it';
  setLanguage: (lang: 'en' | 'it') => void;
}

export const MakerWorldPostGenerator: React.FC<MakerWorldPostGeneratorProps> = ({ onGenerate, post, isProcessing, isImageLoaded, language, setLanguage }) => {
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
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400 mb-2">MakerWorld Post Generator</h3>
        <p className="text-sm text-gray-400">Generate a post for your 3D model. Provide the model name or context below.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label htmlFor="makerworld-context" className="block text-sm font-medium mb-2">Model Context</label>
            <textarea
              id="makerworld-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
              placeholder="e.g., 'T-Rex family from Bad Dinosaurs'"
              disabled={isProcessing || !isImageLoaded}
            />
          </div>
          <LanguageSwitcher language={language} setLanguage={setLanguage} disabled={isProcessing || !isImageLoaded} />
        </div>
        <button 
            onClick={handleGenerateClick}
            disabled={isProcessing || !isImageLoaded || !context.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed h-[98px] md:h-auto"
        >
            {isProcessing ? (
                <>
                    <Loader />
                    <span>Generating...</span>
                </>
            ) : (
                <>
                    <CubeIcon className="w-5 h-5"/>
                    <span>Generate MakerWorld Post</span>
                </>
            )}
        </button>
      </div>

      {post && !isProcessing && (
        <div className="mt-4 space-y-6 bg-gray-900/50 p-4 rounded-lg">
            
            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🏷️ Model Name</h4>
                <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <p className="text-gray-300 font-semibold">{post.modelName}</p>
                    <button onClick={() => copyToClipboard(post.modelName)} className="text-xs text-gray-400 hover:text-white">Copy</button>
                </div>
            </div>

             <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🧩 Category</h4>
                <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <p className="text-gray-300">{post.category}</p>
                    <button onClick={() => copyToClipboard(post.category)} className="text-xs text-gray-400 hover:text-white">Copy</button>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">🪄 Tags</h4>
                 <div className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                            <span key={tag} className="bg-gray-700 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">{tag}</span>
                        ))}
                    </div>
                    <button onClick={() => copyToClipboard(post.tags.join(', '))} className="text-xs text-gray-400 hover:text-white flex-shrink-0 ml-4">Copy</button>
                </div>
            </div>
          
            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">📝 Description</h4>
                <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.description}</p>
                    <button onClick={() => copyToClipboard(post.description)} className="text-xs text-gray-400 hover:text-white mt-2">Copy Description</button>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-bold text-lg flex items-center gap-2">📢 Community Post</h4>
                <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.communityPost}</p>
                    <button onClick={() => copyToClipboard(post.communityPost)} className="text-xs text-gray-400 hover:text-white mt-2">Copy Post</button>
                </div>
            </div>

        </div>
      )}
    </div>
  );
};