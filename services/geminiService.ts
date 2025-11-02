import { GoogleGenAI, Modality, Type, GenerateContentResponse, Part } from "@google/genai";
import type { Settings, AspectRatio, CropProposal, SocialPost, Report, MakerWorldPost } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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

const buildImageEditingPrompt = (settings: Settings): {text: string}[] => {
    const prompt = [`You are an expert photo editor. Your task is to edit the user's image based on their specifications.`];

    switch (settings.mode) {
        case 'cleanup-only':
            prompt.push('Task: Perform a "cleanup" on the image. This means removing any minor blemishes, dust, or scratches. Do not make any other changes.');
            break;
        case 'remove-bg':
            prompt.push('Task: Remove the background from the image, leaving only the main subject. The output should be a transparent PNG.');
            break;
        case 'themed-bg':
            prompt.push(`Task: Replace the background of the image with a new, themed background. The theme is: "${settings.theme}".`);
            if (settings.harmonizeStyle) {
                prompt.push('Additionally, harmonize the style of the main subject to seamlessly blend with the new background. Adjust lighting, color tones, and textures of the subject as needed to match the artistic style of the background.');
            }
            break;
    }

    if (settings.lightCleanup && settings.mode !== 'cleanup-only') {
        prompt.push('Enhancement: Also perform a light cleanup on the main subject, removing minor blemishes or imperfections.');
    }
    
    prompt.push('Return only the edited image. Do not return any text, only the image data.');

    return prompt.map(p => ({ text: p }));
};

export const runImageEditing = async (image: File, settings: Settings) => {
    const imagePart = await fileToGenerativePart(image);
    const promptParts = buildImageEditingPrompt(settings);

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, ...promptParts],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const resultPart = response.candidates?.[0]?.content?.parts?.[0];
    if (resultPart?.inlineData) {
        const mimeType = resultPart.inlineData.mimeType;
        const data = resultPart.inlineData.data;
        return `data:${mimeType};base64,${data}`;
    }
    
    throw new Error('No image was generated.');
};

const extractJsonFromText = (text: string): any => {
    const markdownMatch = text.match(/```(json)?\n([\s\S]*?)\n```/);
    if (markdownMatch && markdownMatch[2]) {
        try {
            return JSON.parse(markdownMatch[2]);
        } catch (e) {
            console.error("Failed to parse JSON from markdown block:", e);
        }
    }
    try {
        return JSON.parse(text);
    } catch(e) {
        console.error("Failed to parse text as JSON:", e);
    }
    return null;
};

export const runAutoCrop = async (image: File | string, aspectRatios: AspectRatio[]): Promise<CropProposal[]> => {
    if (aspectRatios.length === 0) {
        return [];
    }

    const imageToCropPart = typeof image === 'string'
        ? base64ToGenerativePart(image)
        : await fileToGenerativePart(image);


    // --- Step 1: Generate Cropped Images ---
    const imageGenPrompt = {
        text: `You are an expert photo editor. Your task is to analyze the provided image and generate the best possible crops for the specified aspect ratios.
Follow these instructions:
1. For each aspect ratio in this list: [${aspectRatios.join(', ')}], identify and generate the best crop based on photographic rules.
2. Return each of these cropped images as separate image parts in your response.
3. The order of the returned images must match the order of the aspect ratios in the list: [${aspectRatios.join(', ')}].
4. Do not return any text, only the images.`
    };

    const imageGenResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imageToCropPart, imageGenPrompt] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const generatedImageParts = imageGenResponse.candidates?.[0]?.content?.parts?.filter(p => p.inlineData) || [];

    if (generatedImageParts.length === 0) {
        throw new Error('Model did not return any cropped images.');
    }

    if (generatedImageParts.length !== aspectRatios.length) {
        console.warn(`Expected ${aspectRatios.length} cropped images, but received ${generatedImageParts.length}.`);
    }

    // --- Step 2: Generate Analysis for the Crops ---
    const analysisPrompt = {
        text: `You are a professional photo composition analyst.
I have provided an original image (the first image) followed by several cropped versions of it.
Your task is to analyze each cropped version. For each one, provide a composition score (1-100) and a brief rationale explaining the compositional choice.
The aspect ratios for the crops, in order, are: [${aspectRatios.join(', ')}].
You MUST return ONLY a single JSON object enclosed in a markdown code block (\`\`\`json ... \`\`\`).
The JSON object must have a key named "cropProposals", which is an array of objects.
Each object in the "cropProposals" array must correspond to one of the cropped images, in the exact same order.
Each object must have these three keys: "aspectRatio" (string from the list provided), "compositionScore" (number), and "rationale" (string).
        
Example JSON structure for two crops:
\`\`\`json
{
  "cropProposals": [
    { "aspectRatio": "${aspectRatios[0]}", "compositionScore": 95, "rationale": "..." },
    { "aspectRatio": "${aspectRatios[1] || ''}", "compositionScore": 88, "rationale": "..." }
  ]
}
\`\`\``
    };

    const analysisResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // A text-capable model
        contents: { parts: [imageToCropPart, ...generatedImageParts, analysisPrompt] },
    });

    const analysisText = analysisResponse.text.trim();
    if (!analysisText) {
        throw new Error("The analysis model did not return any text.");
    }

    const parsed = extractJsonFromText(analysisText);
    if (!parsed || !parsed.cropProposals) {
        console.error("Could not find or parse JSON in the analysis response.", analysisText);
        throw new Error("Could not extract crop proposal JSON from the model's analysis response.");
    }
    const proposalsMetadata: Omit<CropProposal, 'imageUrl'>[] = parsed.cropProposals;

    // --- Step 3: Combine Images and Metadata ---
    return proposalsMetadata.map((proposal, index) => {
        const imagePart = generatedImageParts[index]?.inlineData;
        return {
            ...proposal,
            aspectRatio: proposal.aspectRatio as AspectRatio,
            imageUrl: imagePart ? `data:${imagePart.mimeType};base64,${imagePart.data}` : '',
        };
    }).filter(p => p.imageUrl);
};


export const applyAIFilter = async (image: File, filterPrompt: string) => {
    const imagePart = await fileToGenerativePart(image);
    const textPart = {
        text: `You are an expert photo editor. Your task is to apply an AI filter to the user's image.
        Filter instruction: "${filterPrompt}".
        Return only the edited image. Do not return any text, only the image data.`
    };
    const enhancedPromptTextPart = {
        text: `Enhance this user prompt to be more descriptive and artistic for an image generation model. User prompt: "${filterPrompt}"`
    };

    const [editResponse, promptResponse] = await Promise.all([
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
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
    
    const resultPart = editResponse.candidates?.[0]?.content?.parts?.[0];
    const imageUrl = resultPart?.inlineData ? `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}` : null;
    
    if (!imageUrl) {
        throw new Error('No image was generated for the filter.');
    }

    return {
        imageUrl,
        enhancedPrompt: promptResponse.text.trim(),
    };
};

export const generateCollage = async (images: File[], theme: string) => {
    const imageParts = await Promise.all(images.map(fileToGenerativePart));
    const themePrompt = {
        text: `Create an artistic collage using all the provided images. Arrange them creatively based on the following theme: "${theme}". The final output should be a single, cohesive image.`
    };
    const enhancedPromptTextPart = {
        text: `Enhance this user prompt for a collage to be more descriptive and artistic for an image generation model. User prompt: "${theme}"`
    };

    const [collageResponse, promptResponse] = await Promise.all([
        ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
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

    const resultPart = collageResponse.candidates?.[0]?.content?.parts?.[0];
    const imageUrl = resultPart?.inlineData ? `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}` : null;

    if (!imageUrl) {
        throw new Error('No collage was generated.');
    }

    return {
        imageUrl,
        enhancedTheme: promptResponse.text.trim(),
    };
};

export const generateSocialPosts = async (image: File, context: string, language: 'en' | 'it'): Promise<SocialPost[]> => {
    const imagePart = await fileToGenerativePart(image);
    const languageInstruction = language === 'it' ? 'Italian' : 'English';
    const textPart = {
        text: `Analyze the provided image and generate 2 engaging social media posts in ${languageInstruction} for different platforms (e.g., Instagram, Twitter/X).
        
        Context for the posts: "${context || 'General post about the image.'}"
        
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

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    return parsed.posts || [];
};

export const generateImageReport = async (image: File, settings: Settings): Promise<Report> => {
    const imagePart = await fileToGenerativePart(image);
    
    const interventionMap: Record<Settings['mode'], string> = {
        'cleanup-only': 'Light Cleanup: Minor blemishes, dust, or scratches were removed.',
        'remove-bg': 'Background Removal: The main subject was isolated by removing the background.',
        'themed-bg': `Themed Background: The original background was replaced with a new theme: "${settings.theme}".`
    };
    
    const parameters = [
        `Mode: ${settings.mode}`,
        ...settings.mode === 'themed-bg' ? [`Theme: "${settings.theme}"`, `Harmonize Style: ${settings.harmonizeStyle}`] : [],
        `Light Cleanup: ${settings.lightCleanup}`,
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

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    
    return {
        subjectDescription: parsed.subjectDescription,
        interventionType: interventionMap[settings.mode],
        parametersUsed: parameters,
    };
};

export const generateMakerWorldPost = async (image: File, context: string, language: 'en' | 'it'): Promise<MakerWorldPost> => {
    const imagePart = await fileToGenerativePart(image);
    const languageInstruction = language === 'it' ? 'Italian' : 'English';
    const prompt = {
        text: `You are an expert content creator for 3D printing communities like MakerWorld. Your task is to analyze the provided image and the user's context to generate a post for a 3D model.

        User's Context/Model Name: "${context}"

        Use the following as a perfect example of the required style, tone, and structure. Use markdown (like **bold** or *italics*) and emojis to make the description engaging.

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

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};