'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface AccordionItem {
  id: string
  question: string
  answer: string
}

interface AccordionProps {
  items: AccordionItem[]
  defaultOpen?: string
  borderColor?: string
}

export default function Accordion({ items, defaultOpen, borderColor = '#ddd2bb' }: AccordionProps) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null)

  return (
    <div>
      {items.map((item) => {
        const isOpen = open === item.id
        return (
          <div key={item.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
            <button
              onClick={() => setOpen(isOpen ? null : item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                padding: '24px 4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 600,
                  fontSize: '18px',
                  color: '#1a1d17',
                }}
              >
                {item.question}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '24px',
                  lineHeight: 1,
                  color: '#39402c',
                  fontWeight: 300,
                  flexShrink: 0,
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                }}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-manrope)',
                      fontSize: '16px',
                      lineHeight: 1.6,
                      color: '#3a3f33',
                      margin: 0,
                      padding: '0 4px 24px',
                      maxWidth: '680px',
                    }}
                  >
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
