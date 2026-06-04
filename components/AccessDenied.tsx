import { ShieldOff } from 'lucide-react'

export function AccessDenied() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark flex items-center justify-center mb-4">
        <ShieldOff size={28} className="text-gray-400 dark:text-fp-text-secondary" />
      </div>
      <h2 className="text-lg font-semibold text-fp-navy dark:text-fp-honeydew mb-2">
        Sin acceso
      </h2>
      <p className="text-sm text-gray-400 dark:text-fp-text-secondary max-w-xs">
        No tenés permisos para ver este módulo. Contactá a un administrador.
      </p>
    </div>
  )
}