import type { Variants } from 'framer-motion';

export const easeOut = [0.22, 1, 0.36, 1] as const;

// Entrada da página: sobe levemente e escalona os filhos que usam `itemVariants`.
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOut, staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
};
