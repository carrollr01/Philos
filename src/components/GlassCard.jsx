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
      y: 10,
      scale: 0.98
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: duration * 0.5,
        delay,
        type: "ease",
        ease: "easeOut"
      }
    }
  }

  const hoverVariants = hover ? {
    whileHover: {
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    },
    whileTap: {
      scale: 0.995,
      transition: {
        duration: 0.05
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