import React from 'react';

interface LanguageSwitcherProps {
  language: 'en' | 'it';
  setLanguage: (lang: 'en' | 'it') => void;
  disabled?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ language, setLanguage, disabled }) => (
  <div>
    <label className="block text-sm font-medium mb-2">Language</label>
    <div className="flex rounded-lg bg-gray-900 p-1">
      <button
        onClick={() => setLanguage('en')}
        disabled={disabled}
        className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
          language === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('it')}
        disabled={disabled}
        className={`w-full px-3 py-1.5 text-sm font-semibold rounded-md transition-colors disabled:opacity-50 ${
          language === 'it' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
        }`}
      >
        Italiano
      </button>
    </div>
  </div>
);
