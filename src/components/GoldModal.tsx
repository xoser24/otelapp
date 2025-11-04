import React from 'react';
import { createPortal } from 'react-dom';

interface GoldModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
}

export const GoldModal: React.FC<GoldModalProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92%] max-w-lg rounded-xl p-[1px] gold-border-glow">
        <div className="absolute inset-x-0 -top-px h-[1px] gold-thin-line" />
        <div className="gold-glass-surface rounded-xl max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-amber-400/20 bg-black/30 backdrop-blur">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="text-secondary hover:text-white/90">✕</button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GoldModal;