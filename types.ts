
export type EditMode = 'cleanup-only' | 'remove-bg' | 'themed-bg';

export type AspectRatio = '1:1' | '4:5' | '3:2' | '16:9' | '9:16';

export type CraftMode = '3d-printing' | 'laser-engraving';

export interface Settings {
  mode: EditMode;
  theme: string;
  harmonizeStyle: boolean;
  lightCleanup: boolean;
  backgroundBlur: boolean;
  autoCrop: boolean;
  aspectRatios: AspectRatio[];
}

export interface CropProposal {
  imageUrl: string;
  aspectRatio: AspectRatio;
  compositionScore: number;
  rationale: string;
}

export interface Report {
  subjectDescription: string;
  interventionType: string;
  parametersUsed: string;
}

export interface ImageResult {
  original: string;
  cleaned?: string;
  removedBg?: string;
  themedBg?: string;
  enhancedTheme?: string;
  filtered?: string;
  enhancedFilterPrompt?: string;
  cropProposals: CropProposal[];
  report?: Report;
}

export interface SocialPost {
    platform: string;
    content: string;
    musicSuggestions?: string[];
}

export interface MakerWorldPost {
  modelName: string;
  category: string;
  tags: string[];
  description: string;
  communityPost: string;
}