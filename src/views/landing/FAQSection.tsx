import { useState } from 'react';
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
    <div
      className="border-b border-[var(--border-subtle)] last:border-b-0"
    >
      <button
        type="button"
        id={buttonId}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full py-4 sm:py-5 flex items-center justify-between text-left group cursor-pointer"
      >
        <span className="text-sm sm:text-base font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors pr-4">
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`text-[var(--text-muted)] shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <>
        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            className="overflow-hidden"
          >
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed pb-4 sm:pb-5">
              {item.answer}
            </p>
          </div>
        )}
      </>
    </div>
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
    <section id="faq-section" className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6 relative z-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div
        className="text-center mb-10 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3 text-balance">
            {t('landing.faqTitle')}
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] text-pretty">
            {t('landing.faqSubtitle')}
          </p>
        </div>

        {/* FAQ List */}
        <div className="bg-[var(--surface)]/30 border border-[var(--border-subtle)] rounded-xl sm:rounded-2xl p-5 sm:p-8">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} item={faq} index={i} />
          ))}
        </div>

        {/* Contact */}
        <div
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
        </div>
      </div>
    </section>
  );
}
