
import React from 'react';
import { InfoIcon } from './IconComponents';

interface InfoTooltipProps {
  text: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
  return (
    <div className="relative group inline-block ml-2 align-middle">
      <button className="text-gray-400 hover:text-indigo-400 transition-colors focus:outline-none">
        <InfoIcon className="w-4 h-4" />
      </button>
      <div className="absolute z-50 left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
        <p className="text-xs text-gray-300 leading-relaxed text-center">
            {text}
        </p>
        {/* Arrow */}
        <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};
