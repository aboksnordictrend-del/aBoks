'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface CartToastProps {
  visible: boolean
}

export default function CartToast({ visible }: CartToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 16, x: '-50%' }}
          transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '28px',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#1a1d17',
            color: '#faf6ee',
            padding: '13px 22px',
            borderRadius: '999px',
            boxShadow: '0 14px 40px -10px rgba(0,0,0,.4)',
            fontFamily: 'var(--font-manrope)',
            fontSize: '14px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a9c08f"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Lagt i handlekurven
        </motion.div>
      )}
    </AnimatePresence>
  )
}
