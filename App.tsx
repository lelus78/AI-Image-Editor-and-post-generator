
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
import { UploadIcon, TrashIcon, PlusIcon, UndoIcon } from './components/IconComponents';
import type { Settings, ImageResult, SocialPost, MakerWorldPost } from './types';
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
    
    // Track previous result to auto-switch tabs when new results arrive
    const prevImageResultRef = useRef<ImageResult | null>(null);

    // Language States with persistence
    const [uiLanguage, setUiLanguage] = usePersistentState<'en' | 'it'>('uiLanguage', 'en');
    const [socialPostLanguage, setSocialPostLanguage] = usePersistentState<'en' | 'it'>('socialPostLanguage', 'en');
    const [makerWorldPostLanguage, setMakerWorldPostLanguage] = usePersistentState<'en' | 'it'>('makerWorldPostLanguage', 'en');
    
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
             // However, when Undoing, we might want to stay on the restored tab.
             // The useEffect below controls that, but here we just want to catch *newly generated* stuff.
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
            case 'crops': // Crops are rarely used as input for full image edit, fallback to original
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
            setStepMessage(t.stepEditing);
            
            // Save history only if we are doing single image editing (chaining)
            if (useChaining) {
                pushHistory();
            }

            const inputImage = useChaining ? getActiveImageSource() : image;
            
            const editedImageUrl = await runImageEditing(inputImage, settings);

            const resultUpdate: Partial<ImageResult> = {};
            if (settings.mode === 'cleanup-only') resultUpdate.cleaned = editedImageUrl;
            if (settings.mode === 'remove-bg') resultUpdate.removedBg = editedImageUrl;
            if (settings.mode === 'themed-bg') {
                resultUpdate.themedBg = editedImageUrl;
                resultUpdate.enhancedTheme = settings.theme;
            }
            updateImageResult(image, resultUpdate);

            setStepMessage(t.stepAnalyzing);
            const report = await generateImageReport(inputImage, settings);
            updateImageResult(image, { report });

            if (settings.autoCrop) {
                setStepMessage(t.stepCropping);
                const cropProposals = await runAutoCrop(editedImageUrl, settings.aspectRatios);
                updateImageResult(image, { cropProposals });
            }
        } catch (e: any) {
            const errorMessage = `Error processing image "${image.name}": ${e.message}`;
            setError(errorMessage);
            console.error(e);
            throw e;
        }
    };

    const handleProcessCurrentImage = async () => {
        if (!currentImage) return;

        setIsProcessing(true);
        setProcessingMessage(t.processingSingle);
        setError(null);
        
        // Pass true for useChaining to use the currently visible image as input
        await processSingleImage(currentImage, 0, 1, true).catch(() => {});

        setIsProcessing(false);
        setProcessingMessage('');
    };

    const handleProcessImages = async () => {
        if (images.length === 0) return;
    
        setIsProcessing(true);
        setError(null);
    
        for (const [index, image] of images.entries()) {
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
        setCurrentIndex(0); 
    };
    
    const onApplyFilter = async () => {
        if (!currentImage || selectedFilter === 'none') return;
        
        const filterPrompt = selectedFilter === 'custom'
            ? customFilterPrompt
            : selectedFilter;

        if (!filterPrompt.trim()) return;
        
        setIsProcessing(true);
        setProcessingMessage(t.processingStep(1, 1, t.stepFiltering));
        setError(null);

        try {
            // Save state before applying filter
            pushHistory();

            const inputImage = getActiveImageSource();
            const { imageUrl, enhancedPrompt } = await applyAIFilter(inputImage, filterPrompt);
            
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
            setError(`An error occurred while applying the filter: ${e.message}`);
            console.error(e);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };
    
    const handleInvertFilterResult = async () => {
        if (!currentImage || !currentImageResult?.filtered) return;

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

    const handleGenerateCollage = async () => {
        const selectedImages = selectedCollageIndices.map(i => images[i]);
        if (selectedImages.length < 2) return;

        setIsCreatingCollage(true);
        setError(null);
        setCollageResultUrl(null);
        setCollageEnhancedTheme(null);
        try {
            const { imageUrl, enhancedTheme } = await generateCollage(selectedImages, collageTheme);
            setCollageResultUrl(imageUrl);
            setCollageEnhancedTheme(enhancedTheme);
        } catch (e: any) {
            setError(`An error occurred during collage creation: ${e.message}`);
            console.error(e);
        } finally {
            setIsCreatingCollage(false);
        }
    };

    const handleGeneratePosts = async (context: string, language: 'en' | 'it') => {
        if (!currentImage) return;

        setIsGeneratingPosts(true);
        setError(null);
        setSocialPosts([]);
        try {
            const inputImage = getActiveImageSource();
            const posts = await generateSocialPosts(inputImage, context, language);
            setSocialPosts(posts);
        } catch (e: any)
{
            setError(`An error occurred during post generation: ${e.message}`);
            console.error(e);
        } finally {
            setIsGeneratingPosts(false);
        }
    };

     const handleGenerateMakerWorldPost = async (context: string, language: 'en' | 'it') => {
        if (!currentImage) return;

        setIsGeneratingMakerWorldPost(true);
        setError(null);
        setMakerWorldPost(null);
        try {
            const inputImage = getActiveImageSource();
            const post = await generateMakerWorldPost(inputImage, context, language);
            setMakerWorldPost(post);
        } catch (e: any) {
            setError(`An error occurred during MakerWorld post generation: ${e.message}`);
            console.error(e);
        } finally {
            setIsGeneratingMakerWorldPost(false);
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
    };

    const isAnythingProcessing = isProcessing || isCreatingCollage || isGeneratingPosts || isGeneratingMakerWorldPost;
    
    const hasFilteredResult = !!currentImageResult?.filtered;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <input {...getInputProps()} />
            <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-gray-700">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">{t.appTitle}</h1>
                    <div className="flex items-center gap-4">
                        <div className="w-40">
                            <LanguageSwitcher 
                                language={uiLanguage} 
                                setLanguage={setUiLanguage} 
                                disabled={isAnythingProcessing}
                            />
                        </div>
                        {isAnythingProcessing ? (
                            <div className="flex items-center justify-center gap-2 bg-gray-700 text-white font-bold py-2 px-6 rounded-lg min-w-[160px]">
                                <Loader />
                                <span>{processingMessage || t.processingGeneric}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
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
                    <div {...getRootProps()} onClick={open} className={`mt-10 flex justify-center px-6 pt-12 pb-12 border-2 border-gray-600 border-dashed rounded-2xl cursor-pointer hover:border-indigo-500 transition-colors ${isDragActive ? 'border-indigo-500 bg-gray-800' : ''}`}>
                        <div className="text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-300">{t.uploadTitle}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t.uploadSubtitle}</p>
                        </div>
                    </div>
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
                                />
                            </div>
                        </div>
                        
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
                        />

                        <MakerWorldPostGenerator
                          t={t}
                          onGenerate={handleGenerateMakerWorldPost}
                          post={makerWorldPost}
                          isProcessing={isGeneratingMakerWorldPost}
                          isImageLoaded={!!currentImage}
                          language={makerWorldPostLanguage}
                          setLanguage={setMakerWorldPostLanguage}
                        />
                    </>
                )}
                 {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center">{error}</div>}
            </main>

            {images.length > 0 && (
                <footer className="sticky bottom-0 bg-gray-900/80 backdrop-blur-sm p-4 border-t border-gray-800">
                    <div className="container mx-auto">
                        <ImageThumbnailStrip 
                            t={t}
                            images={images} 
                            currentIndex={currentIndex} 
                            onSelect={setCurrentIndex}
                            disabled={isAnythingProcessing}
                            selectedIndices={selectedCollageIndices}
                            onToggleSelection={handleToggleCollageSelection}
                        />
                    </div>
                </footer>
            )}
        </div>
    );
};

export default App;
