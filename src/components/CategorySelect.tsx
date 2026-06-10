import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { Category } from '../db/db';

interface CategorySelectProps {
  id?: string;
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CategorySelect({ id, categories, value, onChange, placeholder }: CategorySelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync search with external value
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const lower = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(lower)
    );
  }, [categories, searchTerm]);

  // Check if exact match exists
  const hasExactMatch = useMemo(() => {
    return categories.some(cat => 
      cat.name.toLowerCase() === searchTerm.toLowerCase().trim()
    );
  }, [categories, searchTerm]);

  const handleSelect = (category: Category) => {
    onChange(category.name);
    setSearchTerm(category.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(value);
      inputRef.current?.blur();
    }
  };

  // Find matching category for color display
  const matchedCategory = categories.find(
    cat => cat.name.toLowerCase() === value.toLowerCase()
  );

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative flex items-center">
        {matchedCategory && (
          <div 
            className="absolute left-3 w-3 h-3 rounded-full pointer-events-none"
            style={{ backgroundColor: matchedCategory.color }}
          />
        )}
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('Type or select category')}
          className={cn(
            "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[var(--accent)]",
            matchedCategory && "pl-10"
          )}
          autoComplete="off"
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-10 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label={t('Clear')}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label={t('Select Category')}
        >
          <ChevronDown size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-auto">
          {filteredCategories.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-secondary)]">
              {searchTerm.trim() ? (
                <span>
                  {t('Create')} "<strong>{searchTerm}</strong>" {t('as new category')}
                </span>
              ) : (
                t('No categories found')
              )}
            </div>
          ) : (
            filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleSelect(category)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--bg)] transition-colors text-left",
                  value.toLowerCase() === category.name.toLowerCase() && "bg-[var(--accent)]/10"
                )}
              >
                <div 
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate">{category.name}</span>
                {value.toLowerCase() === category.name.toLowerCase() && (
                  <Check size={16} className="text-[var(--accent)] shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
