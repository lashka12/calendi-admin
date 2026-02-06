'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  placeholder?: string;
  isRTL?: boolean;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  isRTL = false,
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedElement = listRef.current.querySelector('[data-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-3
          theme-bg-secondary theme-border border rounded-xl
          text-sm theme-text-primary
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{
          borderColor: isOpen ? 'var(--color-text-tertiary)' : undefined,
        }}
      >
        <span className={selectedOption ? 'theme-text-primary' : 'theme-text-tertiary'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 theme-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full theme-bg-secondary rounded-xl shadow-xl theme-border border overflow-hidden max-h-[240px] overflow-y-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--color-text-tertiary) transparent',
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full flex items-center justify-between gap-3 px-4 py-2.5
                    text-sm transition-colors text-start
                    ${isSelected 
                      ? 'theme-bg-tertiary theme-text-primary font-medium' 
                      : 'theme-text-secondary hover:theme-bg-hover'
                    }
                  `}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 theme-text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
