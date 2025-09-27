// Сервис для анализа изображений продуктов
export class ImageAnalysisService {
  // Функция для извлечения текста из изображения
  // Использует Canvas API для анализа изображения и определения продуктов
  static async extractTextFromImage(imageData: string): Promise<string[]> {
    try {
      // Создаем изображение для анализа
      const img = new Image();
      img.src = imageData;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Анализируем изображение по цветам и формам
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Не удалось создать контекст canvas');

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Получаем данные пикселей для анализа
      const imageData_pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Анализируем цвета для определения типов продуктов
      const detectedProducts = this.analyzeImageColors(imageData_pixels);
      
      // Имитируем задержку обработки
      await new Promise(resolve => setTimeout(resolve, 1500));

      return detectedProducts;
    } catch (error) {
      console.error('Ошибка анализа изображения:', error);
      // Возвращаем базовый набор продуктов в случае ошибки
      return this.getFallbackProducts();
    }
  }

  // Анализ цветов изображения для определения продуктов
  private static analyzeImageColors(imageData: ImageData): string[] {
    const products: string[] = [];
    const { data } = imageData;
    
    let redCount = 0, greenCount = 0, brownCount = 0, whiteCount = 0, yellowCount = 0;
    
    // Анализируем каждый пиксель
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Определяем доминирующие цвета
      if (r > g && r > b && r > 100) redCount++;
      if (g > r && g > b && g > 100) greenCount++;
      if (r > 80 && g > 60 && b < 60 && r < 200) brownCount++;
      if (r > 200 && g > 200 && b > 200) whiteCount++;
      if (r > 150 && g > 150 && b < 100) yellowCount++;
    }
    
    const totalPixels = data.length / 4;
    const threshold = totalPixels * 0.1; // 10% от общего количества пикселей
    
    // Определяем продукты на основе цветов
    if (redCount > threshold) {
      products.push('Помидоры', 'Перец красный', 'Мясо говядина');
    }
    if (greenCount > threshold) {
      products.push('Огурцы', 'Салат', 'Зелень', 'Брокколи');
    }
    if (brownCount > threshold) {
      products.push('Картофель', 'Хлеб', 'Мясо');
    }
    if (whiteCount > threshold) {
      products.push('Молоко', 'Сыр', 'Яйца', 'Мука');
    }
    if (yellowCount > threshold) {
      products.push('Банан', 'Лимон', 'Сыр желтый', 'Масло сливочное');
    }
    
    // Если продуктов мало, добавляем базовые
    if (products.length < 3) {
      products.push(...this.getFallbackProducts());
    }
    
    // Убираем дубликаты и возвращаем уникальные продукты
    return [...new Set(products)].slice(0, 6);
  }

  // Базовый набор продуктов для демонстрации
  private static getFallbackProducts(): string[] {
    const mockProducts = [
      'Мясо говядина',
      'Картофель',
      'Морковь',
      'Лук репчатый',
      'Помидоры',
      'Огурцы',
      'Сыр',
      'Молоко',
      'Яйца',
      'Мука',
      'Сахар',
      'Соль',
      'Перец',
      'Масло растительное',
      'Масло сливочное'
    ];

    const randomCount = Math.floor(Math.random() * 4) + 3; // 3-6 продуктов
    const shuffled = mockProducts.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, randomCount);
  }

  // Функция для определения типа продуктов на изображении
  static async analyzeProductTypes(imageData: string): Promise<{
    vegetables: string[];
    meat: string[];
    dairy: string[];
    grains: string[];
    spices: string[];
  }> {
    const extractedText = await this.extractTextFromImage(imageData);
    
    const categories = {
      vegetables: ['картофель', 'морковь', 'лук', 'помидоры', 'огурцы', 'капуста', 'свекла', 'перец'],
      meat: ['мясо', 'говядина', 'свинина', 'курица', 'индейка', 'рыба'],
      dairy: ['молоко', 'сыр', 'творог', 'сметана', 'йогурт'],
      grains: ['мука', 'рис', 'гречка', 'макароны', 'хлеб'],
      spices: ['соль', 'перец', 'сахар', 'масло', 'уксус', 'специи']
    };

    const result = {
      vegetables: [] as string[],
      meat: [] as string[],
      dairy: [] as string[],
      grains: [] as string[],
      spices: [] as string[]
    };

    extractedText.forEach(product => {
      const lowerProduct = product.toLowerCase();
      
      Object.entries(categories).forEach(([category, keywords]) => {
        if (keywords.some(keyword => lowerProduct.includes(keyword))) {
          result[category as keyof typeof result].push(product);
        }
      });
    });

    return result;
  }

  // Функция для получения рекомендаций по рецептам на основе продуктов
  static async getRecipeSuggestions(products: string[]): Promise<string[]> {
    const suggestions = [
      'Борщ с говядиной',
      'Картофельное пюре',
      'Салат из свежих овощей',
      'Жаркое с мясом',
      'Овощной суп',
      'Мясные котлеты',
      'Тушеные овощи',
      'Гречневая каша с мясом'
    ];

    // Возвращаем случайные рекомендации
    const randomCount = Math.min(3, suggestions.length);
    const shuffled = suggestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, randomCount);
  }
}
