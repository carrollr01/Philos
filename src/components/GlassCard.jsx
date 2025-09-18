import { motion } from 'framer-motion'
import './GlassCard.css'

const GlassCard = ({ 
  children, 
  className = '', 
  delay = 0, 
  duration = 0.6, 
  hover = true,
  ...props 
}) => {
  const cardVariants = {
    initial: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration,
        delay,
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  }

  const hoverVariants = hover ? {
    whileHover: {
      y: -4,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    },
    whileTap: {
      scale: 0.98,
      transition: {
        duration: 0.1
      }
    }
  } : {}

  return (
    <motion.div
      className={`glass-card ${className}`}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      {...hoverVariants}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export default GlassCard