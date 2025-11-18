
import React, { useMemo } from 'react';
import type { Settings, EditMode, AspectRatio } from '../types';
import { SparklesIcon, ScissorsIcon, WandIcon } from './IconComponents';
import { translations } from '../translations';

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
  t: typeof translations.en;
}

const aspectRatios: AspectRatio[] = ['1:1', '4:5', '3:2', '16:9', '9:16'];

const PRESET_IMAGES: Record<string, string> = {
  abstract: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=150&q=80",
  studio: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=150&q=80",
  forest: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=150&q=80",
  cityscape: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=150&q=80",
  cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=150&q=80"
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ t, settings, setSettings, disabled, selectedFilter, setSelectedFilter, customFilterPrompt, setCustomFilterPrompt, onApplyFilter, isImageLoaded }) => {
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

  const filterOptions = useMemo(() => [
    { value: 'none', label: t.filterOptions.none },
    { value: `${t.filterOptions.vintage}: ${t.filterOptionDescriptions.vintage}`, label: t.filterOptions.vintage },
    { value: `${t.filterOptions.noir}: ${t.filterOptionDescriptions.noir}`, label: t.filterOptions.noir },
    { value: `${t.filterOptions.cyberpunk}: ${t.filterOptionDescriptions.cyberpunk}`, label: t.filterOptions.cyberpunk },
    { value: `${t.filterOptions.goldenHour}: ${t.filterOptionDescriptions.goldenHour}`, label: t.filterOptions.goldenHour },
    { value: 'custom', label: t.filterOptions.custom },
  ], [t]);


  const isFilterApplyDisabled = disabled || !isImageLoaded || selectedFilter === 'none' || (selectedFilter === 'custom' && !customFilterPrompt.trim());

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-6 sticky top-24">
      <fieldset disabled={disabled && !isFilterApplyDisabled} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">{t.editingMode}</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleModeChange('cleanup-only')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'cleanup-only' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
              >
              <WandIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">{t.cleanupOnly}</span>
            </button>
            <button
              onClick={() => handleModeChange('remove-bg')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'remove-bg' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
            >
              <ScissorsIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">{t.removeBg}</span>
            </button>
            <button
              onClick={() => handleModeChange('themed-bg')}
              className={`p-3 rounded-lg border-2 transition-colors flex flex-col items-center justify-center ${settings.mode === 'themed-bg' ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:border-indigo-500'}`}
            >
               <SparklesIcon className="w-6 h-6 mx-auto mb-2"/>
              <span className="text-sm">{t.themedBg}</span>
            </button>
          </div>
        </div>

        {settings.mode === 'themed-bg' && (
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-2">{t.selectPresetLabel}</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {Object.keys(t.themePresets).map((key) => {
                     const presetKey = key as keyof typeof t.themePresets;
                     const prompt = t.themePresets[presetKey];
                     const label = t.themePresetLabels[presetKey as keyof typeof t.themePresetLabels];
                     
                     return (
                      <button
                        key={key}
                        onClick={() => setSettings(s => ({ ...s, theme: prompt }))}
                        className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${settings.theme === prompt ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-transparent hover:border-gray-500'}`}
                        title={label}
                      >
                        <img 
                          src={PRESET_IMAGES[key]} 
                          alt={key} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-end p-1">
                          <span className="text-[10px] font-medium text-white truncate w-full text-center bg-black/50 rounded px-1 backdrop-blur-sm">
                            {label}
                          </span>
                        </div>
                      </button>
                     );
                  })}
                </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-800 px-2 text-xs text-gray-400 uppercase">Or custom</span>
              </div>
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium mb-2">{t.customThemePrompt}</label>
              <textarea
                id="theme"
                value={settings.theme}
                onChange={(e) => setSettings(s => ({ ...s, theme: e.target.value }))}
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder={t.bgThemePlaceholder}
              />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-3">{t.enhancements}</h3>
          <div className="space-y-3">
            { settings.mode === 'themed-bg' && (
              <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
                <span>{t.harmonizeStyle}</span>
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
                <span>{t.lightCleanup}</span>
                <input
                  type="checkbox"
                  checked={settings.lightCleanup}
                  onChange={(e) => setSettings(s => ({ ...s, lightCleanup: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            )}
            { settings.mode !== 'remove-bg' && (
              <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
                <span>{t.backgroundBlur}</span>
                 <input
                  type="checkbox"
                  checked={settings.backgroundBlur}
                  onChange={(e) => setSettings(s => ({ ...s, backgroundBlur: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            )}
            <label className="flex items-center justify-between bg-gray-700 p-3 rounded-lg cursor-pointer">
              <span>{t.autoCropSuggestions}</span>
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
            <h3 className="text-lg font-semibold mb-3">{t.autoCropRatios}</h3>
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
          <h3 className="text-lg font-semibold">{t.aiFilters}</h3>
          <div>
            <label htmlFor="ai-filter" className="block text-sm font-medium mb-2">{t.filterStyle}</label>
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
                  <label htmlFor="custom-filter-prompt" className="block text-sm font-medium mb-2">{t.customFilterPrompt}</label>
                  <textarea
                      id="custom-filter-prompt"
                      value={customFilterPrompt}
                      onChange={(e) => setCustomFilterPrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                      placeholder={t.customFilterPlaceholder}
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
              {t.applyFilter}
          </button>
      </div>

    </div>
  );
};
