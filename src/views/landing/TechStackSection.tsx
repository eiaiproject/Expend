import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { type ReactNode } from 'react';
import { Code2, Smartphone, Database, Shield, BarChart3, Zap, Github } from 'lucide-react';

interface TechItem {
  icon: ReactNode;
  name: string;
  description: string;
  color: string;
}

function TechCard({ icon, name, description, color, index }: TechItem & { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group"
    >
      <div className="flex items-start gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[#1E293B]/30 border border-white/5 hover:border-white/10 transition-all duration-300">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${color} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-white mb-1">{name}</h4>
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function TechStackSection() {
  const { t } = useTranslation();

  const techStack: TechItem[] = [
    {
      icon: <Code2 size={20} className="text-white" />,
      name: t('landing.techReact'),
      description: t('landing.techReactDesc'),
      color: 'bg-[#61DAFB]/20',
    },
    {
      icon: <Smartphone size={20} className="text-white" />,
      name: t('landing.techPwa'),
      description: t('landing.techPwaDesc'),
      color: 'bg-[var(--accent)]/20',
    },
    {
      icon: <Database size={20} className="text-white" />,
      name: t('landing.techDatabase'),
      description: t('landing.techDatabaseDesc'),
      color: 'bg-[#F7DF1E]/20',
    },
    {
      icon: <Shield size={20} className="text-white" />,
      name: t('landing.techSecurity'),
      description: t('landing.techSecurityDesc'),
      color: 'bg-[#4CAF50]/20',
    },
    {
      icon: <BarChart3 size={20} className="text-white" />,
      name: t('landing.techCharts'),
      description: t('landing.techChartsDesc'),
      color: 'bg-[#FF6B6B]/20',
    },
    {
      icon: <Zap size={20} className="text-white" />,
      name: t('landing.techBuild'),
      description: t('landing.techBuildDesc'),
      color: 'bg-[#BD34FE]/20',
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 sm:mb-16"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6"
        >
          <Code2 size={14} className="text-[#94A3B8]" />
          <span className="text-xs sm:text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            {t('landing.openSource')}
          </span>
        </motion.div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          {t('landing.techTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[#94A3B8] max-w-2xl mx-auto">
          {t('landing.techSubtitle')}
        </p>
      </motion.div>

      {/* Tech Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {techStack.map((tech, i) => (
          <TechCard key={i} {...tech} index={i} />
        ))}
      </div>

      {/* GitHub CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-10 sm:mt-12 text-center"
      >
        <a
          href="https://github.com/eiaiproject/Expend.git"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
        >
          <Github size={20} />
          <span>{t('landing.viewSource')}</span>
          <span className="text-white/40 group-hover:text-white/60 transition-colors">→</span>
        </a>
      </motion.div>
    </section>
  );
}
