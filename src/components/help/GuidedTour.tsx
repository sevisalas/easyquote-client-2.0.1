import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface GuidedTourProps {
  onClose: () => void;
}

export function GuidedTour({ onClose }: GuidedTourProps) {
  const [run, setRun] = useState(false);
  const { isSuperAdmin, canAccessPresupuestos, canAccessProduccion } = useSubscription();

  // Iniciar el tour después de un pequeño delay para asegurar que los elementos estén renderizados
  useEffect(() => {
    const timer = setTimeout(() => setRun(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Pasos base para todos los usuarios
  const baseSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">¡Bienvenido a EasyQuote! 🎉</h3>
          <p>Te mostraremos las funciones principales de la aplicación.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-sidebar="sidebar"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Menú de navegación</h3>
          <p>Desde aquí accedes a todas las secciones de la aplicación.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
  ];

  // Pasos condicionales según permisos
  const conditionalSteps: Step[] = [];

  if (canAccessPresupuestos && canAccessPresupuestos()) {
    conditionalSteps.push({
      target: '[href="/presupuestos"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Presupuestos</h3>
          <p>Crea y gestiona presupuestos con cálculo automático de precios.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    });
  }

  if (canAccessProduccion && canAccessProduccion()) {
    conditionalSteps.push({
      target: '[href="/pedidos"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Pedidos</h3>
          <p>Convierte presupuestos en pedidos y gestiona la producción.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    });
  }

  // Pasos finales
  const finalSteps: Step[] = [
    {
      target: '[href="/ayuda"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Centro de ayuda</h3>
          <p>Siempre puedes volver aquí para consultar la documentación.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">¡Listo! 🚀</h3>
          <p>Ya conoces lo básico. ¡Empieza a crear tu primer presupuesto!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
  ];

  const steps = [...baseSteps, ...conditionalSteps, ...finalSteps];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
      // Guardar que el usuario completó el tour
      localStorage.setItem('easyquote_tour_completed', 'true');
      onClose();
    }

    if (type === EVENTS.TOUR_END) {
      onClose();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      spotlightClicks
      disableOverlayClose
      callback={handleJoyrideCallback}
      locale={{
        back: 'Anterior',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Saltar tour',
      }}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--background))',
          arrowColor: 'hsl(var(--background))',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '0.5rem',
          padding: '1rem',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          borderRadius: '0.375rem',
          padding: '0.5rem 1rem',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: '0.5rem',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
        spotlight: {
          borderRadius: '0.5rem',
        },
      }}
    />
  );
}
