import React from 'react';
import type { Settings, EditMode, AspectRatio } from '../types';
import { SparklesIcon, ScissorsIcon, WandIcon } from './IconComponents';

interface SettingsPanelProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  disabled: boolean;
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  customFilterPrompt: string;
  setCustomFilterPrompt: (prompt: string) => void;
  onApplyFilter: () => void;
  isImageLoaded: boolean;
}

const aspectRatios: AspectRatio[] = ['1:1', '4:5', '3:2', '16:9', '9:16'];
const filterOptions = [
    { value: 'none', label: 'Select a Filter' },
    { value: 'Vintage Film: A classic 70s film look with faded colors, soft contrast, and visible grain.', label: 'Vintage Film' },
    { value: 'Noir: A high-contrast black and white filter with deep shadows and dramatic lighting.', label: 'Noir' },
    { value: 'Cyberpunk Glow: A futuristic look with neon teals and magentas, especially in the highlights and shadows.', label: 'Cyberpunk Glow' },
    { value: 'Golden Hour: Bathes the image in warm, soft, golden light, mimicking sunset.', label: 'Golden Hour' },
    { value: 'custom', label: 'Custom...' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, disabled, selectedFilter, setSelectedFilter, customFilterPrompt, setCustomFilterPrompt, onApplyFilter, isImageLoaded }) => {
  const handleModeChange = (mode: EditMode) => {
    setSettings(s => ({ ...s, mode }));
  };
  
  const handleAspectRatioToggle = (ratio: AspectRatio) => {
    setSettings(s => {
      const newRatios = s.aspectRatios.includes(ratio)
        ? s.aspectRatios.filter(r => r !== ratio)
        : [...s.aspectRatios, ratio];
      return { ...s, aspectRatios: newRatios };
    });
  };

  const isFilterApplyDisabled = disabled || !isImageLoaded || selectedFilter === 'none' || (selectedFilter === 'custom' && !customFilterPrompt.trim());

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-6 sticky top-24">
      <fieldset disabled={disabled && !isFilterApplyDisabled} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">1. Editing Mode</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleModeChange('cleanup-only')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'cleanup-only' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
              >
              <WandIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">Cleanup Only</span>
            </button>
            <button
              onClick={() => handleModeChange('remove-bg')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'remove-bg' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
            >
              <ScissorsIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">Remove BG</span>
            </button>
            <button
              onClick={() => handleModeChange('themed-bg')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'themed-bg' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
            >
               <SparklesIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">Themed BG</span>
            </button>
          </div>
        </div>

        {settings.mode === 'themed-bg' && (
          <div>
            <label htmlFor="theme" className="block text-sm font-medium mb-2">Background Theme</label>
            <textarea
              id="theme"
              value={settings.theme}
              onChange={(e) => setSettings(s => ({ ...s, theme: e.target.value }))}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              placeholder="e.g., 'A cartoon forest at dawn, soft light, green palette'"
            />
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-3">2. Enhancements</h3>
          <div className="space-y-3">
            { settings.mode === 'themed-bg' && (
              <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
                <span>Harmonize Subject Style</span>
                 <input
                  type="checkbox"
                  checked={settings.harmonizeStyle}
                  onChange={(e) => setSettings(s => ({ ...s, harmonizeStyle: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            )}
            { settings.mode !== 'cleanup-only' && (
              <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
                <span>Light Cleanup</span>
                <input
                  type="checkbox"
                  checked={settings.lightCleanup}
                  onChange={(e) => setSettings(s => ({ ...s, lightCleanup: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            )}
            <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
              <span>Auto-Crop Suggestions</span>
              <input
                type="checkbox"
                checked={settings.autoCrop}
                onChange={(e) => setSettings(s => ({ ...s, autoCrop: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {settings.autoCrop && (
          <div>
            <h3 className="text-lg font-semibold mb-3">3. Auto-Crop Ratios</h3>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map(ratio => (
                <button
                  key={ratio}
                  onClick={() => handleAspectRatioToggle(ratio)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${settings.aspectRatios.includes(ratio) ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      
      {/* AI Filters Section */}
      <div className="border-t border-gray-700 pt-6 space-y-4">
          <h3 className="text-lg font-semibold">4. AI Filters</h3>
          <div>
            <label htmlFor="ai-filter" className="block text-sm font-medium mb-2">Filter Style</label>
            <select
                id="ai-filter"
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                disabled={disabled || !isImageLoaded}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
            >
                {filterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          {selectedFilter === 'custom' && (
              <div>
                  <label htmlFor="custom-filter-prompt" className="block text-sm font-medium mb-2">Custom Filter Prompt</label>
                  <textarea
                      id="custom-filter-prompt"
                      value={customFilterPrompt}
                      onChange={(e) => setCustomFilterPrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                      placeholder="e.g., 'A dreamy, ethereal glow with high saturation'"
                      disabled={disabled || !isImageLoaded}
                  />
              </div>
          )}
          <button
            onClick={onApplyFilter}
            disabled={isFilterApplyDisabled}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
              <WandIcon className="w-5 h-5" />
              Apply Filter
          </button>
      </div>

    </div>
  );
};