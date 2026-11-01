import { Component, createRef } from 'react';

export default class ErrorBoundary extends Component {
    state = { failed: false, recovering: false, recoveryFailed: false, generation: 0 };
    heading = createRef();

    static getDerivedStateFromError() { return { failed: true }; }

    componentDidMount() {
        if (this.state.failed) this.heading.current?.focus();
    }

    componentDidUpdate(previousProps, previousState) {
        if (this.state.failed && !previousState.failed) this.heading.current?.focus();
    }

    retry = async () => {
        this.setState({ recovering: true, recoveryFailed: false });
        try {
            await this.props.onRetry?.();
            this.setState((state) => ({ failed: false, recovering: false, generation: state.generation + 1 }));
        } catch {
            this.setState({ recovering: false, recoveryFailed: true });
        }
    };

    render() {
        if (!this.state.failed) return <div key={this.state.generation}>{this.props.children}</div>;
        return <main className='mx-auto max-w-3xl p-6'>
            <section role='alert' className='space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-6 text-slate-900'>
                <h1 ref={this.heading} tabIndex={-1} className='text-xl font-semibold'>No se pudo mostrar {this.props.label || 'la aplicación'}.</h1>
                <p>Puedes volver a abrir la pantalla o recargar la aplicación. Los cambios que no hayas guardado en esta pantalla se perderán.</p>
                <p>Si había una operación en curso, consulta su estado antes de repetirla.</p>
                {this.props.onRetry && <p>También puedes abrir otro módulo desde el menú.</p>}
                {this.state.recoveryFailed && <p>No fue posible volver a abrir la pantalla. Recarga la aplicación.</p>}
                <div className='flex flex-wrap gap-3'>
                    {this.props.onRetry && <button type='button' disabled={this.state.recovering}
                        className='rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50' onClick={this.retry}>
                        {this.state.recovering ? 'Abriendo…' : 'Volver a abrir esta pantalla'}
                    </button>}
                    <button type='button' className='rounded-lg border border-slate-400 bg-white px-4 py-2'
                        onClick={() => window.location.reload()}>Recargar aplicación</button>
                </div>
            </section>
        </main>;
    }
}
