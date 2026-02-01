import { useState } from 'react';
import { Search, BookOpen, ChevronRight, Rocket, FileText, Users, Package, Factory, Plug, Settings, Shield, ArrowLeft, PlayCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHelpAccess } from '@/hooks/useHelpAccess';
import { HelpArticle, HelpCategory } from '@/data/helpArticles';
import { GuidedTour } from './GuidedTour';
import { SupportRequestForm } from './SupportRequestForm';
import { UserRequestsList } from './UserRequestsList';

const iconMap: Record<string, React.ElementType> = {
  Rocket,
  FileText,
  Users,
  Package,
  Factory,
  Plug,
  Settings,
  Shield,
  BookOpen,
};

export function HelpCenter() {
  const { userRole, categories, search, getArticlesByCategory, getArticleById } = useHelpAccess();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  const searchResults = searchQuery ? search(searchQuery) : [];
  const currentCategory = selectedCategory ? categories.find(c => c.id === selectedCategory) : null;
  const categoryArticles = selectedCategory ? getArticlesByCategory(selectedCategory) : [];
  const currentArticle = selectedArticle ? getArticleById(selectedArticle) : null;

  const handleBack = () => {
    if (selectedArticle) {
      setSelectedArticle(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  const handleStartTour = () => {
    setShowTour(true);
  };

  // Vista de artículo individual
  if (currentArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{currentCategory?.name || currentArticle.category}</Badge>
            </div>
            <CardTitle className="text-2xl">{currentArticle.title}</CardTitle>
            <CardDescription>{currentArticle.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: currentArticle.content
                  .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-3">$1</h2>')
                  .replace(/^### (.+)$/gm, '<h3 class="text-base font-medium mt-4 mb-2">$1</h3>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                  .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4"><span class="font-medium">$1.</span> $2</li>')
                  .replace(/⚠️/g, '<span class="text-yellow-600">⚠️</span>')
                  .replace(/\n\n/g, '<br/><br/>')
              }}
            />
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Etiquetas: {currentArticle.tags.join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista de categoría
  if (currentCategory) {
    const CategoryIcon = iconMap[currentCategory.icon] || BookOpen;
    
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <CategoryIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{currentCategory.name}</h1>
            <p className="text-muted-foreground">{currentCategory.description}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {categoryArticles.map((article) => (
            <Card 
              key={article.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedArticle(article.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{article.title}</h3>
                  <p className="text-sm text-muted-foreground">{article.summary}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
          
          {categoryArticles.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay artículos en esta categoría todavía.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Vista principal
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Centro de ayuda</h1>
        <p className="text-muted-foreground">
          Encuentra respuestas y aprende a usar EasyQuote
        </p>
      </div>

      <Tabs defaultValue="help" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="help">Documentación</TabsTrigger>
          <TabsTrigger value="support">Soporte</TabsTrigger>
        </TabsList>

        <TabsContent value="help" className="space-y-6">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en la ayuda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Resultados de búsqueda */}
          {searchQuery && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Resultados para "{searchQuery}" ({searchResults.length})
              </h2>
              <div className="grid gap-3">
                {searchResults.map((article) => (
                  <Card 
                    key={article.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedCategory(article.category);
                      setSelectedArticle(article.id);
                      setSearchQuery('');
                    }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{article.title}</h3>
                        <p className="text-sm text-muted-foreground">{article.summary}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
                {searchResults.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No se encontraron resultados
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tour guiado */}
          {!searchQuery && (
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <PlayCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Tour guiado</h3>
                    <p className="text-sm text-muted-foreground">
                      Aprende los conceptos básicos con un recorrido interactivo
                    </p>
                  </div>
                </div>
                <Button onClick={handleStartTour}>
                  Iniciar tour
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Categorías */}
          {!searchQuery && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Categorías</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((category) => {
                  const Icon = iconMap[category.icon] || BookOpen;
                  const articleCount = getArticlesByCategory(category.id).length;
                  
                  return (
                    <Card 
                      key={category.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{category.name}</h3>
                            <Badge variant="secondary" className="shrink-0">
                              {articleCount}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <SupportRequestForm />
          <UserRequestsList />
        </TabsContent>
      </Tabs>

      {/* Info del rol */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Mostrando contenido para rol: <Badge variant="outline">{userRole}</Badge>
        </p>
      </div>
    </div>
  );
}
