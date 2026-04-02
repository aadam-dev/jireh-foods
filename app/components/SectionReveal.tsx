"use client";

import { motion } from "framer-motion";

const defaultUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function SectionReveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "fade";
}) {
  const v = variant === "fade" ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : defaultUp;
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay }}
      variants={v}
      className={className}
    >
      {children}
    </motion.section>
  );
}
