import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface SettingsAccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SettingsAccordion({ title, defaultOpen = false, children }: SettingsAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerId = useId();
  const contentId = useId();
  
  return (
    <section className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4"
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</span>
        <ChevronDown 
          size={20} 
          className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? '' : 'rotate-90'}`} 
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={triggerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[var(--bg)] border-t border-[var(--border)]"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
