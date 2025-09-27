import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Search, Plus } from "lucide-react";
import { productCategories, searchProducts } from "@/data/products";

interface ProductSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsSelected: (products: string[]) => void;
  selectedProducts: string[];
}

export const ProductSelector = ({ 
  isOpen, 
  onClose, 
  onProductsSelected, 
  selectedProducts 
}: ProductSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelected, setTempSelected] = useState<string[]>(selectedProducts);

  if (!isOpen) return null;

  const toggleProduct = (product: string) => {
    if (tempSelected.includes(product)) {
      setTempSelected(tempSelected.filter(p => p !== product));
    } else {
      setTempSelected([...tempSelected, product]);
    }
  };

  const handleConfirm = () => {
    onProductsSelected(tempSelected);
    onClose();
  };

  const searchResults = searchQuery ? searchProducts(searchQuery) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-card border-border/50 shadow-glow">
        <CardHeader className="relative border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
          
          <CardTitle className="text-2xl font-bold text-foreground pr-12">
            Выберите продукты
          </CardTitle>
          <p className="text-muted-foreground">
            Найдите и добавьте продукты для создания рецепта
          </p>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск продуктов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Selected Products */}
          {tempSelected.length > 0 && (
            <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Выбрано продуктов: {tempSelected.length}
              </h4>
              <div className="flex flex-wrap gap-2">
                {tempSelected.map((product) => (
                  <Badge
                    key={product}
                    variant="secondary"
                    className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer"
                    onClick={() => toggleProduct(product)}
                  >
                    {product}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Результаты поиска ({searchResults.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {searchResults.map((product) => (
                  <Button
                    key={product}
                    variant={tempSelected.includes(product) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleProduct(product)}
                    className="justify-start text-left h-auto py-2"
                  >
                    {tempSelected.includes(product) ? (
                      <X className="w-3 h-3 mr-1" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    {product}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {!searchQuery && (
            <Tabs defaultValue={productCategories[0].name} className="w-full">
              <TabsList className="grid grid-cols-3 lg:grid-cols-5 mb-6">
                {productCategories.slice(0, 5).map((category) => (
                  <TabsTrigger 
                    key={category.name} 
                    value={category.name}
                    className="text-xs"
                  >
                    {category.emoji} {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {productCategories.map((category) => (
                <TabsContent key={category.name} value={category.name}>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <span className="text-2xl">{category.emoji}</span>
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {category.products.map((product) => (
                        <Button
                          key={product}
                          variant={tempSelected.includes(product) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleProduct(product)}
                          className="justify-start text-left h-auto py-2"
                        >
                          {tempSelected.includes(product) ? (
                            <X className="w-3 h-3 mr-1" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          {product}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}

              {/* Additional Categories */}
              <div className="mt-6 space-y-6">
                {productCategories.slice(5).map((category) => (
                  <div key={category.name} className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <span className="text-2xl">{category.emoji}</span>
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {category.products.map((product) => (
                        <Button
                          key={product}
                          variant={tempSelected.includes(product) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleProduct(product)}
                          className="justify-start text-left h-auto py-2"
                        >
                          {tempSelected.includes(product) ? (
                            <X className="w-3 h-3 mr-1" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          {product}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Tabs>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t border-border/50 p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleConfirm}
              disabled={tempSelected.length === 0}
              className="flex-1 bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              Добавить продукты ({tempSelected.length})
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Отмена
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};








