import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonId = `faq-button-${index}`;
  const panelId = `faq-panel-${index}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index % 5) * 0.05 }}
      className="border-b border-white/5 last:border-b-0"
    >
      <button
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full py-4 sm:py-5 flex items-center justify-between text-left group cursor-pointer"
      >
        <span className="text-sm sm:text-base font-medium text-white group-hover:text-[var(--accent)] transition-colors pr-4">
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`text-[var(--text-secondary)] shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed pb-4 sm:pb-5">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQSection() {
  const { t } = useTranslation();

  const faqs: FAQItem[] = [
    {
      question: t('landing.faq1Question'),
      answer: t('landing.faq1Answer'),
    },
    {
      question: t('landing.faq2Question'),
      answer: t('landing.faq2Answer'),
    },
    {
      question: t('landing.faq3Question'),
      answer: t('landing.faq3Answer'),
    },
    {
      question: t('landing.faq4Question'),
      answer: t('landing.faq4Answer'),
    },
    {
      question: t('landing.faq5Question'),
      answer: t('landing.faq5Answer'),
    },
    {
      question: t('landing.faq6Question'),
      answer: t('landing.faq6Answer'),
    },
    {
      question: t('landing.faq7Question'),
      answer: t('landing.faq7Answer'),
    },
    {
      question: t('landing.faq9Question'),
      answer: t('landing.faq9Answer'),
    },
    {
      question: t('landing.faq10Question'),
      answer: t('landing.faq10Answer'),
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6"
          >
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              FAQ
            </span>
          </motion.div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
            {t('landing.faqTitle')}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)]">
            {t('landing.faqSubtitle')}
          </p>
        </motion.div>

        {/* FAQ List */}
        <div className="bg-[var(--card)]/30 border border-white/5 rounded-xl sm:rounded-2xl p-5 sm:p-8">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} item={faq} index={i} />
          ))}
        </div>

        {/* Contact */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs sm:text-sm text-[var(--text-secondary)] mt-6 sm:mt-8"
        >
          {t('landing.faqContact')}{' '}
          <a
            href="https://github.com/eiaiproject/Expend.git"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            {t('landing.faqContactLink')}
          </a>
        </motion.p>
      </div>
    </section>
  );
}
