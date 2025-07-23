import { createContext, useContext, useState, ReactNode, ReactElement, cloneElement } from "react";
import { createPortal } from "react-dom";

/// Context: Provides the dialog state and methods to its children
interface DialogContextProps {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

function useDialog() {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error("Dialog components must be used within a Dialog.Root");
    }
    return context;
}

/// Root: Wraps the entire dialog and provides context to its children
interface DialogRootProps {
    children: ReactNode;
}

function Root({ children }: DialogRootProps) {
    const [isOpen, setIsOpen] = useState(false);
    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);

    return <DialogContext.Provider value={{ isOpen, open, close }}>{children}</DialogContext.Provider>;
}

/// Trigger: A button (or any interactive element) to open the dialog
interface DialogTriggerProps {
    children: ReactElement<{ onClick?: (...args: any[]) => void }>;
}

function Trigger({ children }: DialogTriggerProps) {
    const { open } = useDialog();

    // Clone the child element to attach an onClick handler that calls open()
    return cloneElement(children, { onClick: open });
}

/// Content: Renders the dialog content in a portal with an overlay
interface DialogContentProps {
    children: ReactNode;
}

function Content({ children }: DialogContentProps) {
    const { isOpen, close } = useDialog();

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black opacity-40" onClick={close} aria-hidden="true" />

            {/* Dialog Panel */}
            <div className="relative w-full max-w-lg rounded-md border border-neutral-400 bg-white p-6 shadow-lg">
                {/* Close Button */}
                <button
                    onClick={close}
                    className="absolute right-2 top-2 text-neutral-600 hover:text-neutral-800 focus:outline-hidden"
                    aria-label="Close dialog"
                >
                    &times;
                </button>

                {children}
            </div>
        </div>,
        document.body,
    );
}

// Create and export Dialog as a compound component
const Dialog = {
    Root,
    Trigger,
    Content,
};

export default Dialog;
