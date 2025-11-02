import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { SettingsPanel } from './components/SettingsPanel';
import { ImageViewer } from './components/ImageViewer';
import { ImageThumbnailStrip } from './components/ImageThumbnailStrip';
import { CollageCreator } from './components/CollageCreator';
import { SocialPostGenerator } from './components/SocialPostGenerator';
import { MakerWorldPostGenerator } from './components/MakerWorldPostGenerator';
import { Loader } from './components/Loader';
import { UploadIcon } from './components/IconComponents';
import type { Settings, ImageResult, SocialPost, MakerWorldPost } from './types';
import { runImageEditing, runAutoCrop, applyAIFilter, generateCollage, generateSocialPosts, generateImageReport, generateMakerWorldPost } from './services/geminiService';

const App: React.FC = () => {
    const [images, setImages] = useState<File[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageResults, setImageResults] = useState<Record<string, ImageResult>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [settings, setSettings] = useState<Settings>({
        mode: 'themed-bg',
        theme: 'A vibrant, abstract background with swirling colors',
        harmonizeStyle: true,
        lightCleanup: true,
        autoCrop: true,
        aspectRatios: ['1:1', '16:9'],
    });

    // Filter states
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [customFilterPrompt, setCustomFilterPrompt] = useState('');

    // Collage states
    const [selectedCollageIndices, setSelectedCollageIndices] = useState<number[]>([]);
    const [collageTheme, setCollageTheme] = useState('A futuristic cityscape at night');
    const [collageResultUrl, setCollageResultUrl] = useState<string | null>(null);
    const [isCreatingCollage, setIsCreatingCollage] = useState(false);
    const [collageEnhancedTheme, setCollageEnhancedTheme] = useState<string | null>(null);
    
    // Social Post states
    const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
    const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
    const [socialPostLanguage, setSocialPostLanguage] = useState<'en' | 'it'>('en');

    // MakerWorld Post states
    const [makerWorldPost, setMakerWorldPost] = useState<MakerWorldPost | null>(null);
    const [isGeneratingMakerWorldPost, setIsGeneratingMakerWorldPost] = useState(false);
    const [makerWorldPostLanguage, setMakerWorldPostLanguage] = useState<'en' | 'it'>('en');

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
        setImages(prev => [...prev, ...imageFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const currentImage = useMemo(() => images[currentIndex], [images, currentIndex]);
    const currentImageResult = useMemo(() => imageResults[currentImage?.name], [imageResults, currentImage]);

    const handleProcessImages = async () => {
        if (images.length === 0) return;
    
        setIsProcessing(true);
        setError(null);
    
        for (const [index, image] of images.entries()) {
            setCurrentIndex(index); // Update UI to show which image is being processed
    
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
    
            try {
                const editedImageUrl = await runImageEditing(image, settings);
    
                const resultUpdate: Partial<ImageResult> = {};
                if (settings.mode === 'cleanup-only') resultUpdate.cleaned = editedImageUrl;
                if (settings.mode === 'remove-bg') resultUpdate.removedBg = editedImageUrl;
                if (settings.mode === 'themed-bg') {
                    resultUpdate.themedBg = editedImageUrl;
                    resultUpdate.enhancedTheme = settings.theme; // Placeholder
                }
                updateImageResult(image, resultUpdate);

                // Generate the synthetic report
                const report = await generateImageReport(image, settings);
                updateImageResult(image, { report });
    
                if (settings.autoCrop) {
                    // Always crop the newly edited image for consistency
                    const cropProposals = await runAutoCrop(editedImageUrl, settings.aspectRatios);
                    updateImageResult(image, { cropProposals });
                }
    
            } catch (e: any) {
                const errorMessage = `Error processing image "${image.name}": ${e.message}`;
                setError(errorMessage);
                console.error(e);
                // Continue to the next image even if one fails
            }
        }
    
        setIsProcessing(false);
        setCurrentIndex(0); // Reset to the first image for review
    };
    
    const onApplyFilter = async () => {
        if (!currentImage || selectedFilter === 'none') return;
        
        const filterPrompt = selectedFilter === 'custom'
            ? customFilterPrompt
            : filterOptions.find(f => f.value === selectedFilter)?.value || '';

        if (!filterPrompt.trim()) return;
        
        setIsProcessing(true);
        setError(null);

        const updateCurrentImageResult = (data: Partial<ImageResult>) => {
            if (currentImage) {
                setImageResults(prev => ({
                    ...prev,
                    [currentImage.name]: {
                        ...prev[currentImage.name],
                        original: prev[currentImage.name]?.original || URL.createObjectURL(currentImage),
                        cropProposals: prev[currentImage.name]?.cropProposals || [],
                        ...data,
                    },
                }));
            }
        };

        try {
            const { imageUrl, enhancedPrompt } = await applyAIFilter(currentImage, filterPrompt);
            updateCurrentImageResult({ filtered: imageUrl, enhancedFilterPrompt: enhancedPrompt });
        } catch(e: any) {
            setError(`An error occurred while applying the filter: ${e.message}`);
            console.error(e);
        } finally {
            setIsProcessing(false);
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
            const posts = await generateSocialPosts(currentImage, context, language);
            setSocialPosts(posts);
        } catch (e: any) {
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
            const post = await generateMakerWorldPost(currentImage, context, language);
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

    const isAnythingProcessing = isProcessing || isCreatingCollage || isGeneratingPosts || isGeneratingMakerWorldPost;
    
    const processButtonText = useMemo(() => {
        if (isProcessing) {
            return `Processing ${currentIndex + 1}/${images.length}...`;
        }
        if (images.length > 1) {
            return `Run Process on All (${images.length})`;
        }
        return "Run Process";
    }, [isProcessing, images.length, currentIndex]);


    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-gray-700">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Gemini Image Studio</h1>
                    <button
                        onClick={handleProcessImages}
                        disabled={isAnythingProcessing || images.length === 0}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white font-bold py-2 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <Loader /> : '✨'}
                        <span>{processButtonText}</span>
                    </button>
                </div>
            </header>
            
            <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                {images.length === 0 ? (
                    <div {...getRootProps()} className={`mt-10 flex justify-center px-6 pt-12 pb-12 border-2 border-gray-600 border-dashed rounded-2xl cursor-pointer hover:border-indigo-500 transition-colors ${isDragActive ? 'border-indigo-500 bg-gray-800' : ''}`}>
                        <input {...getInputProps()} />
                        <div className="text-center">
                            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-300">Drop images here or click to upload</h3>
                            <p className="mt-1 text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            <div className="lg:col-span-1">
                                <SettingsPanel 
                                    settings={settings} 
                                    setSettings={setSettings}
                                    disabled={isAnythingProcessing}
                                    selectedFilter={selectedFilter}
                                    setSelectedFilter={setSelectedFilter}
                                    customFilterPrompt={customFilterPrompt}
                                    setCustomFilterPrompt={setCustomFilterPrompt}
                                    onApplyFilter={onApplyFilter}
                                    isImageLoaded={!!currentImage}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <ImageViewer
                                    imageResult={currentImageResult}
                                    originalImage={currentImage}
                                    onRegenerateTheme={handleProcessImages} // Can be refined to only regen theme
                                    isProcessing={isProcessing}
                                />
                            </div>
                        </div>
                        
                        <CollageCreator 
                            theme={collageTheme}
                            setTheme={setCollageTheme}
                            onGenerate={handleGenerateCollage}
                            resultUrl={collageResultUrl}
                            isProcessing={isCreatingCollage}
                            selectedCount={selectedCollageIndices.length}
                            enhancedTheme={collageEnhancedTheme}
                        />

                        <SocialPostGenerator
                          onGenerate={handleGeneratePosts}
                          posts={socialPosts}
                          isProcessing={isGeneratingPosts}
                          isImageLoaded={!!currentImage}
                          language={socialPostLanguage}
                          setLanguage={setSocialPostLanguage}
                        />

                        <MakerWorldPostGenerator
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

const filterOptions = [
    { value: 'none', label: 'Select a Filter' },
    { value: 'Vintage Film: A classic 70s film look with faded colors, soft contrast, and visible grain.', label: 'Vintage Film' },
    { value: 'Noir: A high-contrast black and white filter with deep shadows and dramatic lighting.', label: 'Noir' },
    { value: 'Cyberpunk Glow: A futuristic look with neon teals and magentas, especially in the highlights and shadows.', label: 'Cyberpunk Glow' },
    { value: 'Golden Hour: Bathes the image in warm, soft, golden light, mimicking sunset.', label: 'Golden Hour' },
    { value: 'custom', label: 'Custom...' },
];

export default App;