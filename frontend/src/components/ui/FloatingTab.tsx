import {
  motion,
} from "framer-motion";

import type {
  ReactNode,
} from "react";

interface FloatingTabProps {
  title: string;
  description: string;
  icon: ReactNode;
  className?: string;
  delay?: number;
}

export default function FloatingTab({
  title,
  description,
  icon,
  className = "",
  delay = 0,
}: FloatingTabProps) {
  return (
    <motion.div
      className={`floating-tab ${className}`}
      animate={{
        y: [0, -9, 0],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <div className="floating-tab-icon">
        {icon}
      </div>

      <div className="floating-tab-content">
        <strong>{title}</strong>

        <span>
          {description}
        </span>
      </div>

      <div className="floating-tab-dot" />
    </motion.div>
  );
}