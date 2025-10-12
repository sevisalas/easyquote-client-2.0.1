import Template1 from '@/components/templates/Template1';
import Template2 from '@/components/templates/Template2';
import Template3 from '@/components/templates/Template3';
import Template4 from '@/components/templates/Template4';
import Template5 from '@/components/templates/Template5';
import Template6 from '@/components/templates/Template6';

export interface TemplateInfo {
  id: number;
  name: string;
  component: React.ComponentType<{ data: any }>;
  thumbnail: string;
  description: string;
}

export const templates: TemplateInfo[] = [
  {
    id: 1,
    name: 'Clásico',
    component: Template1,
    thumbnail: '/assets/template1-preview.png',
    description: 'Diseño clásico y profesional'
  },
  {
    id: 2,
    name: 'Moderno',
    component: Template2,
    thumbnail: '/assets/template2-preview.png',
    description: 'Diseño moderno con colores vibrantes'
  },
  {
    id: 3,
    name: 'Minimalista',
    component: Template3,
    thumbnail: '/assets/template3-preview.png',
    description: 'Diseño limpio y minimalista'
  },
  {
    id: 4,
    name: 'Corporativo',
    component: Template4,
    thumbnail: '/assets/template4-preview.png',
    description: 'Diseño corporativo elegante'
  },
  {
    id: 5,
    name: 'Creativo',
    component: Template5,
    thumbnail: '/assets/template5-preview.png',
    description: 'Diseño creativo y llamativo'
  },
  {
    id: 6,
    name: 'Ejecutivo',
    component: Template6,
    thumbnail: '/assets/template6-preview.png',
    description: 'Diseño ejecutivo premium'
  }
];

export const getTemplate = (templateNumber: number): React.ComponentType<{ data: any }> => {
  const template = templates.find(t => t.id === templateNumber);
  return template ? template.component : templates[0].component;
};

export const getTemplateInfo = (templateNumber: number): TemplateInfo => {
  const template = templates.find(t => t.id === templateNumber);
  return template || templates[0];
};
