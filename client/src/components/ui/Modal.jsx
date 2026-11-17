import * as Dialog from '@radix-ui/react-dialog'

/** Diálogo centrado sobre un velo; en el móvil, hoja que sube desde abajo. Se cierra con Esc o pulsando fuera */
export function Modal({ open, onClose, title, aside, swatch, width = 440, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* Sin backdrop-filter: cuando Firefox pinta sin tarjeta gráfica, desenfocar el fondo en cada fotograma
            (y con dos diálogos apilados, dos veces) deja la página a ~20 fps */}
        <Dialog.Overlay className="fixed inset-0 z-50 grid animate-veil-in place-items-center overflow-y-auto bg-scrim p-5 max-sm:place-items-end max-sm:p-0">
          <Dialog.Content
            style={{ maxWidth: width }}
            // El diálogo recibe el foco al abrirse si no tiene campos; el contorno sólo va en sus controles
            className="w-full animate-dialog-in rounded-modal bg-surface p-6 shadow-modal outline-none max-sm:max-h-[92dvh] max-sm:max-w-none! max-sm:animate-sheet-in max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-t-sheet max-sm:rounded-b-none max-sm:px-5 max-sm:pt-3 max-sm:pb-[calc(env(safe-area-inset-bottom)+22px)]"
          >
            <div className="mx-auto mb-4 h-1 w-[38px] rounded-[2px] bg-ink/20 sm:hidden" />
            <div className={`flex justify-between gap-2.5 ${swatch ? 'items-center' : 'items-baseline'}`}>
              {swatch && <span className="size-3 flex-none rounded-swatch" style={{ background: swatch }} />}
              <Dialog.Title className="flex-1 text-[19px] leading-tight tracking-[-0.01em] text-ink">{title}</Dialog.Title>
              {aside && <span className="font-mono text-[11.5px] text-ink-3">{aside}</span>}
            </div>
            <Dialog.Description className="sr-only">{aside ? `${title}, ${aside}` : title}</Dialog.Description>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
