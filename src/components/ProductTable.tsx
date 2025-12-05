import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, TestTube, ShoppingCart, ExternalLink, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWooCommerceLink } from "@/hooks/useWooCommerceLink";
import { useWooCommerceIntegration } from "@/hooks/useWooCommerceIntegration";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface EasyQuoteProduct {
  id: string;
  productName: string;
  isActive: boolean;
  description?: string;
  excelfileId?: string;
}

interface ProductMapping {
  category_id?: string;
  subcategory_id?: string;
  product_categories?: {
    id: string;
    name: string;
    color: string;
  };
  product_subcategories?: {
    id: string;
    name: string;
  };
}

interface ProductTableProps {
  products: EasyQuoteProduct[];
  getProductMapping: (productId: string) => ProductMapping | undefined;
  onEditProduct: (product: EasyQuoteProduct) => void;
  onDuplicateProduct?: (product: EasyQuoteProduct) => void;
}

export function ProductTable({ products, getProductMapping, onEditProduct, onDuplicateProduct }: ProductTableProps) {
  const navigate = useNavigate();
  const { isWooCommerceActive, loading: wooIntegrationLoading } = useWooCommerceIntegration();
  const productIds = products.map((p) => p.id);
  const { data: wooLinks, isLoading: wooLoading } = useWooCommerceLink(isWooCommerceActive ? productIds : []);

  // Obtener archivos Excel de EasyQuote
  const { data: excelFiles = [] } = useQuery({
    queryKey: ["easyquote-excel-files"],
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) return [];

      const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return [];
      return response.json();
    },
  });

  // Crear un map de excelfileId -> fileName
  const excelFileMap = excelFiles.reduce((acc: Record<string, string>, file: any) => {
    acc[file.id] = file.fileName;
    return acc;
  }, {});

  const getExcelFileName = (excelfileId?: string) => {
    if (!excelfileId) return "Sin archivo";
    return excelFileMap[excelfileId] || "Archivo no encontrado";
  };

  console.log("ProductTable Debug:", {
    isWooCommerceActive,
    wooIntegrationLoading,
    productCount: products.length,
    wooLinksCount: Object.keys(wooLinks || {}).length,
  });

  return (
    <>
      {/* Vista Desktop - Tabla */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="w-[330px] py-2 text-xs font-semibold">Producto</TableHead>
                <TableHead className="w-[220px] py-2 text-xs font-semibold">Excel</TableHead>
                <TableHead className="w-[90px] py-2 text-xs font-semibold">Estado</TableHead>
                <TableHead className="w-[150px] py-2 text-xs font-semibold">Categoría</TableHead>
                {isWooCommerceActive && <TableHead className="w-[80px] py-2 text-xs font-semibold">Woo</TableHead>}
                <TableHead className="w-[140px] py-2 text-xs font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="h-auto">
                  <TableCell className="py-1.5 px-3 max-w-[330px]">
                    <div className="w-full">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(product.id);
                          toast({
                            title: "ID copiado",
                            description: `ID: ${product.id}`,
                          });
                        }}
                        className="text-sm font-medium text-left hover:text-primary transition-colors w-full break-words block"
                        title="Click para copiar ID"
                      >
                        {product.productName}
                      </button>
                      {product.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{product.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 max-w-[220px]">
                    <span className="font-mono text-xs text-muted-foreground break-words block">
                      {getExcelFileName(product.excelfileId)}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 px-3">
                    <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs px-2 py-0 h-5">
                      {product.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 px-3">
                    {(() => {
                      const mapping = getProductMapping(product.id);
                      if (mapping?.product_categories) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: mapping.product_categories.color }}
                            />
                            <span className="text-xs truncate max-w-[70px]">{mapping.product_categories.name}</span>
                            {mapping.product_subcategories && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                                {mapping.product_subcategories.name}
                              </Badge>
                            )}
                          </div>
                        );
                      }
                      return (
                        <Badge variant="outline" className="text-xs px-2 py-0 h-5">
                          Sin categoría
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  {isWooCommerceActive && (
                    <TableCell className="py-1.5 px-3">
                      {wooLoading ? (
                        <Skeleton className="h-4 w-4 rounded" />
                      ) : (
                        (() => {
                          const linkStatus = wooLinks?.[product.id];
                          if (linkStatus?.isLinked && linkStatus.count > 0) {
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                                    <ShoppingCart className="h-3.5 w-3.5 text-green-600" />
                                    <span className="text-xs text-green-600 font-medium">{linkStatus.count}</span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                  {wooLoading ? (
                                    <div className="space-y-2">
                                      <Skeleton className="h-4 w-48" />
                                      <Skeleton className="h-20 w-full" />
                                    </div>
                                  ) : linkStatus.wooProducts.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                      No se encontraron productos vinculados
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-sm">Productos en WooCommerce</h4>
                                      <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {linkStatus.wooProducts.map((wooProduct: any) => (
                                          <div key={wooProduct.id} className="p-2 border rounded-md space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                              <span className="text-sm font-medium line-clamp-2">
                                                {wooProduct.name}
                                              </span>
                                              {wooProduct.calculator_disabled && (
                                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                                  Deshabilitado
                                                </Badge>
                                              )}
                                            </div>
                                            <a
                                              href={wooProduct.permalink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-primary hover:underline flex items-center gap-1"
                                            >
                                              Ver producto <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          return <span className="text-xs text-muted-foreground">-</span>;
                        })()
                      )}
                    </TableCell>
                  )}
                  <TableCell className="py-1.5 px-3">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Usar window.location para evitar problemas de encoding con query params
                          window.location.href = `/admin/productos/test?productId=${product.id}`;
                        }}
                        title="Test"
                        className="h-7 w-7 p-0"
                      >
                        <TestTube className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        title="Editar"
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {onDuplicateProduct && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDuplicateProduct(product)}
                          title="Duplicar producto"
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Vista Mobile/Tablet - Cards */}
      <div className="lg:hidden space-y-4">
        {products.map((product) => (
          <Card key={product.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(product.id);
                      toast({
                        title: "ID copiado",
                        description: `ID: ${product.id}`,
                      });
                    }}
                    className="font-medium truncate text-left hover:text-primary transition-colors w-full"
                    title="Click para copiar ID"
                  >
                    {product.productName}
                  </button>
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                  )}
                </div>
                <Badge variant={product.isActive ? "default" : "secondary"} className="ml-2 text-xs">
                  {product.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Excel: </span>
                <span className="font-mono text-xs">
                  {getExcelFileName(product.excelfileId)}
                </span>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Categoría: </span>
                {(() => {
                  const mapping = getProductMapping(product.id);
                  if (mapping?.product_categories) {
                    return (
                      <div className="inline-flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: mapping.product_categories.color }}
                        />
                        <span className="text-xs">{mapping.product_categories.name}</span>
                        {mapping.product_subcategories && (
                          <Badge variant="secondary" className="text-xs">
                            {mapping.product_subcategories.name}
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return (
                    <Badge variant="outline" className="text-xs">
                      Sin categoría
                    </Badge>
                  );
                })()}
              </div>

              {isWooCommerceActive && (
                <div className="text-sm">
                  <span className="text-muted-foreground">WooCommerce: </span>
                  {wooLoading ? (
                    <Skeleton className="inline-block h-4 w-16" />
                  ) : (
                    (() => {
                      const linkStatus = wooLinks?.[product.id];
                      if (linkStatus?.isLinked && linkStatus.count > 0) {
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
                                <ShoppingCart className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">
                                  {linkStatus.count} producto(s)
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              {wooLoading ? (
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-48" />
                                  <Skeleton className="h-20 w-full" />
                                </div>
                              ) : linkStatus.wooProducts.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                  No se encontraron productos vinculados
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm">Productos en WooCommerce</h4>
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {linkStatus.wooProducts.map((wooProduct: any) => (
                                      <div key={wooProduct.id} className="p-2 border rounded-md space-y-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <span className="text-sm font-medium line-clamp-2">{wooProduct.name}</span>
                                          {wooProduct.calculator_disabled && (
                                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                                              Deshabilitado
                                            </Badge>
                                          )}
                                        </div>
                                        <a
                                          href={wooProduct.permalink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          Ver producto <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        );
                      }
                      return <span className="text-xs text-muted-foreground">No vinculado</span>;
                    })()
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onEditProduct(product)} className="flex-1 text-xs">
                  <Edit className="h-3 w-3 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/admin/productos/test?productId=${product.id}`;
                  }}
                  className="flex-1 text-xs"
                >
                  <TestTube className="h-3 w-3 mr-2" />
                  Probar
                </Button>
                {onDuplicateProduct && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDuplicateProduct(product)}
                    className="flex-1 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Duplicar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
