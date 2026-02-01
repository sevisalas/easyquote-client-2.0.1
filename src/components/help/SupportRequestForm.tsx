import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSupportRequests, SupportRequestType } from "@/hooks/useSupportRequests";
import { Lightbulb, Bug, HelpCircle, Send, Loader2 } from "lucide-react";

const typeOptions: { value: SupportRequestType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'feature', 
    label: 'Nueva funcionalidad', 
    icon: <Lightbulb className="h-4 w-4" />,
    description: 'Sugiere mejoras o nuevas características'
  },
  { 
    value: 'bug', 
    label: 'Reportar error', 
    icon: <Bug className="h-4 w-4" />,
    description: 'Algo no funciona como debería'
  },
  { 
    value: 'question', 
    label: 'Duda / Consulta', 
    icon: <HelpCircle className="h-4 w-4" />,
    description: 'Necesitas ayuda o tienes preguntas'
  },
];

export function SupportRequestForm() {
  const { createRequest } = useSupportRequests();
  const [type, setType] = useState<SupportRequestType>('question');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) return;

    await createRequest.mutateAsync({
      type,
      title: title.trim(),
      description: description.trim()
    });

    // Reset form
    setTitle('');
    setDescription('');
    setType('question');
  };

  const selectedType = typeOptions.find(t => t.value === type);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Enviar solicitud
        </CardTitle>
        <CardDescription>
          ¿Tienes una idea, encontraste un error o necesitas ayuda?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de solicitud</Label>
            <Select value={type} onValueChange={(v) => setType(v as SupportRequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumen breve de tu solicitud"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe con detalle tu solicitud, error o pregunta..."
              rows={4}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={createRequest.isPending || !title.trim() || !description.trim()}
          >
            {createRequest.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar solicitud
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
