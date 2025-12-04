
import { GoogleGenAI, Modality, Type, GenerateContentResponse, Part, FinishReason } from "@google/genai";
import type { Settings, AspectRatio, CropProposal, SocialPost, Report, MakerWorldPost, CraftMode } from '../types';

// Helper to safely get API Key without crashing if process is undefined
const getApiKey = (): string => {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {
        // Ignore ReferenceError
    }
    throw new Error("API Key not found. Please ensure you have selected a key and that your browser is not blocking the environment variables.");
};

// Helper to handle both File objects and Base64 strings
const prepareImageInput = async (input: File | string): Promise<Part> => {
    if (input instanceof File) {
        return fileToGenerativePart(input);
    } else if (typeof input === 'string') {
        // Validate basic data URL format
        if (input.startsWith('data:')) {
             return base64ToGenerativePart(input);
        } else if (input.startsWith('blob:')) {
             throw new Error("Blob URLs not directly supported in service chaining. Use base64 string.");
        }
    }
    throw new Error("Invalid image input type.");
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Could not read file as data URL."));
      }
    };
    reader.onerror = (error) => {
        reject(error);
    };
    reader.readAsDataURL(file);
  });
  
  const data = await base64EncodedDataPromise;
  if (!data) throw new Error("Could not convert file to base64.");

  return {
    inlineData: {
      data,
      mimeType: file.type,
    },
  };
};

const base64ToGenerativePart = (base64Url: string): Part => {
    const match = base64Url.match(/^data:(image\/.+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid base64 data URL format.");
    }
    const mimeType = match[1];
    const data = match[2];
    return {
        inlineData: { data, mimeType },
    };
};

const getImageDimensions = (base64: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = (err) => reject(err);
        img.src = base64;
    });
};

const performClientSideCrop = async (base64Image: string, box: { ymin: number, xmin: number, ymax: number, xmax: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let x = box.xmin * img.width;
            let y = box.ymin * img.height;
            let w = (box.xmax - box.xmin) * img.width;
            let h = (box.ymax - box.ymin) * img.height;
            
            // Sanity checks to prevent out of bounds
            if (x < 0) x = 0;
            if (y < 0) y = 0;
            if (x + w > img.width) w = img.width - x;
            if (y + h > img.height) h = img.height - y;

            canvas.width = w;
            canvas.height = h;
            
            if (ctx) {
                ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } else {
                reject(new Error("Could not get canvas context"));
            }
        };
        img.onerror = reject;
        img.src = base64Image;
    });
};

const buildImageEditingPrompt = (settings: Settings): string => {
    let task: string;

    switch (settings.mode) {
        case 'cleanup-only':
            task = `Perform a light cleanup on the image: remove any minor blemishes, dust, or scratches.`;
            if (settings.backgroundBlur) {
                task += ` Apply a cinematic shallow depth of field effect (bokeh) to blur the background while keeping the subject sharp.`;
            }
            break;
        case 'remove-bg':
            task = `Remove the background from the image, leaving the main subject on a transparent background.`;
            if (settings.lightCleanup) {
                task += ` Also perform a light cleanup on the subject, removing minor imperfections.`;
            }
            break;
        case 'themed-bg':
            // Refined prompt to emphasize preservation of the subject to avoid 'IMAGE_OTHER' refusals
            task = `Background replacement task. Keep the foreground subject strictly unchanged. Replace the background pixels with this theme: "${settings.theme}".`;
            if (settings.backgroundBlur) {
                task += ` The new background should be blurred (shallow depth of field) to focus attention on the subject.`;
            }
            if (settings.harmonizeStyle) {
                task += ` Adjust the subject's lighting and color to blend seamlessly with the new background.`;
            }
            if (settings.lightCleanup) {
                task += ` Also perform a light cleanup on the subject, removing minor imperfections.`;
            }
            break;
    }

    const safetyInstruction = `CRITICAL: Do not alter the facial features, identity, or expression of any person in the photo. The subject's appearance must remain identical to the original.`;
    
    return `${task} ${safetyInstruction}`;
};

export const runImageEditing = async (image: File | string, settings: Settings, useProModel: boolean = false) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = await prepareImageInput(image);
    const promptString = buildImageEditingPrompt(settings);
    const textPart = { text: promptString };

    // Use Pro model if selected, otherwise fallback to Flash-Image (Free tier friendly)
    const model = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: {
            parts: [imagePart, textPart],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Image generation blocked by prompt feedback. Full API response:", JSON.stringify(response, null, 2));
        const message = response.promptFeedback.blockReasonMessage || `Request was blocked due to: ${response.promptFeedback.blockReason}. This may be due to the input image violating safety policies.`;
        throw new Error(message);
    }

    const candidate = response.candidates?.[0];
    const resultPart = candidate?.content?.parts?.[0];

    if (resultPart?.inlineData) {
        const mimeType = resultPart.inlineData.mimeType;
        const data = resultPart.inlineData.data;
        return `data:${mimeType};base64,${data}`;
    }
    
    console.error("Image generation failed. Full API response:", JSON.stringify(response, null, 2));
    
    const finishReason = candidate?.finishReason;
    const reasonStr = String(finishReason); // Normalize to string to catch 'IMAGE_OTHER'

    let errorMessage = 'No image was generated.';
    if (finishReason === FinishReason.SAFETY || reasonStr === 'SAFETY') {
        errorMessage = 'Image generation failed due to safety policies. Please try a different image or prompt.';
    } else if (finishReason === FinishReason.RECITATION || finishReason === FinishReason.OTHER || reasonStr === 'IMAGE_OTHER' || reasonStr === 'OTHER') {
        errorMessage = `Image generation blocked by the model (Reason: ${reasonStr}). This often happens with images of people if the model perceives a policy risk in modifying them. Try a different image or a simpler prompt.`;
    } else if (finishReason && finishReason !== FinishReason.STOP) {
        errorMessage = `Image generation failed with reason: ${finishReason}.`
    }

    throw new Error(errorMessage);
};

export const runAutoCrop = async (image: File | string, aspectRatios: AspectRatio[]): Promise<CropProposal[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    if (aspectRatios.length === 0) {
        return [];
    }

    // 1. Prepare Image Data
    let imageBase64 = '';
    let mimeType = 'image/jpeg';
    
    if (typeof image === 'string') {
        imageBase64 = image; 
        const match = image.match(/^data:(.*);base64,/);
        if (match) mimeType = match[1];
    } else {
        const part = await fileToGenerativePart(image);
        imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        mimeType = part.inlineData.mimeType;
    }

    // Get dimensions to help the AI model
    const { width, height } = await getImageDimensions(imageBase64);

    // 2. Ask Gemini for Crop Coordinates (Analysis)
    const analysisPrompt = {
        text: `Analyze this image (Dimensions: ${width}x${height}) and provide optimal crop coordinates for the following aspect ratios: ${aspectRatios.join(', ')}.
        
        For each aspect ratio:
        1. Identify the best crop region to frame the main subject according to composition rules (Rule of Thirds, Golden Ratio, etc.).
        2. Provide the bounding box coordinates: ymin, xmin, ymax, xmax (values from 0.0 to 1.0).
        3. 0,0 is top-left, 1,1 is bottom-right.
        4. Provide a composition score (0-100) and a brief rationale explaining why this crop is effective.
        
        Return pure JSON.`
    };

    // Remove header for API call
    const apiBase64 = imageBase64.split(',')[1];
    const imagePart = {
        inlineData: {
            data: apiBase64,
            mimeType: mimeType
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, analysisPrompt] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    crops: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                aspectRatio: { type: Type.STRING },
                                ymin: { type: Type.NUMBER },
                                xmin: { type: Type.NUMBER },
                                ymax: { type: Type.NUMBER },
                                xmax: { type: Type.NUMBER },
                                compositionScore: { type: Type.INTEGER },
                                rationale: { type: Type.STRING },
                            },
                            required: ['aspectRatio', 'ymin', 'xmin', 'ymax', 'xmax', 'compositionScore', 'rationale'],
                        },
                    },
                },
            },
        },
    });

    const analysisText = response.text?.trim();
    if (!analysisText) {
        console.warn("Auto-crop analysis returned no text.");
        return [];
    }

    let parsed;
    try {
        parsed = JSON.parse(analysisText);
    } catch (e) {
        console.error("Failed to parse auto-crop JSON", e);
        return [];
    }

    const suggestions = parsed.crops || [];

    // 3. Perform Client-Side Cropping
    const results = await Promise.all(suggestions.map(async (s: any) => {
        try {
            if (!aspectRatios.includes(s.aspectRatio as AspectRatio)) return null;

            const croppedUrl = await performClientSideCrop(imageBase64, {
                ymin: s.ymin, xmin: s.xmin, ymax: s.ymax, xmax: s.xmax
            });

            return {
                aspectRatio: s.aspectRatio,
                compositionScore: s.compositionScore,
                rationale: s.rationale,
                imageUrl: croppedUrl,
            };
        } catch (e) {
            console.error(`Failed to perform crop for ${s.aspectRatio}`, e);
            return null;
        }
    }));

    return results.filter((r: any) => r !== null) as CropProposal[];
};


export const applyAIFilter = async (image: File | string, filterPrompt: string, useProModel: boolean = false) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = await prepareImageInput(image);
    const textPart = {
        text: `You are an expert photo editor. Your task is to apply an AI filter to the user's image.
        Filter instruction: "${filterPrompt}".
        Return only the edited image. Do not return any text, only the image data.`
    };
    const enhancedPromptTextPart = {
        text: `Enhance this user prompt to be more descriptive and artistic for an image generation model. User prompt: "${filterPrompt}"`
    };

    // Use Pro model if selected, otherwise fallback to Flash-Image
    const model = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const [editResponse, promptResponse] = await Promise.all([
        ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        }),
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [enhancedPromptTextPart] },
        }),
    ]);
    
    if (editResponse.promptFeedback?.blockReason) {
        console.error("AI filter image generation blocked by prompt feedback. Full API response:", JSON.stringify(editResponse, null, 2));
        const message = editResponse.promptFeedback.blockReasonMessage || `Request for AI filter was blocked due to: ${editResponse.promptFeedback.blockReason}. This may be due to the input image violating safety policies.`;
        throw new Error(message);
    }
    
    const candidate = editResponse.candidates?.[0];
    const resultPart = candidate?.content?.parts?.[0];
    const imageUrl = resultPart?.inlineData ? `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}` : null;
    
    if (!imageUrl) {
        const finishReason = candidate?.finishReason;
        const reasonStr = String(finishReason);

        let errorMessage = 'No image was generated for the filter.';
        if (finishReason === FinishReason.SAFETY || reasonStr === 'SAFETY') {
            errorMessage = 'Filter application failed due to safety policies. Please try a different image.';
        } else if (reasonStr === 'IMAGE_OTHER' || reasonStr === 'OTHER') {
            errorMessage = `Filter application blocked (Reason: ${reasonStr}). Try using a different image or a standard filter.`;
        } else if (finishReason && finishReason !== FinishReason.STOP) {
            errorMessage = `Applying AI filter failed with reason: ${finishReason}.`;
        }
        throw new Error(errorMessage);
    }

    return {
        imageUrl,
        enhancedPrompt: promptResponse.text?.trim() ?? '',
    };
};

export const generateCollage = async (images: File[], theme: string, useProModel: boolean = false) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    // Collage generally always uses multiple source files, so we keep File[] for now
    const imageParts = await Promise.all(images.map(fileToGenerativePart));
    const themePrompt = {
        text: `Create an artistic collage using all the provided images. Arrange them creatively based on the following theme: "${theme}". The final output should be a single, cohesive image.`
    };
    const enhancedPromptTextPart = {
        text: `Enhance this user prompt for a collage to be more descriptive and artistic for an image generation model. User prompt: "${theme}"`
    };

    // Use Pro model if selected, otherwise fallback to Flash-Image
    const model = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const [collageResponse, promptResponse] = await Promise.all([
        ai.models.generateContent({
            model: model,
            contents: { parts: [...imageParts, themePrompt] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        }),
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [enhancedPromptTextPart] },
        })
    ]);

    if (collageResponse.promptFeedback?.blockReason) {
        console.error("Collage generation blocked by prompt feedback. Full API response:", JSON.stringify(collageResponse, null, 2));
        const message = collageResponse.promptFeedback.blockReasonMessage || `Request for collage was blocked due to: ${collageResponse.promptFeedback.blockReason}. This may be due to the input violating safety policies.`;
        throw new Error(message);
    }

    const candidate = collageResponse.candidates?.[0];
    const resultPart = candidate?.content?.parts?.[0];
    const imageUrl = resultPart?.inlineData ? `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}` : null;

    if (!imageUrl) {
        const finishReason = candidate?.finishReason;
        const reasonStr = String(finishReason);
        let errorMessage = 'No collage was generated.';
        
        if (finishReason === FinishReason.SAFETY || reasonStr === 'SAFETY') {
            errorMessage = 'Collage generation failed due to safety policies. Please check your source images.';
        } else if (reasonStr === 'IMAGE_OTHER' || reasonStr === 'OTHER') {
            errorMessage = `Collage generation blocked (Reason: ${reasonStr}). The model could not process the combination of images/theme.`;
        } else if (finishReason && finishReason !== FinishReason.STOP) {
            errorMessage = `Collage generation failed with reason: ${finishReason}.`;
        }
        throw new Error(errorMessage);
    }

    return {
        imageUrl,
        enhancedTheme: promptResponse.text?.trim() ?? '',
    };
};

export const generateSocialPosts = async (image: File | string, context: string, language: 'en' | 'it', craftMode: CraftMode = '3d-printing'): Promise<SocialPost[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = await prepareImageInput(image);
    const languageInstruction = language === 'it' ? 'Italian' : 'English';
    
    let craftContext = "";
    if (craftMode === 'laser-engraving') {
        craftContext = `The content MUST be about Laser Engraving and Cutting. Focus on materials like wood, slate, acrylic, leather. Mention precision, burning, etching, power, speed, diode or CO2 lasers. Use relevant hashtags like #laserengraving #lasercut #xtool #glowforge #diy.`;
    } else {
        craftContext = `The content MUST be about 3D Printing. Focus on filaments (PLA, PETG), layer lines, slicers, extruders, nozzles. Use relevant hashtags like #3dprinting #3dprinted #bambu #prusa #maker.`;
    }

    const textPart = {
        text: `Analyze the provided image and generate 2 engaging social media posts in ${languageInstruction} for different platforms (e.g., Instagram, Twitter/X).
        
        Craft Type: ${craftMode === 'laser-engraving' ? 'Laser Engraving' : '3D Printing'}.
        User Context: "${context || 'General post about the image.'}"
        
        Strict Instructions: ${craftContext}
        
        For each post, suggest relevant hashtags. If one of the posts is for Instagram, you MUST also suggest 3 suitable songs (providing the title and artist) for a Reel or Story.
        
        The response should be in JSON format.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    posts: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                platform: { type: Type.STRING },
                                content: { type: Type.STRING },
                                musicSuggestions: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING },
                                    description: 'An array of 3 song suggestions (title by artist) if the platform is Instagram. Should be omitted otherwise.'
                                }
                            },
                             required: ["platform", "content"]
                        },
                    },
                },
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        console.warn("Social post generation returned no text. Full response:", response);
        return [];
    }
    const parsed = JSON.parse(jsonText);
    return parsed.posts || [];
};

export const generateImageReport = async (image: File | string, settings: Settings): Promise<Report> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = await prepareImageInput(image);
    
    const interventionMap: Record<Settings['mode'], string> = {
        'cleanup-only': 'Light Cleanup: Minor blemishes, dust, or scratches were removed.',
        'remove-bg': 'Background Removal: The main subject was isolated by removing the background.',
        'themed-bg': `Themed Background: The original background was replaced with a new theme: "${settings.theme}".`
    };
    
    const parameters = [
        `Mode: ${settings.mode}`,
        ...settings.mode === 'themed-bg' ? [`Theme: "${settings.theme}"`, `Harmonize Style: ${settings.harmonizeStyle}`] : [],
        `Light Cleanup: ${settings.lightCleanup}`,
        `Background Blur: ${settings.backgroundBlur}`,
        `Auto Crop: ${settings.autoCrop}`,
        ...settings.autoCrop ? [`Aspect Ratios: ${settings.aspectRatios.join(', ')}`] : []
    ].join('\n');


    const prompt = {
        text: `You are an AI assistant creating a summary report for a photo editing task.
        Analyze the provided image to identify the main subject.
        Based on the user's settings, I have already determined the intervention type and parameters.
        Your task is to simply describe the subject and then return the full report in the specified JSON format.
        
        Intervention Type: "${interventionMap[settings.mode]}"
        Parameters Used: "${parameters}"
        
        Please provide a brief, one-sentence description of the main subject in the image.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, prompt] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subjectDescription: {
                        type: Type.STRING,
                        description: 'A brief, one-sentence description of the main subject in the image.'
                    },
                },
                required: ['subjectDescription']
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        console.error("Image report generation returned no text. Full response:", response);
        throw new Error("Failed to generate image report: The AI returned no data, which may be due to a safety filter.");
    }
    const parsed = JSON.parse(jsonText);
    
    return {
        subjectDescription: parsed.subjectDescription,
        interventionType: interventionMap[settings.mode],
        parametersUsed: parameters,
    };
};

export const generateMakerWorldPost = async (image: File | string, context: string, language: 'en' | 'it', craftMode: CraftMode = '3d-printing'): Promise<MakerWorldPost> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const imagePart = await prepareImageInput(image);
    const languageInstruction = language === 'it' ? 'Italian' : 'English';
    
    let examplePost = "";
    
    if (craftMode === 'laser-engraving') {
        examplePost = `
        --- START OF EXAMPLE ---
        ### 🏷️ **Model Name**
        **Geometric Mandala Coasters - Slate Edition**

        ### 🧩 **Category**
        Home Decor / Kitchen / Laser Engraving

        ### 📝 **Description**
        Elevate your coffee table with this intricate **Geometric Mandala Coaster Set**! ✨☕
        Designed specifically for **laser engraving on slate**, this pattern features fine lines and sharp contrasts that pop beautifully on dark stone.
        The file includes **4 unique mandala designs**, all optimized for diode and CO2 lasers.
        
        🧠 **Tips:**
        * **Power:** 30% (for 10W diode)
        * **Speed:** 100 mm/s
        * **Lines per cm:** 120
        * Clean the slate with oil after engraving for a deep black finish!
        
        Perfect for gifts or adding a boho touch to your home. Happy burning! 🔥

        ### 🪄 **Tags**
        laser, engraving, slate, coaster, mandala, geometric, home decor, laser cut, lightburn, diode laser, xtool, kitchen, gift, etching, stone

        ### 📢 **Community Post (max 500 characters)**
        New project up! 🔥 Check out these **Geometric Mandala Coasters** designed for slate engraving.
        The file has 4 distinct patterns that look amazing on stone. I used a 10W diode laser (30% power, 100mm/s).
        Pro tip: seal them with a bit of mineral oil for that deep, rich contrast! ☕✨
        --- END OF EXAMPLE ---
        `;
    } else {
        // Default 3D Printing Example
        examplePost = `
        --- START OF EXAMPLE ---
        ### 🏷️ **Model Name**
        **Bad Dinosaurs – T-Rex Family Set**

        ### 🧩 **Category**
        Figurine / Decorative Model / Movie & Animation

        ### 📝 **Description**
        Straight from the cartoon *Bad Dinosaurs*, here comes the funniest and most expressive **T-Rex family** you’ve ever seen! 🦖💗
        The **big T-Rex** is printed in **three parts**, joined with a **hexagonal connector** for easy gluing and perfect alignment — no tricky assembly!
        Each smaller T-Rex maintains the **correct proportions** to the large one, so the whole family looks just right when displayed together.
        🧠 **Tips:**
        * Prints cleanly with minimal supports.
        * Works great in PLA or resin.
        * Painting is optional, but even a single-color print looks fantastic!
        Whether you’re a fan of *Bad Dinosaurs* or just love quirky 3D models, this set will definitely make you smile. 😄

        ### 🪄 **Tags**
        t-rex, bad dinosaurs, dinosaur, 3dprint, animation, cute, funny, collectible, figurine, dino family, handmade, multicolor, easy print, model kit, resin, toy

        ### 📢 **Community Post (max 500 characters)**
        From the world of *Bad Dinosaurs* comes this adorable **T-Rex family**! 🦖
        The big one is printed in 3 parts with a simple hex connector — easy to glue, perfectly aligned, and true to scale with the smaller dinos.
        Fun to print, even more fun to display! 💗✨
        --- END OF EXAMPLE ---
        `;
    }

    const prompt = {
        text: `You are an expert content creator for maker communities like MakerWorld. Your task is to analyze the provided image and the user's context to generate a post for a project.
        
        Craft Type: ${craftMode === 'laser-engraving' ? 'Laser Engraving/Cutting' : '3D Printing'}.
        User's Context/Project Name: "${context}"

        Use the following as a perfect example of the required style, tone, and structure. Use markdown (like **bold** or *italics*) and emojis to make the description engaging.

        ${examplePost}

        Now, generate a new post for the user's image and context in ${languageInstruction}.
        You MUST return ONLY a single JSON object that adheres to the specified schema.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, prompt] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    modelName: { type: Type.STRING },
                    category: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    description: { type: Type.STRING },
                    communityPost: { type: Type.STRING }
                },
                required: ["modelName", "category", "tags", "description", "communityPost"]
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        console.error("MakerWorld post generation returned no text. Full response:", response);
        throw new Error("Failed to generate MakerWorld post: The AI returned no data.");
    }
    return JSON.parse(jsonText);
};
