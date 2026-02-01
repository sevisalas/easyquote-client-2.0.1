import { useMemo } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  UserRole,
  HelpArticle,
  HelpCategory,
  getArticlesForRole,
  getCategoriesForRole,
  searchArticles,
} from '@/data/helpArticles';

export function useHelpAccess() {
  const { isSuperAdmin, isOrgAdmin, membership } = useSubscription();

  // Determinar el rol efectivo del usuario
  const userRole: UserRole = useMemo(() => {
    if (isSuperAdmin) return 'superadmin';
    if (isOrgAdmin) return 'admin';
    
    const memberRole = membership?.role;
    if (memberRole === 'operador') return 'operador';
    if (memberRole === 'comercial') return 'comercial';
    
    return 'user';
  }, [isSuperAdmin, isOrgAdmin, membership?.role]);

  // Artículos filtrados por rol
  const articles = useMemo(() => getArticlesForRole(userRole), [userRole]);

  // Categorías filtradas por rol
  const categories = useMemo(() => getCategoriesForRole(userRole), [userRole]);

  // Función para buscar artículos
  const search = (query: string): HelpArticle[] => {
    if (!query.trim()) return articles;
    return searchArticles(articles, query);
  };

  // Obtener artículos por categoría
  const getArticlesByCategory = (categoryId: string): HelpArticle[] => {
    return articles.filter((article) => article.category === categoryId);
  };

  // Obtener un artículo por ID
  const getArticleById = (articleId: string): HelpArticle | undefined => {
    return articles.find((article) => article.id === articleId);
  };

  return {
    userRole,
    articles,
    categories,
    search,
    getArticlesByCategory,
    getArticleById,
  };
}
