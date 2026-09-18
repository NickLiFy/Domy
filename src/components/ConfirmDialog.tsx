import type { Home, RemovalAction } from '../types/home'

type ConfirmDialogProps = {
  home: Home
  action: RemovalAction
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ home, action, onCancel, onConfirm }: ConfirmDialogProps) {
  const isArchive = action === 'archive'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="eyebrow accent-eyebrow">POTVRDIT AKCI</span>
        <h2 id="confirm-dialog-title">{isArchive ? 'Přesunout dům do archivu?' : 'Odstranit dům natrvalo?'}</h2>
        <p>
          {isArchive
            ? `${home.title} zmizí z aktivního shortlistu, ale zůstane v archivu.`
            : `${home.title} bude odstraněn z aktivních i uložených nabídek.`}
        </p>
        <div className="confirm-dialog-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>Zrušit</button>
          <button className={isArchive ? 'archive-confirm-button' : 'delete-confirm-button'} type="button" onClick={onConfirm}>
            {isArchive ? 'Přesunout do archivu' : 'Odstranit trvale'}
          </button>
        </div>
      </div>
    </div>
  )
}
