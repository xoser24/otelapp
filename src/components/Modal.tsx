import React from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string; // e.g. 'max-w-2xl'
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidthClass = 'max-w-2xl' }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-[#121212]/80 backdrop-blur-glass animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 grid place-items-center p-4">
        <div className={`glass-surface rounded-3xl shadow-goldGlow w-full ${maxWidthClass} overflow-hidden animate-pop-in`} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;