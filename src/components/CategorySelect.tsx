import { useState, useRef, useEffect, useMemo, useId } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const inputId = id || `${autoId}-input`;

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
    setActiveIndex(-1);
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
    setActiveIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(value);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => 
          prev < filteredCategories.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => 
          prev > 0 ? prev - 1 : filteredCategories.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredCategories.length) {
          const selected = filteredCategories[activeIndex];
          if (selected) handleSelect(selected);
        }
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(filteredCategories.length - 1);
        break;
    }
  };

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

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
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('Type or select category')}
          className={cn(
            "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]",
            matchedCategory && "pl-10"
          )}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
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
        <div 
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          aria-label={t('Select Category')}
          className="absolute z-30 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg max-h-60 overflow-auto"
        >
          {filteredCategories.length === 0 ? (
            <div role="option" className="px-4 py-3 text-sm text-[var(--text-secondary)]">
              {searchTerm.trim() ? (
                <span>
                  {t('Create')} "<strong>{searchTerm}</strong>" {t('as new category')}
                </span>
              ) : (
                t('No categories found')
              )}
            </div>
          ) : (
            filteredCategories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                role="option"
                id={`${listboxId}-option-${index}`}
                aria-selected={value.toLowerCase() === category.name.toLowerCase()}
                onClick={() => handleSelect(category)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--bg)] transition-colors text-left",
                  value.toLowerCase() === category.name.toLowerCase() && "bg-[var(--accent)]/10",
                  index === activeIndex && "bg-[var(--bg)]"
                )}
              >
                <div 
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{category.name}</span>
                {value.toLowerCase() === category.name.toLowerCase() && (
                  <Check size={16} className="text-[var(--accent)] shrink-0" aria-hidden="true" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
