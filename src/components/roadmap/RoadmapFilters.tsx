import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { TaskCategory, TaskPriority, Sprint } from "@/hooks/useRoadmap";

interface RoadmapFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryFilter: TaskCategory | "all";
  onCategoryChange: (value: TaskCategory | "all") => void;
  priorityFilter: TaskPriority | "all";
  onPriorityChange: (value: TaskPriority | "all") => void;
  sprintFilter: string;
  onSprintChange: (value: string) => void;
  sprints: Sprint[];
  onClearFilters: () => void;
}

const categories: { value: TaskCategory | "all"; label: string }[] = [
  { value: "all", label: "Todas las categorías" },
  { value: "integration", label: "Integración" },
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Mejora" },
  { value: "bugfix", label: "Bugfix" },
  { value: "infrastructure", label: "Infraestructura" },
];

const priorities: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "Todas las prioridades" },
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

export const RoadmapFilters = ({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  priorityFilter,
  onPriorityChange,
  sprintFilter,
  onSprintChange,
  sprints,
  onClearFilters,
}: RoadmapFiltersProps) => {
  const hasFilters =
    search || categoryFilter !== "all" || priorityFilter !== "all" || sprintFilter !== "all";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar tareas..."
          className="pl-9"
        />
      </div>

      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priorityFilter} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          {priorities.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sprintFilter} onValueChange={onSprintChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sprint" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los sprints</SelectItem>
          <SelectItem value="none">Sin sprint</SelectItem>
          {sprints.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </div>
  );
};
