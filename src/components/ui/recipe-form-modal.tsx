import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Upload } from 'lucide-react';
import { RecipeFormData } from '@/types/recipe';
import { toast } from '@/hooks/use-toast';

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RecipeFormData) => void;
  initialData?: Partial<RecipeFormData>;
  title: string;
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title
}) => {
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '',
    description: '',
    image: '',
    cookTime: '',
    servings: 4,
    difficulty: 'Medium',
    category: '',
    ingredients: [''],
    instructions: [''],
    tips: ''
  });

  const [newIngredient, setNewIngredient] = useState('');
  const [newInstruction, setNewInstruction] = useState('');

  const categories = [
    'Итальянская кухня',
    'Десерты',
    'Завтраки',
    'Обеды',
    'Ужины',
    'Закуски',
    'Напитки',
    'Вегетарианское',
    'Безглютеновое',
    'Низкокалорийное'
  ];

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название рецепта',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите описание рецепта',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: 'Ошибка',
        description: 'Выберите категорию рецепта',
        variant: 'destructive'
      });
      return;
    }

    const filteredIngredients = formData.ingredients.filter(ing => ing.trim());
    const filteredInstructions = formData.instructions.filter(inst => inst.trim());

    if (filteredIngredients.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Добавьте хотя бы один ингредиент',
        variant: 'destructive'
      });
      return;
    }

    if (filteredInstructions.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Добавьте хотя бы одну инструкцию',
        variant: 'destructive'
      });
      return;
    }

    onSubmit({
      ...formData,
      ingredients: filteredIngredients,
      instructions: filteredInstructions
    });
  };

  const addIngredient = () => {
    if (newIngredient.trim()) {
      setFormData(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, newIngredient.trim()]
      }));
      setNewIngredient('');
    }
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setFormData(prev => ({
        ...prev,
        instructions: [...prev.instructions, newInstruction.trim()]
      }));
      setNewInstruction('');
    }
  };

  const removeInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название рецепта *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Введите название рецепта"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Опишите ваше блюдо"
              rows={3}
              required
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Фото блюда</Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                Загрузить фото
              </label>
              {formData.image && (
                <div className="relative">
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Recipe Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cookTime">Время приготовления</Label>
              <Input
                id="cookTime"
                value={formData.cookTime}
                onChange={(e) => setFormData(prev => ({ ...prev, cookTime: e.target.value }))}
                placeholder="30 мин"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servings">Количество порций</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={formData.servings}
                onChange={(e) => setFormData(prev => ({ ...prev, servings: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Сложность</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value: 'Easy' | 'Medium' | 'Hard') => setFormData(prev => ({ ...prev, difficulty: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Легко</SelectItem>
                  <SelectItem value="Medium">Средне</SelectItem>
                  <SelectItem value="Hard">Сложно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <Label>Ингредиенты *</Label>
            <div className="space-y-2">
              {formData.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={ingredient}
                    onChange={(e) => {
                      const newIngredients = [...formData.ingredients];
                      newIngredients[index] = e.target.value;
                      setFormData(prev => ({ ...prev, ingredients: newIngredients }));
                    }}
                    placeholder="Введите ингредиент с количеством"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <div className="flex items-center gap-2">
                <Input
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  placeholder="Добавить ингредиент"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                />
                <Button type="button" onClick={addIngredient} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <Label>Инструкции приготовления *</Label>
            <div className="space-y-2">
              {formData.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-2 shrink-0">
                    {index + 1}
                  </Badge>
                  <Textarea
                    value={instruction}
                    onChange={(e) => {
                      const newInstructions = [...formData.instructions];
                      newInstructions[index] = e.target.value;
                      setFormData(prev => ({ ...prev, instructions: newInstructions }));
                    }}
                    placeholder="Опишите шаг приготовления"
                    rows={2}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInstruction(index)}
                    className="text-red-500 hover:text-red-600 mt-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="mt-2 shrink-0">
                  {formData.instructions.length + 1}
                </Badge>
                <Textarea
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  placeholder="Добавить шаг приготовления"
                  rows={2}
                />
                <Button type="button" onClick={addInstruction} size="icon" className="mt-2">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-2">
            <Label htmlFor="tips">Советы от автора</Label>
            <Textarea
              id="tips"
              value={formData.tips}
              onChange={(e) => setFormData(prev => ({ ...prev, tips: e.target.value }))}
              placeholder="Поделитесь полезными советами"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Сохранить рецепт
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
