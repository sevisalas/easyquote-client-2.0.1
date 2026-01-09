import { Badge } from "@/components/ui/badge";
import { TaskCategory } from "@/hooks/useRoadmap";
import { Plug, Sparkles, TrendingUp, Bug, Server } from "lucide-react";

interface TaskCategoryBadgeProps {
  category: TaskCategory;
  showLabel?: boolean;
}

const categoryConfig: Record<TaskCategory, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  integration: {
    label: "Integración",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
    Icon: Plug,
  },
  feature: {
    label: "Feature",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    Icon: Sparkles,
  },
  improvement: {
    label: "Mejora",
    className: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300",
    Icon: TrendingUp,
  },
  bugfix: {
    label: "Bugfix",
    className: "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
    Icon: Bug,
  },
  infrastructure: {
    label: "Infra",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300",
    Icon: Server,
  },
};

export const TaskCategoryBadge = ({ category, showLabel = true }: TaskCategoryBadgeProps) => {
  const config = categoryConfig[category];
  const { Icon } = config;

  return (
    <Badge variant="outline" className={`${config.className} border-none gap-1`}>
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </Badge>
  );
};

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "high":
      return "text-orange-600 dark:text-orange-400";
    case "medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "low":
      return "text-gray-500 dark:text-gray-400";
    default:
      return "text-muted-foreground";
  }
};

export const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case "critical":
      return "Crítica";
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Baja";
    default:
      return priority;
  }
};
