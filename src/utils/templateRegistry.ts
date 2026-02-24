import { supabase } from '@/integrations/supabase/client';
import Template1 from '@/components/templates/Template1';
import Template2 from '@/components/templates/Template2';
import Template3 from '@/components/templates/Template3';
import Template4 from '@/components/templates/Template4';
import Template5 from '@/components/templates/Template5';
import Template6 from '@/components/templates/Template6';
import Template7 from '@/components/templates/Template7';
import Template8 from '@/components/templates/Template8';

export interface TemplateInfo {
  id: number;
  name: string;
  component: React.ComponentType<{ data: any }>;
  thumbnail: string;
  description: string;
  isCustom?: boolean;
  isGlobal?: boolean;
  price?: number;
}

// Map of template components by number
const templateComponents: Record<number, React.ComponentType<{ data: any }>> = {
  1: Template1,
  2: Template2,
  3: Template3,
  4: Template4,
  5: Template5,
  6: Template6,
  7: Template7,
  8: Template8,
};

// Fallback templates (used if DB is unavailable)
const defaultTemplates: TemplateInfo[] = [
  {
    id: 1,
    name: 'Clásico',
    component: Template1,
    thumbnail: '/assets/template1-preview.png',
    description: 'Diseño clásico y profesional',
    isGlobal: true,
  },
  {
    id: 2,
    name: 'Moderno',
    component: Template2,
    thumbnail: '/assets/template2-preview.png',
    description: 'Diseño moderno con colores vibrantes',
    isGlobal: true,
  },
  {
    id: 3,
    name: 'Minimalista',
    component: Template3,
    thumbnail: '/assets/template3-preview.png',
    description: 'Diseño limpio y minimalista',
    isGlobal: true,
  },
  {
    id: 4,
    name: 'Corporativo',
    component: Template4,
    thumbnail: '/assets/template4-preview.png',
    description: 'Diseño corporativo elegante',
    isGlobal: true,
  },
  {
    id: 5,
    name: 'Creativo',
    component: Template5,
    thumbnail: '/assets/template5-preview.png',
    description: 'Diseño creativo y llamativo',
    isGlobal: true,
  },
  {
    id: 6,
    name: 'Ejecutivo',
    component: Template6,
    thumbnail: '/assets/template6-preview.png',
    description: 'Diseño ejecutivo premium',
    isGlobal: true,
  }
];

// Fetch available templates from database (filtered by organization)
export const fetchAvailableTemplates = async (): Promise<TemplateInfo[]> => {
  try {
    // Get current user's organization_id
    let orgId: string | null = null;
    const stored = sessionStorage.getItem('selectedOrganization');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        orgId = parsed.id || null;
      } catch { /* ignore */ }
    }

    if (!orgId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id')
          .eq('api_user_id', user.id)
          .limit(1);
        if (orgData && orgData.length > 0) {
          orgId = orgData[0].id;
        } else {
          const { data: memberData } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1);
          if (memberData && memberData.length > 0) {
            orgId = memberData[0].organization_id;
          }
        }
      }
    }

    // Fetch only global templates + templates for this specific organization
    let query = supabase
      .from('pdf_templates')
      .select('*')
      .eq('is_active', true);

    if (orgId) {
      // Show global templates OR templates belonging to this organization
      query = query.or(`is_global.eq.true,organization_id.eq.${orgId}`);
    } else {
      // No org context: only show global templates
      query = query.eq('is_global', true);
    }

    const { data, error } = await query
      .order('is_global', { ascending: false })
      .order('template_number');

    if (error) throw error;

    // Map DB templates to TemplateInfo
    const templates = (data || []).map(template => ({
      id: template.template_number,
      name: template.name,
      component: templateComponents[template.template_number] || Template1,
      thumbnail: template.thumbnail_url || '/assets/template1-preview.png',
      description: template.description || '',
      isCustom: template.is_custom,
      isGlobal: template.is_global,
      price: template.price || 0,
    }));

    return templates.length > 0 ? templates : defaultTemplates;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return defaultTemplates;
  }
};

// Get templates synchronously (for backwards compatibility)
// Use fetchAvailableTemplates() for async operations
export const templates: TemplateInfo[] = defaultTemplates;

export const getTemplate = (templateNumber: number): React.ComponentType<{ data: any }> => {
  return templateComponents[templateNumber] || templateComponents[1];
};

export const getTemplateInfo = (templateNumber: number): TemplateInfo => {
  const template = defaultTemplates.find(t => t.id === templateNumber);
  return template || defaultTemplates[0];
};
