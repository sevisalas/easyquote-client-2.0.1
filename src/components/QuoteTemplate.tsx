import { getTemplate } from '@/utils/templateRegistry';

interface QuoteTemplateProps {
  data: any;
  templateNumber?: number;
}

export default function QuoteTemplate({ data, templateNumber = 1 }: QuoteTemplateProps) {
  const TemplateComponent = getTemplate(templateNumber);
  
  return <TemplateComponent data={data} />;
}
