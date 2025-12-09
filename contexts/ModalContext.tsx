import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface ModalContextType {
  showModal: (title: string, message: string, onConfirm: () => void) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showModal = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, onConfirm });
  }, []);

  const hideModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = () => {
    modalState.onConfirm();
    hideModal();
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-rose-500">
                <div className="p-6 bg-rose-50">
                    <h3 className="text-xl font-black text-rose-900 flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6" />
                        {modalState.title}
                    </h3>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 leading-relaxed">{modalState.message}</p>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={hideModal} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">
                        انصراف
                    </button>
                    <button onClick={handleConfirm} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all">
                        تایید و اجرا
                    </button>
                </div>
             </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
