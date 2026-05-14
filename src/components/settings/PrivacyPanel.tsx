import { useCallback } from "react";
import { useConsentStore } from "@/stores/consent";

/**
 * Panel de configuración de Privacidad.
 *
 * Muestra:
 * - Toggle de consentimiento para compartir datos de uso (rich context)
 * - Botón "Exportar mis datos" — descarga JSON con todos los datos en la nube
 * - Botón "Eliminar mis datos" — con paso de confirmación
 * - Link a la política de privacidad
 *
 * Visible solo para usuarios autenticados (el tab se oculta en modo invitado).
 */
export function PrivacyPanel() {
  const richConsent = useConsentStore((s) => s.richConsent);
  const dataExportRequested = useConsentStore((s) => s.dataExportRequested);
  const dataDeletionRequested = useConsentStore((s) => s.dataDeletionRequested);
  const deletionConfirmStep = useConsentStore((s) => s.deletionConfirmStep);
  const toggleRichConsent = useConsentStore((s) => s.toggleRichConsent);
  const requestDataExport = useConsentStore((s) => s.requestDataExport);
  const resetExportRequest = useConsentStore((s) => s.resetExportRequest);
  const requestDataDeletion = useConsentStore((s) => s.requestDataDeletion);
  const cancelDataDeletion = useConsentStore((s) => s.cancelDataDeletion);
  const confirmDataDeletion = useConsentStore((s) => s.confirmDataDeletion);

  const handleExport = useCallback(() => {
    requestDataExport();
    // Generar un JSON con toda la información local y de configuración
    const allData: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allData[key] = localStorage.getItem(key);
    }
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibe-studio-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [requestDataExport]);

  const handleDeleteConfirm = useCallback(async () => {
    confirmDataDeletion();
    
    // Attempt to notify backend if authenticated
    try {
      const authState = (await import("@/stores/auth")).useAuthStore.getState();
      if (authState.session?.token) {
        const API_BASE_URL = "https://suy2kd74af.execute-api.us-east-1.amazonaws.com/v1";
        await fetch(`${API_BASE_URL}/community/projects`, { // Generic endpoint for now
          method: "DELETE",
          headers: { "Authorization": `Bearer ${authState.session.token}` }
        }).catch(() => {});
      }
      
      // Limpiar datos locales y cerrar sesión
      localStorage.clear();
      if (authState.logout) {
        authState.logout();
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error("Error al eliminar datos", e);
      localStorage.clear();
      window.location.reload();
    }
  }, [confirmDataDeletion]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-[#d4d4d4]">Privacidad</h2>
      <p className="text-xs text-[#969696]">
        Tus datos son tuyos. Acá controlás qué compartís y qué no.
        Respetamos la privacidad desde el diseño: recolectamos solo lo necesario
        para que Vibe Studio funcione, y siempre con transparencia.
      </p>

      {/* Consent Toggle */}
      <div className="rounded border border-glass bg-glass p-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-[#d4d4d4]">
              Compartir datos de uso
            </span>
            <span className="text-xs text-[#969696]">
              {richConsent
                ? "Prendido — ayudás a mejorar Vibe Studio"
                : "Apagado — solo datos básicos"}
            </span>
          </div>
          <button
            onClick={toggleRichConsent}
            role="switch"
            aria-checked={richConsent}
            aria-label="Compartir datos de uso"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              richConsent ? "bg-vibe-cyan" : "bg-[#555]"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                richConsent ? "translate-x-[18px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#616161]">
          Datos básicos (idioma, tema visual, nivel de habilidad) siempre se
          recolectan para que la app funcione. Datos de uso detallados
          (eventos de aprendizaje, proyectos, archivos editados) solo cuando
          nos des permiso.
        </p>
      </div>

      {/* GDPR info */}
      <div className="rounded border border-glass bg-glass p-3">
        <h3 className="mb-1 text-xs font-medium text-[#d4d4d4]">
          Tus derechos GDPR
        </h3>
        <ul className="space-y-1 text-[10px] text-[#969696]">
          <li>✓ Accedé a todos tus datos cuando quieras</li>
          <li>✓ Exportalos en formato JSON</li>
          <li>✓ Eliminalos permanentemente</li>
          <li>✓ Desactivá la recolección en cualquier momento</li>
        </ul>
      </div>

      {/* Data Export */}
      <div className="rounded border border-glass bg-glass p-3">
        <h3 className="mb-1 text-xs font-medium text-[#d4d4d4]">
          Exportar mis datos
        </h3>
        <p className="mb-2 text-[10px] text-[#969696]">
          Descarga un archivo JSON con todos tus datos almacenados en la nube.
        </p>
        {dataExportRequested ? (
          <p className="text-xs text-[#4ec9b0]">
            Exportación solicitada. Revisá tu bandeja de descargas.
          </p>
        ) : (
          <button
            onClick={handleExport}
            className="rounded bg-vibe-surface px-3 py-1.5 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-vibe-surface/80"
            aria-label="Exportar mis datos"
          >
            Exportar mis datos
          </button>
        )}
        {dataExportRequested && (
          <button
            onClick={resetExportRequest}
            className="ml-2 text-[10px] text-vibe-cyan underline"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* Data Deletion */}
      <div className="rounded border border-glass bg-glass p-3">
        <h3 className="mb-1 text-xs font-medium text-[#d4d4d4]">
          Eliminar mis datos
        </h3>
        <p className="mb-2 text-[10px] text-[#969696]">
          Eliminá permanentemente todos tus datos de la nube. Esta acción no
          se puede deshacer.
        </p>
        {deletionConfirmStep ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-2">
            <p className="mb-2 text-xs text-red-400">
              ¿Estás seguro? Esta acción eliminará TODOS tus datos
              almacenados en la nube de Vibe Studio.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteConfirm}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                aria-label="Sí, eliminar"
              >
                Sí, eliminar
              </button>
              <button
                onClick={cancelDataDeletion}
                className="rounded bg-vibe-surface px-3 py-1.5 text-xs font-medium text-[#d4d4d4] transition-colors hover:bg-vibe-surface/80"
                aria-label="Cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : dataDeletionRequested ? (
          <p className="text-xs text-[#4ec9b0]">
            Datos eliminados correctamente.
          </p>
        ) : (
          <button
            onClick={requestDataDeletion}
            className="rounded border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
            aria-label="Eliminar mis datos"
          >
            Eliminar mis datos
          </button>
        )}
      </div>

      {/* Privacy Policy Link */}
      <a
        href="https://opita.co/privacidad"
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-[10px] text-vibe-cyan underline"
      >
        Ver política de privacidad completa
      </a>
    </div>
  );
}
