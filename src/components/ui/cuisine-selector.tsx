import React, { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { WORLD_CUISINES, CUISINE_CATEGORIES, getCuisinesByCategory } from '../../types/cuisine';
import { Search, Globe } from 'lucide-react';

interface CuisineSelectorProps {
  selectedCuisine?: string;
  onCuisineSelect: (cuisineId: string) => void;
  className?: string;
}

export const CuisineSelector: React.FC<CuisineSelectorProps> = ({
  selectedCuisine,
  onCuisineSelect,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CUISINE_CATEGORIES>('european');

  const filteredCuisines = WORLD_CUISINES.filter(cuisine =>
    cuisine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cuisine.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cuisine.popularDishes.some(dish => 
      dish.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const categoryCuisines = getCuisinesByCategory(selectedCategory);

  const selectedCuisineData = WORLD_CUISINES.find(c => c.id === selectedCuisine);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label className="text-base font-semibold">Выберите кухню</Label>
        <p className="text-sm text-muted-foreground">
          Выберите кухню мира для создания аутентичного рецепта
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск кухни или блюда..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected Cuisine Display */}
      {selectedCuisineData && (
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedCuisineData.flag}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{selectedCuisineData.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedCuisineData.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCuisineSelect('')}
              >
                Изменить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cuisine Selection */}
      {!selectedCuisineData && (
        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as keyof typeof CUISINE_CATEGORIES)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
            <TabsTrigger value="european" className="text-xs sm:text-sm">Европа</TabsTrigger>
            <TabsTrigger value="asian" className="text-xs sm:text-sm">Азия</TabsTrigger>
            <TabsTrigger value="american" className="text-xs sm:text-sm">Америка</TabsTrigger>
            <TabsTrigger value="middle_eastern" className="text-xs sm:text-sm">Ближний Восток</TabsTrigger>
            <TabsTrigger value="african" className="text-xs sm:text-sm">Африка</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {(searchQuery ? filteredCuisines : categoryCuisines).map((cuisine) => {
                const isHalal = cuisine.id.startsWith('halal-');
                return (
                <Card
                  key={cuisine.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${
                    selectedCuisine === cuisine.id
                      ? 'ring-2 ring-primary bg-primary/5'
                      : isHalal
                      ? 'hover:bg-green-50 border-green-200'
                      : 'hover:bg-accent/5'
                  }`}
                  onClick={() => onCuisineSelect(cuisine.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cuisine.flag}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{cuisine.name}</CardTitle>
                          {isHalal && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                              Халяль
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {cuisine.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Характеристики:</h4>
                        <div className="flex flex-wrap gap-1">
                          {cuisine.characteristics.slice(0, 3).map((char, index) => (
                            <Badge 
                              key={index} 
                              variant={isHalal && char.includes('Халяль') ? 'default' : 'secondary'} 
                              className={`text-xs ${isHalal && char.includes('Халяль') ? 'bg-green-100 text-green-800' : ''}`}
                            >
                              {char}
                            </Badge>
                          ))}
                          {cuisine.characteristics.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{cuisine.characteristics.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Популярные блюда:</h4>
                        <p className="text-xs text-muted-foreground">
                          {cuisine.popularDishes.slice(0, 2).join(', ')}
                          {cuisine.popularDishes.length > 2 && '...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            {searchQuery && filteredCuisines.length === 0 && (
              <Card className="text-center py-8">
                <CardContent>
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Кухня не найдена
                  </h3>
                  <p className="text-muted-foreground">
                    Попробуйте изменить поисковый запрос
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
