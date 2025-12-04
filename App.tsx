
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { SettingsPanel } from './components/SettingsPanel';
import { ImageViewer, ViewTab } from './components/ImageViewer';
import { ImageThumbnailStrip } from './components/ImageThumbnailStrip';
import { CollageCreator } from './components/CollageCreator';
import { SocialPostGenerator } from './components/SocialPostGenerator';
import { MakerWorldPostGenerator } from './components/MakerWorldPostGenerator';
import { Loader } from './components/Loader';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { UploadIcon, TrashIcon, PlusIcon, UndoIcon, XCircleIcon, WandIcon, SparklesIcon, RocketIcon, CubeIcon, ScissorsIcon, DownloadIcon, BrainIcon } from './components/IconComponents';
import type { Settings, ImageResult, SocialPost, MakerWorldPost, CraftMode } from './types';
import { runImageEditing, runAutoCrop, applyAIFilter, generateCollage, generateSocialPosts, generateImageReport, generateMakerWorldPost } from './services/geminiService';
import { usePersistentState } from './hooks/usePersistentState';
import { translations } from './translations';

const initialSettings: Settings = {
    mode: 'themed-bg',
    theme: 'A vibrant, abstract background with swirling colors and a sense of energy.',
    harmonizeStyle: true,
    lightCleanup: true,
    backgroundBlur: false,
    autoCrop: true,
    aspectRatios: ['1:1', '16:9'],
};

const initialCollageTheme = 'A futuristic cityscape at night';

interface HistoryState {
    results: Record<string, ImageResult>;
    tab: ViewTab;
    settings: Settings;
    filter: {
        selected: string;
        customPrompt: string;
    };
}

const App: React.FC = () => {
    // Start with hasApiKey=true to bypass the welcome screen (start in Free mode by default)
    const [hasApiKey, setHasApiKey] = useState(true);
    const [isProMode, setIsProMode] = useState(false);
    const [images, setImages] = useState<File[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageResults, setImageResults] = useState<Record<string, ImageResult>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState('');

    // Settings State
    const [settings, setSettings] = useState<Settings>(initialSettings);

    // Filter states
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [customFilterPrompt, setCustomFilterPrompt] = useState('');

    // Image Viewer State (Lifted up for chaining inputs)
    const [activeTab, setActiveTab] = useState<ViewTab>('original');
    
    // History Stack
    const [history, setHistory] = useState<HistoryState[]>([]);
    
    // Cancellation state
    const abortControllerRef = useRef<boolean>(false);
    
    // Track previous result to auto-switch tabs when new results arrive
    const prevImageResultRef = useRef<ImageResult | null>(null);

    // Language States with persistence
    const [uiLanguage, setUiLanguage] = usePersistentState<'en' | 'it'>('uiLanguage', 'en');
    const [socialPostLanguage, setSocialPostLanguage] = usePersistentState<'en' | 'it'>('socialPostLanguage', 'en');
    const [makerWorldPostLanguage, setMakerWorldPostLanguage] = usePersistentState<'en' | 'it'>('makerWorldPostLanguage', 'en');
    
    // Craft Mode State
    const [craftMode, setCraftMode] = useState<CraftMode>('3d-printing');

    // Translations object
    const t = translations[uiLanguage];

    // Collage states
    const [selectedCollageIndices, setSelectedCollageIndices] = useState<number[]>([]);
    const [collageTheme, setCollageTheme] = useState(initialCollageTheme);
    const [collageResultUrl, setCollageResultUrl] = useState<string | null>(null);
    const [isCreatingCollage, setIsCreatingCollage] = useState(false);
    const [collageEnhancedTheme, setCollageEnhancedTheme] = useState<string | null>(null);
    
    // Social Post states
    const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
    const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);

    // MakerWorld Post states
    const [makerWorldPost, setMakerWorldPost] = useState<MakerWorldPost | null>(null);
    const [isGeneratingMakerWorldPost, setIsGeneratingMakerWorldPost] = useState(false);

    // Handle cancellation
    const handleCancelProcessing = () => {
        abortControllerRef.current = true;
        setIsProcessing(false);
        setIsCreatingCollage(false);
        setIsGeneratingPosts(false);
        setIsGeneratingMakerWorldPost(false);
        setProcessingMessage('');
        setError(null);
    };

    // No auto-login to Pro mode. User starts free, switches manually.
    // However, if we need to check if a key *exists* for dev purposes, we could, but here we enforce default Free.

    const handleSelectKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio) {
            try {
                await aistudio.openSelectKey();
                setHasApiKey(true);
                setIsProMode(true);
                setError(null);
            } catch (e) {
                console.error("Key selection failed or cancelled", e);
            }
        } else {
             console.warn("window.aistudio not available");
        }
    };

    const handleUseFreeVersion = () => {
        setHasApiKey(true);
        setIsProMode(false);
        setError(null);
    };

    const handleToggleProMode = () => {
        if (!isProMode) {
            handleSelectKey();
        } else {
            setIsProMode(false);
        }
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
        setImages(prev => [...prev, ...imageFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ 
        onDrop, 
        accept: { 'image/*': [] },
        noClick: true // Enable click manually on specific buttons
    });

    const currentImage = useMemo(() => images[currentIndex], [images, currentIndex]);
    const currentImageResult = useMemo(() => imageResults[currentImage?.name], [imageResults, currentImage]);

    // Auto-switch tab logic based on new results
    useEffect(() => {
        if (currentImageResult) {
          if (currentImageResult.filtered && !prevImageResultRef.current?.filtered) {
            setActiveTab('filtered');
          } else if (currentImageResult.themedBg && !prevImageResultRef.current?.themedBg) {
            setActiveTab('themedBg');
          } else if (currentImageResult.cleaned && !prevImageResultRef.current?.cleaned) {
            setActiveTab('cleaned');
          } else if (currentImageResult.removedBg && !prevImageResultRef.current?.removedBg) {
            setActiveTab('removedBg');
          } else if (!prevImageResultRef.current || !currentImageResult) {
             // If result exists but nothing specific changed (or first load), usually stay or go to original.
          }
        } else {
            setActiveTab('original');
        }
        prevImageResultRef.current = currentImageResult;
    }, [currentImageResult]);

    // Helper to get the current active image source (File or base64 string)
    const getActiveImageSource = (): File | string => {
        if (!currentImage) throw new Error("No image selected");
        
        if (!currentImageResult) return currentImage;

        // If the user is viewing a specific result, use that as input for the next operation
        switch (activeTab) {
            case 'cleaned':
                return currentImageResult.cleaned || currentImage;
            case 'removedBg':
                return currentImageResult.removedBg || currentImage;
            case 'themedBg':
                return currentImageResult.themedBg || currentImage;
            case 'filtered':
                return currentImageResult.filtered || currentImage;
            case 'crops': 
            case 'report':
            case 'original':
            default:
                return currentImage;
        }
    };

    // History Management
    const pushHistory = () => {
        setHistory(prev => [
            ...prev.slice(-19), // Keep last 20 states
            { 
                results: imageResults, 
                tab: activeTab,
                settings: settings,
                filter: {
                    selected: selectedFilter,
                    customPrompt: customFilterPrompt
                }
            }
        ]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        
        // Remove last entry from history
        setHistory(prev => prev.slice(0, -1));
        
        // Restore state
        setImageResults(previousState.results);
        setActiveTab(previousState.tab);
        setSettings(previousState.settings);
        setSelectedFilter(previousState.filter.selected);
        setCustomFilterPrompt(previousState.filter.customPrompt);
        
        // Update ref to prevent auto-switch logic from interfering
        prevImageResultRef.current = previousState.results[currentImage?.name] || null;
    };

    const handleApiError = (e: any) => {
        const errorMsg = e.message || String(e);
        console.error(e);
        
        let displayError = errorMsg;
        
        // Handle API key permissions or missing entity errors by prompting to re-select key
        if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("403") || errorMsg.includes("permission") || errorMsg.includes("API Key")) {
             if (isProMode) {
                setHasApiKey(false);
                displayError = "API Key Error: Your selected key may be invalid, lacks permissions, or billing is not enabled for this project. Please re-select a valid key.";
             }
        }
        
        if (errorMsg.includes("fetch") || errorMsg.includes("NetworkError")) {
             displayError = "Network Error: The request was blocked. Please check if you have an AdBlocker or firewall blocking Google API calls (generativelanguage.googleapis.com).";
        }

        setError(displayError);
    };

    const processSingleImage = async (image: File, index: number, total: number, useChaining = false) => {
        const updateImageResult = (imageFile: File, data: Partial<ImageResult>) => {
            setImageResults(prev => ({
                ...prev,
                [imageFile.name]: {
                    ...prev[imageFile.name],
                    original: prev[imageFile.name]?.original || URL.createObjectURL(imageFile),
                    cropProposals: prev[imageFile.name]?.cropProposals || [],
                    ...data,
                },
            }));
        };

        const setStepMessage = (step: string) => {
            setProcessingMessage(t.processingStep(index + 1, total, step));
        };

        try {
            if (abortControllerRef.current) return;
            setStepMessage(t.stepEditing);
            
            // Save history only if we are doing single image editing (chaining)
            if (useChaining) {
                pushHistory();
            }

            const inputImage = useChaining ? getActiveImageSource() : image;
            
            // Smart Routing:
            // Themed BG -> Uses Pro model if isProMode is true.
            // Cleanup / Remove BG -> Always uses Free model to save costs.
            const useProModelForEditing = isProMode && settings.mode === 'themed-bg';

            const editedImageUrl = await runImageEditing(inputImage, settings, useProModelForEditing);
            if (abortControllerRef.current) return;

            const resultUpdate: Partial<ImageResult> = {};
            if (settings.mode === 'cleanup-only') resultUpdate.cleaned = editedImageUrl;
            if (settings.mode === 'remove-bg') resultUpdate.removedBg = editedImageUrl;
            if (settings.mode === 'themed-bg') {
                resultUpdate.themedBg = editedImageUrl;
                resultUpdate.enhancedTheme = settings.theme;
            }
            updateImageResult(image, resultUpdate);

            if (abortControllerRef.current) return;
            setStepMessage(t.stepAnalyzing);
            const report = await generateImageReport(inputImage, settings);
            if (abortControllerRef.current) return;
            updateImageResult(image, { report });

            if (settings.autoCrop) {
                if (abortControllerRef.current) return;
                setStepMessage(t.stepCropping);
                const cropProposals = await runAutoCrop(editedImageUrl, settings.aspectRatios);
                if (abortControllerRef.current) return;
                updateImageResult(image, { cropProposals });
            }
        } catch (e: any) {
            if (abortControllerRef.current) return;
            handleApiError(e);
            throw e;
        }
    };

    const handleProcessCurrentImage = async () => {
        if (!currentImage) return;

        abortControllerRef.current = false;
        setIsProcessing(true);
        setProcessingMessage(t.processingSingle);
        setError(null);
        
        // Pass true for useChaining to use the currently visible image as input
        await processSingleImage(currentImage, 0, 1, true).catch(() => {});

        if (!abortControllerRef.current) {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleProcessImages = async () => {
        if (images.length === 0) return;
    
        abortControllerRef.current = false;
        setIsProcessing(true);
        setError(null);
    
        for (const [index, image] of images.entries()) {
            if (abortControllerRef.current) break;
            setCurrentIndex(index); 
            try {
                // Batch processing uses original images (false for chaining)
                // We don't save history per step in batch to avoid flooding
                await processSingleImage(image, index, images.length, false);
            } catch (e) {
                break;
            }
        }
    
        setIsProcessing(false);
        setProcessingMessage('');
        if (!abortControllerRef.current) {
            setCurrentIndex(0); 
        }
    };
    
    const onApplyFilter = async () => {
        if (!currentImage || selectedFilter === 'none') return;
        
        const filterPrompt = selectedFilter === 'custom'
            ? customFilterPrompt
            : selectedFilter;

        if (!filterPrompt.trim()) return;
        
        abortControllerRef.current = false;
        setIsProcessing(true);
        setProcessingMessage(t.processingStep(1, 1, t.stepFiltering));
        setError(null);

        try {
            // Save state before applying filter
            pushHistory();

            const inputImage = getActiveImageSource();
            
            // Smart Routing: AI Filters use Free model (Flash) as requested for "altri compiti"
            const { imageUrl, enhancedPrompt } = await applyAIFilter(inputImage, filterPrompt, false);
            
            if (abortControllerRef.current) return;

            setImageResults(prev => ({
                ...prev,
                [currentImage.name]: {
                    ...prev[currentImage.name],
                    original: prev[currentImage.name]?.original || URL.createObjectURL(currentImage),
                    filtered: imageUrl,
                    enhancedFilterPrompt: enhancedPrompt
                },
            }));

        } catch(e: any) {
             if (!abortControllerRef.current) handleApiError(e);
        } finally {
            if (!abortControllerRef.current) {
                setIsProcessing(false);
                setProcessingMessage('');
            }
        }
    };
    
    const handleInvertFilterResult = async () => {
        if (!currentImage || !currentImageResult?.filtered) return;

        abortControllerRef.current = false;
        setIsProcessing(true);
        setProcessingMessage('Inverting colors...'); 
        
        try {
            pushHistory();

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = currentImageResult.filtered;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            if (abortControllerRef.current) return;

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas context failed");

            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];     // r
                data[i + 1] = 255 - data[i + 1]; // g
                data[i + 2] = 255 - data[i + 2]; // b
            }
            ctx.putImageData(imageData, 0, 0);
            
            const invertedUrl = canvas.toDataURL(currentImageResult.filtered.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');

            setImageResults(prev => ({
                ...prev,
                [currentImage.name]: {
                    ...prev[currentImage.name],
                    filtered: invertedUrl
                }
            }));
            
            setActiveTab('filtered');

        } catch (e: any) {
            setError(`Inversion failed: ${e.message}`);
            console.error(e);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };
    
    const handleAddManualCrop = (croppedUrl: string) => {
        if (!currentImage) return;

        setImageResults(prev => {
            const currentResult = prev[currentImage.name];
            return {
                ...prev,
                [currentImage.name]: {
                    ...currentResult,
                    cropProposals: [
                        {
                            imageUrl: croppedUrl,
                            aspectRatio: '1:1', // Using 1:1 as a placeholder type for the type system, but logic treats it as custom
                            compositionScore: 100,
                            rationale: 'Custom crop created by user.'
                        },
                        ...(currentResult?.cropProposals || [])
                    ]
                }
            };
        });
    };

    const handleGenerateCollage = async () => {
        const selectedImages = selectedCollageIndices.map(i => images[i]);
        if (selectedImages.length < 2) return;

        abortControllerRef.current = false;
        setIsCreatingCollage(true);
        setError(null);
        setCollageResultUrl(null);
        setCollageEnhancedTheme(null);
        try {
            // Collage always uses Pro model if isProMode is active
            const { imageUrl, enhancedTheme } = await generateCollage(selectedImages, collageTheme, isProMode);
            if (abortControllerRef.current) return;
            setCollageResultUrl(imageUrl);
            setCollageEnhancedTheme(enhancedTheme);
        } catch (e: any) {
            if (!abortControllerRef.current) handleApiError(e);
        } finally {
            if (!abortControllerRef.current) setIsCreatingCollage(false);
        }
    };

    const handleGeneratePosts = async (context: string, language: 'en' | 'it') => {
        if (!currentImage) return;

        abortControllerRef.current = false;
        setIsGeneratingPosts(true);
        setError(null);
        setSocialPosts([]);
        try {
            const inputImage = getActiveImageSource();
            const posts = await generateSocialPosts(inputImage, context, language, craftMode);
            if (abortControllerRef.current) return;
            setSocialPosts(posts);
        } catch (e: any) {
            if (!abortControllerRef.current) handleApiError(e);
        } finally {
            if (!abortControllerRef.current) setIsGeneratingPosts(false);
        }
    };

     const handleGenerateMakerWorldPost = async (context: string, language: 'en' | 'it') => {
        if (!currentImage) return;

        abortControllerRef.current = false;
        setIsGeneratingMakerWorldPost(true);
        setError(null);
        setMakerWorldPost(null);
        try {
            const inputImage = getActiveImageSource();
            const post = await generateMakerWorldPost(inputImage, context, language, craftMode);
            if (abortControllerRef.current) return;
            setMakerWorldPost(post);
        } catch (e: any) {
            if (!abortControllerRef.current) handleApiError(e);
        } finally {
            if (!abortControllerRef.current) setIsGeneratingMakerWorldPost(false);
        }
    };

    const handleToggleCollageSelection = (index: number) => {
        setSelectedCollageIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleReset = () => {
        // Reset all relevant states to their initial values
        setImages([]);
        setCurrentIndex(0);
        setImageResults({});
        setHistory([]); // Clear history
        setIsProcessing(false);
        setError(null);
        setProcessingMessage('');
        setSettings(initialSettings);
        setSelectedFilter('none');
        setCustomFilterPrompt('');
        setSelectedCollageIndices([]);
        setCollageTheme(initialCollageTheme);
        setCollageResultUrl(null);
        setIsCreatingCollage(false);
        setCollageEnhancedTheme(null);
        setSocialPosts([]);
        setIsGeneratingPosts(false);
        setMakerWorldPost(null);
        setIsGeneratingMakerWorldPost(false);
        setActiveTab('original');
        setCraftMode('3d-printing');
    };

    if (!hasApiKey) {
        // This block is effectively unused on first load now because hasApiKey defaults to true,
        // but it remains as a fallback if the API key check explicitly fails and sets hasApiKey(false) later.
        return (
            <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col items-center justify-center p-4">
                 <div className="text-center space-y-8 max-w-2xl bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">{t.welcomeTitle}</h1>
                    <p className="text-gray-300 text-lg">{t.welcomeSubtitle}</p>
                    
                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-sm text-left">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6 mt-8">
                        {/* Free Option */}
                        <div className="bg-gray-700/50 p-6 rounded-xl border border-gray-600 hover:border-indigo-500 transition-colors">
                            <h2 className="text-xl font-bold text-white mb-2">{t.freeModeTitle}</h2>
                            <p className="text-gray-400 text-sm mb-6 min-h-[40px]">{t.freeModeDesc}</p>
                            <button 
                                onClick={handleUseFreeVersion}
                                className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                            >
                                {t.useFreeVersion}
                            </button>
                        </div>

                        {/* Pro Option */}
                        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6 rounded-xl border border-indigo-500/50 hover:border-indigo-400 transition-colors shadow-lg">
                            <h2 className="text-xl font-bold text-indigo-300 mb-2">{t.proModeTitle}</h2>
                            <p className="text-gray-400 text-sm mb-6 min-h-[40px]">{t.proModeDesc}</p>
                            <button 
                                onClick={handleSelectKey}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-indigo-500/30"
                            >
                                {t.useProVersion}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-700 text-xs text-gray-500">
                        For Pro features, billing must be enabled for your project. <br/>
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-indigo-400">Read more about pricing</a>
                    </div>
                 </div>
            </div>
        );
    }

    const isAnythingProcessing = isProcessing || isCreatingCollage || isGeneratingPosts || isGeneratingMakerWorldPost;
    
    const hasFilteredResult = !!currentImageResult?.filtered;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <input {...getInputProps()} />
            <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-40 p-4 border-b border-gray-700">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">{t.appTitle}</h1>
                         {isProMode ? (
                             <span className="bg-indigo-900 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-700">{t.modePro}</span>
                         ) : (
                             <span className="bg-gray-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-600">{t.modeFree}</span>
                         )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-40 hidden md:block">
                            <LanguageSwitcher 
                                language={uiLanguage} 
                                setLanguage={setUiLanguage} 
                                disabled={isAnythingProcessing}
                            />
                        </div>
                        {isAnythingProcessing ? (
                            <div className="flex items-center justify-center gap-2 bg-gray-700 text-white font-bold py-2 px-4 rounded-lg min-w-[160px]">
                                <Loader />
                                <span>{processingMessage || t.processingGeneric}</span>
                                <button 
                                    onClick={handleCancelProcessing}
                                    className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                                    title={t.cancel}
                                >
                                    <XCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSelectKey}
                                    className={`text-xs py-1 px-3 rounded transition-colors mr-2 border ${isProMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700' : 'bg-indigo-900/50 text-indigo-200 border-indigo-800 hover:bg-indigo-800'}`}
                                    title="Change API Key"
                                >
                                    {isProMode ? 'Key' : t.upgradeToPro}
                                </button>
                                {hasApiKey && (
                                     <button
                                        onClick={handleToggleProMode}
                                        className={`text-xs py-1 px-3 rounded transition-colors mr-2 font-bold border ${isProMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500' : 'bg-gray-600 hover:bg-gray-500 text-gray-200 border-gray-500'}`}
                                    >
                                        {isProMode ? t.switchToFree : t.switchToPro}
                                    </button>
                                )}
                                {images.length > 0 && (
                                    <>
                                         <button
                                            onClick={handleUndo}
                                            disabled={history.length === 0}
                                            className="hidden sm:flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={t.undo}
                                        >
                                            <UndoIcon className="w-5 h-5" />
                                            <span>{t.undo}</span>
                                        </button>
                                        <div className="w-px h-8 bg-gray-700 mx-1 hidden sm:block"></div>
                                        <button
                                            onClick={handleProcessCurrentImage}
                                            disabled={isAnythingProcessing}
                                            className="hidden sm:flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            ✨ <span>{t.runProcessCurrent}</span>
                                        </button>
                                        {images.length > 1 && (
                                            <button
                                                onClick={handleProcessImages}
                                                disabled={isAnythingProcessing}
                                                className="hidden sm:flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                🚀 <span>{t.runProcessOnAllShort(images.length)}</span>
                                            </button>
                                        )}
                                        <div className="w-px h-8 bg-gray-700 mx-1"></div>
                                        <button
                                            onClick={open}
                                            disabled={isAnythingProcessing}
                                            className="bg-gray-700 hover:bg-gray-600 text-white p-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            aria-label={t.addImages}
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                            <span className="hidden sm:inline text-sm font-semibold">{t.addImages}</span>
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            disabled={isAnythingProcessing}
                                            className="bg-red-800 hover:bg-red-700 text-white p-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label={t.startOver}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                {images.length === 0 ? (
                    <>
                        <div {...getRootProps()} onClick={open} className={`mt-10 flex flex-col items-center justify-center py-16 px-6 border-2 border-gray-600 border-dashed rounded-3xl cursor-pointer hover:border-indigo-500 hover:bg-gray-800/30 transition-all duration-300 group ${isDragActive ? 'border-indigo-500 bg-gray-800' : ''}`}>
                            <div className="bg-gray-800 p-6 rounded-full group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-colors mb-4">
                                <UploadIcon className="h-12 w-12 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-200 group-hover:text-white transition-colors">{t.uploadTitle}</h3>
                            <p className="mt-2 text-sm text-gray-500 group-hover:text-gray-400">{t.uploadSubtitle}</p>
                        </div>

                        {/* Updated Flow Chart Infographic */}
                        <div className="mt-16 w-full max-w-6xl mx-auto">
                            <h3 className="text-3xl font-bold text-center mb-16 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tight">
                                {t.infographicTitle}
                            </h3>

                            {/* Main Flex Container */}
                            <div className="flex flex-col xl:flex-row items-center justify-center gap-0">
                                
                                {/* Node 1: Upload */}
                                <div className="z-10 w-64 flex-shrink-0">
                                    <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700 p-6 rounded-2xl shadow-xl hover:border-indigo-500/50 transition-all duration-300 relative group">
                                         <div className="absolute -top-3 left-6 bg-gray-700 text-[10px] font-bold px-2 py-0.5 rounded text-gray-300 border border-gray-600 uppercase tracking-wide">Step 1</div>
                                        <div className="flex flex-col items-center text-center space-y-3">
                                            <div className="p-3 bg-gray-900 rounded-full text-indigo-400 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                                <UploadIcon className="w-8 h-8" />
                                            </div>
                                            <h4 className="font-bold text-white text-lg">{t.nodeUpload}</h4>
                                            <p className="text-xs text-gray-400">{t.nodeUploadDesc}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Connector: Upload -> Brain (Desktop) */}
                                <div className="hidden xl:flex items-center w-24 -mx-1 z-0 relative">
                                    <div className="h-0.5 w-full bg-gradient-to-r from-gray-700 to-indigo-600/50 relative overflow-hidden">
                                         <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/2 animate-shimmer"></div>
                                    </div>
                                    <svg className="w-5 h-5 text-indigo-500 -ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                </div>
                                
                                {/* Connector: Upload -> Brain (Mobile) */}
                                <div className="xl:hidden h-8 border-l-2 border-dashed border-indigo-500/30 my-2"></div>

                                {/* Node 2: AI Brain */}
                                <div className="z-20 my-2 xl:my-0 flex-shrink-0">
                                    <div className="w-40 h-40 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-shadow duration-500 border-4 border-gray-900 relative">
                                        <div className="text-center">
                                            <BrainIcon className="w-16 h-16 text-white mx-auto drop-shadow-lg animate-pulse-slow" />
                                            <div className="text-xs font-bold text-white mt-2 tracking-wider uppercase opacity-90">Gemini AI</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Connector: Brain -> Features (Desktop Split) */}
                                <div className="hidden xl:block w-32 h-[320px] relative -ml-1">
                                    <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none">
                                        {/* Top Path */}
                                        <path d="M0,160 C50,160 50,53 128,53" fill="none" stroke="url(#gradSplit1)" strokeWidth="2" strokeDasharray="6 4" className="animate-flow-slow" />
                                        {/* Middle Path */}
                                        <path d="M0,160 C50,160 50,160 128,160" fill="none" stroke="url(#gradSplit2)" strokeWidth="2" strokeDasharray="6 4" className="animate-flow-slow" />
                                        {/* Bottom Path */}
                                        <path d="M0,160 C50,160 50,266 128,266" fill="none" stroke="url(#gradSplit3)" strokeWidth="2" strokeDasharray="6 4" className="animate-flow-slow" />
                                        
                                        <defs>
                                            <linearGradient id="gradSplit1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4F46E5" stopOpacity="1" /><stop offset="100%" stopColor="#4F46E5" stopOpacity="0.3" /></linearGradient>
                                            <linearGradient id="gradSplit2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4F46E5" stopOpacity="1" /><stop offset="100%" stopColor="#EC4899" stopOpacity="0.3" /></linearGradient>
                                            <linearGradient id="gradSplit3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4F46E5" stopOpacity="1" /><stop offset="100%" stopColor="#06B6D4" stopOpacity="0.3" /></linearGradient>
                                        </defs>
                                    </svg>
                                </div>

                                {/* Connector: Brain -> Features (Mobile) */}
                                <div className="xl:hidden h-8 border-l-2 border-dashed border-indigo-500/30 my-2"></div>

                                {/* Node Group 3: Features */}
                                <div className="flex flex-col gap-6 w-full xl:w-80 flex-shrink-0">
                                    {/* Feature 1 */}
                                    <div className="bg-gray-800/60 backdrop-blur border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 hover:border-indigo-500/30 transition-all duration-300 group h-[90px]">
                                         <div className="p-2.5 bg-indigo-900/30 rounded-lg text-indigo-400 group-hover:text-indigo-300 group-hover:bg-indigo-900/50 transition-colors"><ScissorsIcon className="w-5 h-5" /></div>
                                         <div className="flex-1">
                                             <h5 className="font-bold text-gray-200 text-sm mb-1">{t.nodeBatch}</h5>
                                             <div className="text-[10px] text-gray-500 leading-tight">{t.batchDetail1}, {t.batchDetail2}</div>
                                         </div>
                                    </div>
                                    {/* Feature 2 */}
                                    <div className="bg-gray-800/60 backdrop-blur border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 hover:border-pink-500/30 transition-all duration-300 group h-[90px]">
                                         <div className="p-2.5 bg-pink-900/30 rounded-lg text-pink-400 group-hover:text-pink-300 group-hover:bg-pink-900/50 transition-colors"><WandIcon className="w-5 h-5" /></div>
                                         <div className="flex-1">
                                             <h5 className="font-bold text-gray-200 text-sm mb-1">{t.nodeCreative}</h5>
                                              <div className="text-[10px] text-gray-500 leading-tight">{t.creativeDetail1}, {t.creativeDetail2}</div>
                                         </div>
                                    </div>
                                    {/* Feature 3 */}
                                    <div className="bg-gray-800/60 backdrop-blur border border-gray-700 p-4 rounded-xl flex items-center gap-4 hover:bg-gray-800 hover:border-cyan-500/30 transition-all duration-300 group h-[90px]">
                                         <div className="p-2.5 bg-cyan-900/30 rounded-lg text-cyan-400 group-hover:text-cyan-300 group-hover:bg-cyan-900/50 transition-colors"><RocketIcon className="w-5 h-5" /></div>
                                         <div className="flex-1">
                                             <h5 className="font-bold text-gray-200 text-sm mb-1">{t.nodeContent}</h5>
                                             <div className="text-[10px] text-gray-500 leading-tight">{t.contentDetail1}, {t.contentDetail2}</div>
                                         </div>
                                    </div>
                                </div>

                                {/* Connector: Features -> Download (Desktop Merge) */}
                                <div className="hidden xl:block w-24 h-[320px] relative -mx-1">
                                    <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none">
                                        {/* Top Path */}
                                        <path d="M0,53 C50,53 50,160 100,160" fill="none" stroke="#374151" strokeWidth="2" />
                                        {/* Middle Path */}
                                        <path d="M0,160 C50,160 50,160 100,160" fill="none" stroke="#374151" strokeWidth="2" />
                                        {/* Bottom Path */}
                                        <path d="M0,266 C50,266 50,160 100,160" fill="none" stroke="#374151" strokeWidth="2" />
                                    </svg>
                                    <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10 text-gray-600 bg-gray-900 rounded-full">
                                         <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                                
                                {/* Connector: Features -> Download (Mobile) */}
                                <div className="xl:hidden h-8 border-l-2 border-dashed border-indigo-500/30 my-2"></div>

                                {/* Node 5: Final */}
                                <div className="z-10 w-64 flex-shrink-0 mt-2 xl:mt-0 ml-0 xl:ml-4">
                                    <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700 p-6 rounded-2xl shadow-xl hover:border-emerald-500/50 transition-all duration-300 relative group">
                                         <div className="absolute -top-3 right-6 bg-gray-700 text-[10px] font-bold px-2 py-0.5 rounded text-gray-300 border border-gray-600 uppercase tracking-wide">Step 5</div>
                                        <div className="flex flex-col items-center text-center space-y-3">
                                            <div className="p-3 bg-gray-900 rounded-full text-emerald-400 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                                <DownloadIcon className="w-8 h-8" />
                                            </div>
                                            <h4 className="font-bold text-white text-lg">{t.nodeReview}</h4>
                                            <p className="text-xs text-gray-400">{t.reviewDetail}</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                            
                            <style>{`
                                .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                                .animate-flow-slow { stroke-dasharray: 8 4; animation: flow 20s linear infinite; }
                                .animate-shimmer { animation: shimmer 2s linear infinite; }
                                @keyframes flow { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
                                @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
                            `}</style>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            <div className="lg:col-span-1">
                                <SettingsPanel 
                                    t={t}
                                    settings={settings} 
                                    setSettings={setSettings}
                                    disabled={isAnythingProcessing}
                                    selectedFilter={selectedFilter}
                                    setSelectedFilter={setSelectedFilter}
                                    customFilterPrompt={customFilterPrompt}
                                    setCustomFilterPrompt={setCustomFilterPrompt}
                                    onApplyFilter={onApplyFilter}
                                    isImageLoaded={!!currentImage}
                                    onInvertFilter={handleInvertFilterResult}
                                    hasFilteredResult={hasFilteredResult}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <ImageViewer
                                    t={t}
                                    imageResult={currentImageResult}
                                    originalImage={currentImage}
                                    onRegenerateTheme={handleProcessCurrentImage} 
                                    isProcessing={isProcessing}
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    onAddManualCrop={handleAddManualCrop}
                                />
                            </div>
                        </div>
                        
                        <ImageThumbnailStrip 
                            t={t}
                            images={images} 
                            currentIndex={currentIndex} 
                            onSelect={setCurrentIndex} 
                            disabled={isAnythingProcessing}
                            selectedIndices={selectedCollageIndices}
                            onToggleSelection={handleToggleCollageSelection}
                        />

                        <CollageCreator 
                            t={t}
                            theme={collageTheme}
                            setTheme={setCollageTheme}
                            onGenerate={handleGenerateCollage}
                            resultUrl={collageResultUrl}
                            isProcessing={isCreatingCollage}
                            selectedCount={selectedCollageIndices.length}
                            enhancedTheme={collageEnhancedTheme}
                        />

                        <SocialPostGenerator
                          t={t}
                          onGenerate={handleGeneratePosts}
                          posts={socialPosts}
                          isProcessing={isGeneratingPosts}
                          isImageLoaded={!!currentImage}
                          language={socialPostLanguage}
                          setLanguage={setSocialPostLanguage}
                          craftMode={craftMode}
                          setCraftMode={setCraftMode}
                        />

                        <MakerWorldPostGenerator
                          t={t}
                          onGenerate={handleGenerateMakerWorldPost}
                          post={makerWorldPost}
                          isProcessing={isGeneratingMakerWorldPost}
                          isImageLoaded={!!currentImage}
                          language={makerWorldPostLanguage}
                          setLanguage={setMakerWorldPostLanguage}
                          craftMode={craftMode}
                          setCraftMode={setCraftMode}
                        />
                    </>
                )}
                 {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-sm fixed bottom-4 right-4 z-[100] max-w-md shadow-lg animate-fade-in">
                        <strong>Error:</strong> {error}
                        <button onClick={() => setError(null)} className="ml-2 underline float-right hover:text-white">Dismiss</button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
