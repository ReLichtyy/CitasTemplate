import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportarError } from '../../lib/telemetria';
import { Button } from '../ui/Button';

type Props = { children: ReactNode };

type Estado = {
  fallo: boolean;
  /** El `x-request-id` con el que quedo registrado el fallo en el servidor. */
  codigo: string | null;
};

/**
 * Lo unico que ataja una excepcion durante el render de React. Sin el, el arbol se
 * desmonta entero y queda una pagina en blanco: ni mensaje, ni forma de saber que paso, ni
 * rastro en ningun log. Es el fallo mas caro de una demo, porque no deja nada que mirar.
 *
 * Tiene que ser una clase. React no expone `getDerivedStateFromError` ni `componentDidCatch`
 * a los hooks, y es el unico caso del frontend donde eso pasa.
 *
 * No es un reemplazo del manejo de error de cada pagina: un fallo del API llega por
 * `useRecursoApi`/`useAccionApi` y se muestra en su sitio con `Alert`. Esto atrapa lo que
 * ya no tiene sitio donde mostrarse.
 */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { fallo: false, codigo: null };

  static getDerivedStateFromError(): Partial<Estado> {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void reportarError({
      tipo: 'render',
      mensaje: error.message,
      traza: error.stack,
      // La pila de componentes es lo que distingue "fallo en ReservarPage" de "fallo en
      // algun sitio": dice por que rama del arbol venia.
      componente: info.componentStack ?? undefined,
    }).then((codigo) => {
      if (codigo) {
        this.setState({ codigo });
      }
    });
  }

  private reintentar = () => {
    // Recarga completa y no solo `setState`: si el fallo viene del estado en memoria,
    // volver a montar el mismo arbol vuelve a romperlo en el acto.
    window.location.reload();
  };

  render() {
    if (!this.state.fallo) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-16 text-center">
        <div className="flex max-w-prose flex-col gap-3">
          <h1 className="text-2xl font-semibold text-text-h sm:text-3xl">
            Algo se rompio en esta pagina
          </h1>
          <p className="text-sm text-text">
            El fallo quedo registrado. Puede recargar e intentar de nuevo; si vuelve a
            ocurrir, comparta el codigo de abajo.
          </p>
        </div>

        {this.state.codigo ? (
          <p className="flex flex-col items-center gap-1">
            <span className="text-xs font-medium tracking-wide text-text-muted uppercase">
              Codigo del fallo
            </span>
            {/* Seleccionable a proposito: se copia y se pega en el reporte. */}
            <code className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-h select-all">
              {this.state.codigo}
            </code>
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={this.reintentar}>Recargar</Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            Ir al inicio
          </Button>
        </div>
      </main>
    );
  }
}
