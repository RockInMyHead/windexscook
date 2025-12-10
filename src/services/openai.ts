import { UserHealthProfile } from '../types/health';
import { WORLD_CUISINES } from '../types/cuisine';
import { AudioUtils } from '../lib/audio-utils';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
// Guard to ensure API key is provided
if (!OPENAI_API_KEY) {
  console.warn("OpenAI API key not found in environment variables. API calls will be proxied through server.");
}

export class OpenAIError extends Error {
  constructor(message: string = 'OpenAI API error', public status?: number, public code?: string) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export interface Recipe {
  id?: string;
  title: string;
  description: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  cuisine?: string;
  ingredients: string[];
  instructions: string[];
  tips?: string;
  content?: string; // Для чата
  image?: string; // URL основного изображения рецепта
  createdAt?: Date;
  healthInfo?: any;
}


export class OpenAIService {
  // Функция сжатия изображения
  private static async compressImage(file: File, quality: number = 0.7, maxWidth: number = 1024): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Вычисляем новые размеры
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Рисуем сжатое изображение
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в Blob
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback к оригинальному файлу
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  static async makeRequest(messages: any[], model: string = 'gpt-4-turbo', options?: { signal?: AbortSignal; temperature?: number; response_format?: any; max_completion_tokens?: number }) {
    let response;
    try {
      // Always use relative URLs to avoid mixed content issues
      // The server/nginx will proxy these to the correct backend
      const requestUrl = '/api/openai/v1/chat/completions';

      const requestBody: any = {
        model,
        messages,
        temperature: options?.temperature ?? 0.8,
        max_completion_tokens: options?.max_completion_tokens ?? 3000, // Уменьшаем для избежания таймаутов
      };

      // Добавляем response_format если указан
      if (options?.response_format) {
        requestBody.response_format = options.response_format;
      }

      // Создаем AbortController для таймаута (12 минут, меньше чем на сервере для буфера)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12 * 60 * 1000); // 12 минут

      // Объединяем сигналы если есть внешний
      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          controller.abort();
          clearTimeout(timeoutId);
        });
      }

      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (networkError) {
      console.error('Network error calling OpenAI:', networkError);
      throw new Error('Не удалось подключиться к серверу генерации рецептов. Проверьте соединение.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error Details:', errorText);

      // Пытаемся распарсить JSON ошибку
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && (errorData.error.code === 'regional_restriction' || errorData.error.code === 'unsupported_country_region_territory')) {
          throw new Error('AI функции временно недоступны в вашем регионе. Мы работаем над решением этой проблемы.');
        }
        if (errorData.error && errorData.error.message) {
          throw new Error(errorData.error.message);
        }
      } catch (parseError) {
        // Если не удалось распарсить JSON, проверяем, содержит ли текст ошибку на русском
        if (errorText.includes('Не удалось') || errorText.includes('ошибка') || errorText.includes('Ошибка')) {
          throw new Error(errorText);
        }
        // Если это не русский текст, используем стандартную ошибку
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    try {
      return data.choices[0].message.content;
    } catch (parseError) {
      console.error('Error parsing JSON from OpenAI response:', parseError);
      throw new Error('Получен неверный ответ от OpenAI. Попробуйте позже.');
    }
  }

  private static async generateImage(prompt: string): Promise<string> {
    try {
      console.log('🎨 [DALL-E] Starting image generation...');
      console.log('🎨 [DALL-E] Prompt:', prompt.substring(0, 100) + '...');

      const requestUrl = '/api/openai/generate-image';
      console.log('🎨 [DALL-E] Request URL:', requestUrl);

      const requestBody = {
        model: 'dall-e-3',
        prompt: prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
      };
      console.log('🎨 [DALL-E] Request body prepared');

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🎨 [DALL-E] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DALL-E API Error Details:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            throw new Error(errorData.error.message);
          }
        } catch (parseError) {
          throw new Error(`DALL-E API error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('🎨 [DALL-E] Response data received');

      if (data.data && data.data[0] && data.data[0].url) {
        console.log('✅ [DALL-E] Image generated successfully!');
        console.log('✅ [DALL-E] Image URL:', data.data[0].url.substring(0, 50) + '...');
        return data.data[0].url;
      } else if (data.imageUrl) {
        // Fallback for our API format
        console.log('✅ [DALL-E] Image generated successfully (fallback)!');
        console.log('✅ [DALL-E] Image URL:', data.imageUrl.substring(0, 50) + '...');
        return data.imageUrl;
      } else {
        console.error('❌ [DALL-E] No image URL in response:', data);
        throw new Error('No image URL received from DALL-E');
      }
    } catch (error) {
      console.error('Error generating image with DALL-E:', error);
      throw error;
    }
  }

  private static async makeRequestWithUsage(messages: any[], model: string = 'gpt-4-turbo', options?: { max_completion_tokens?: number; temperature?: number }): Promise<{content: string, usage: any}> {
    let response;
    try {
      // Always use relative URLs to avoid mixed content issues
      // The server/nginx will proxy these to the correct backend
      const requestUrl = '/api/openai/v1/chat/completions';
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.8,
          max_completion_tokens: options?.max_completion_tokens ?? 4000,
        }),
      });
    } catch (networkError) {
      console.error('Network error calling OpenAI:', networkError);
      throw new Error('Не удалось подключиться к серверу генерации рецептов. Проверьте соединение.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error Details:', errorText);

      // Пытаемся распарсить JSON ошибку
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && (errorData.error.code === 'regional_restriction' || errorData.error.code === 'unsupported_country_region_territory')) {
          throw new Error('AI функции временно недоступны в вашем регионе. Мы работаем над решением этой проблемы.');
        }
        if (errorData.error && errorData.error.message) {
          throw new Error(errorData.error.message);
        }
      } catch (parseError) {
        // Если не удалось распарсить JSON, проверяем, содержит ли текст ошибку на русском
        if (errorText.includes('Не удалось') || errorText.includes('ошибка') || errorText.includes('Ошибка')) {
          throw new Error(errorText);
        }
        // Если это не русский текст, используем стандартную ошибку
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    try {
      return {
        content: data.choices[0].message.content,
        usage: data.usage
      };
    } catch (parseError) {
      console.error('Error parsing JSON from OpenAI response:', parseError);
      throw new Error('Получен неверный ответ от OpenAI. Попробуйте позже.');
    }
  }

  static async makeStreamingRequest(messages: any[], model: string = 'gpt-4-turbo', onChunk?: (chunk: string) => void): Promise<{content: string, usage: any}> {
    const requestUrl = '/api/chat';
    console.log('🚀 [Client] Starting streaming request to:', requestUrl);

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model,
          stream: true,
        }),
      });
    } catch (networkError) {
      console.error('❌ [Client] Network error calling OpenAI:', networkError);
      throw new Error('Не удалось подключиться к серверу генерации рецептов. Проверьте соединение.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error Details:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    console.log('✅ [Client] Streaming request successful, response status:', response.status);

    const ct = response.headers.get('content-type') || '';
    const isPlain = ct.includes('text/plain');
    console.log('📝 [Client] Content-Type:', ct, '| isPlain:', isPlain);

    return new Promise((resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('❌ [OpenAI] Unable to read response stream - no reader');
        reject(new Error('Unable to read response stream'));
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let usage: any = null;

      // Режим чистого текста (сервер уже развернул SSE)
      const readPlain = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true }); // БЕЗ trim()
            fullContent += chunk;
            console.log('📥 [Client Plain] Received chunk:', JSON.stringify(chunk));
            onChunk?.(chunk); // стримим в UI как есть, с \n
          }

          console.log('✅ [Client] Stream completed. Total content length:', fullContent.length);
          resolve({ content: fullContent, usage });
        } catch (e) {
          console.error('❌ [Client] Stream read error (plain):', e);
          reject(e);
        }
      };

      // Режим SSE (для совместимости, если вдруг вернет SSE)
      const readSSE = async () => {
        try {
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true }); // БЕЗ trim()

            const lines = buf.split('\n');
            // оставляем хвост недорезанным
            buf = lines.pop() ?? '';

            for (const line of lines) {
              if (!line || line.startsWith(':')) continue;
              if (!line.startsWith('data:')) continue;

              const payload = line.slice(5).trimStart();
              if (payload === '[DONE]') continue;

              try {
                const evt = JSON.parse(payload);
                const delta = evt?.choices?.[0]?.delta;
                const content = delta?.content;

                if (content) {
                  console.log('📥 [Client SSE] Received content chunk:', JSON.stringify(content));
                  fullContent += content;
                  onChunk?.(content);
                }

                if (evt?.usage) usage = evt.usage;
              } catch (_) {
                // пропускаем полукорявые куски
              }
            }
          }

          console.log('✅ [Client] Stream completed. Total content length:', fullContent.length);
          resolve({ content: fullContent, usage });
        } catch (e) {
          console.error('❌ [Client] Stream read error (SSE):', e);
          reject(e);
        }
      };

      // Выбираем режим чтения
      if (isPlain) {
        console.log('🔄 [Client] Using plain text mode');
        readPlain();
      } else {
        console.log('🔄 [Client] Using SSE mode');
        readSSE();
      }
    });
  }

  static async generateRecipe(ingredients: string[], healthProfile?: UserHealthProfile, cuisineId?: string, isChatMode: boolean = false, includeImages: boolean = false): Promise<Recipe> {
    let healthConstraints = '';
    let cuisineConstraints = '';
    
    if (healthProfile) {
      const constraints = [];
      
      // Добавляем ограничения по состояниям здоровья
      if (healthProfile.conditions.length > 0) {
        constraints.push(`Состояния здоровья: ${healthProfile.conditions.map(c => c.name).join(', ')}`);
        healthProfile.conditions.forEach(condition => {
          constraints.push(`Ограничения при ${condition.name}: ${condition.restrictions.join(', ')}`);
          constraints.push(`Рекомендации при ${condition.name}: ${condition.recommendations.join(', ')}`);
        });
      }
      
      // Добавляем диетические ограничения
      if (healthProfile.dietaryRestrictions.length > 0) {
        constraints.push(`Диетические предпочтения: ${healthProfile.dietaryRestrictions.join(', ')}`);
      }
      
      // Добавляем аллергии
      if (healthProfile.allergies.length > 0) {
        constraints.push(`Аллергии и непереносимости: ${healthProfile.allergies.join(', ')}`);
      }
      
      // Добавляем дополнительные заметки
      if (healthProfile.notes) {
        constraints.push(`Дополнительные требования: ${healthProfile.notes}`);
      }
      
      if (constraints.length > 0) {
        healthConstraints = `

ВАЖНО! Учитывай следующие особенности здоровья пользователя:
${constraints.join('\n')}

Рецепт должен быть адаптирован под эти требования. Избегай запрещенных продуктов и используй рекомендуемые ингредиенты.`;
      }
    }

    if (cuisineId) {
      const cuisine = WORLD_CUISINES.find(c => c.id === cuisineId);
      if (cuisine) {
        const isHalal = cuisine.id.startsWith('halal-');
        const halalNote = isHalal ? `

ХАЛЯЛЬ ТРЕБОВАНИЯ:
- Используй только халяльное мясо (курица, говядина, баранина)
- Исключи свинину и все продукты из свинины
- Не используй алкоголь в любом виде
- Убедись, что все ингредиенты халяльные
- Избегай желатина животного происхождения (кроме халяльного)` : '';

        cuisineConstraints = `

КУХНЯ: ${cuisine.name} ${cuisine.flag}
Описание: ${cuisine.description}
Характеристики: ${cuisine.characteristics.join(', ')}
Популярные блюда: ${cuisine.popularDishes.join(', ')}${halalNote}

ВАЖНО! Создай аутентичный рецепт в стиле ${cuisine.name} кухни. Используй традиционные ингредиенты, техники приготовления и вкусовые сочетания, характерные для этой кухни.`;
      }
    }

    const prompt = isChatMode
      ? `Ты AI кулинар-консультант. Пользователь сказал: "${ingredients.join(', ')}".

Отвечай как опытная шеф-повар, давая полезные советы по кулинарии. Если это ингредиенты - предложи рецепт. Если это вопрос - дай развернутый ответ. Будь дружелюбной и профессиональной.

Отвечай на русском языке в женском роде (например: "Я приготовлю", "Я рекомендую", "Я подскажу"). Все цифры пиши словами (например: 'двадцать минут', 'триста грамм', 'пять штук'), а не цифрами.`
      : `АБСОЛЮТНО ОБЯЗАТЕЛЬНО: Создай рецепт ИСКЛЮЧИТЕЛЬНО из этих ингредиентов: ${ingredients.join(', ')}${healthConstraints}${cuisineConstraints}

ЗАПРЕЩЕНО добавлять новые ингредиенты! НЕЛЬЗЯ генерировать рецепты с другими продуктами!

ВАЖНО: Отвечай ТОЛЬКО в формате JSON. Структура ответа:
{
  "title": "Название блюда",
  "description": "Краткое описание блюда",
  "cookTime": "Время приготовления",
  "servings": число,
  "difficulty": "Easy|Medium|Hard",
  "ingredients": ["ингредиент – количество – особенности"],
  "instructions": ["очень подробные пошаговые инструкции"],
  "tips": "Советы шеф-повара"
}

КРИТИЧНЫЕ ТРЕБОВАНИЯ:
- 🚫 НЕЛЬЗЯ использовать томаты, макароны, пасту или любые другие ингредиенты, которых НЕТ в списке выше
- ✅ ТОЛЬКО указанные ингредиенты + базовые специи (соль, перец, растительное масло, оливковое масло)
- Укажи точные количества для каждого ингредиента в списке ингредиентов
- Если получил мясо - создай рецепт из мяса, НЕ овощей или паста
- НИКОГДА не генерируй вегетарианский рецепт если было мясо

ПОДРОБНЫЕ ИНСТРУКЦИИ (ОЧЕНЬ ВАЖНО):
- Создай МАКСИМАЛЬНО ПОДРОБНЫЕ пошаговые инструкции - каждый шаг должен объяснять процесс от начала до конца
- Каждый шаг должен быть отдельным элементом массива
- НЕ добавляй номера шагов в текст инструкций - они будут добавлены автоматически
- НЕ добавляй мета-информацию типа "Оборудование:", "Время:", "Важно:" в начало строк
- Каждый шаг должен включать:
  * Какое оборудование использовать (кастрюля, сковорода, нож, разделочная доска и т.д.)
  * Точное время выполнения шага
  * Уровень огня/температуры (слабый, средний, сильный огонь, или °C)
  * Детальное описание техники выполнения (как резать, мешать, жарить)
  * Что делать с продуктами на каждом этапе
  * Признаки готовности (запах, цвет, консистенция)
- Разбей сложные действия на несколько мелких шагов
- Объясняй каждое действие так, будто учишь человека, который никогда не готовил
- Укажи точные размеры нарезки (ломтики 1 см, кубики 2x2 см и т.д.)
- Укажи точное время нагрева, приготовления, отдыха продуктов
- Объясни, почему важно выполнять шаг именно так

Практические советы:
- Сделай рецепт понятным для любого уровня подготовки
- Учитывай безопасность на кухне
- Добавь советы по исправлению возможных ошибок
`;

    try {
      const messages = isChatMode 
        ? [
            {
              role: "system",
              content: "Ты - дружелюбная AI кулинар-консультант. Отвечай на русском языке простым и понятным текстом в женском роде (например: 'Я приготовлю', 'Я рекомендую', 'Я подскажу'). НЕ используй JSON формат. Отвечай как живой человек-повар. ВАЖНО: Все цифры пиши словами (например: 'двадцать минут', 'триста грамм', 'пять штук'), а не цифрами (2, 300, 5)."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        : [
            {
              role: "system",
              content: "Ты - профессиональная шеф-повар. Создавай рецепты ТОЛЬКО из указанных ингредиентов + базовые специи. ОТВЕЧАЙ СТРОГО В ФОРМАТЕ JSON. НЕ добавляй никакого текста кроме JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ];

      // Запускаем звук обработки во время генерации рецепта
      AudioUtils.startProcessingSound();

      const response = await this.makeRequest(messages);

      // Обработка ответа в зависимости от режима
      if (isChatMode) {
        // В режиме чата возвращаем простой ответ
        let cleanResponse = response;
        
        // Очищаем ответ от возможных JSON-фрагментов
        if (cleanResponse.includes('```json')) {
          console.log('🧹 [OpenAI] Очищаем ответ от JSON-фрагментов');
          cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          
          // Пытаемся извлечь только текстовую часть
          try {
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[0]);
              if (jsonData.error) {
                cleanResponse = jsonData.error;
              } else if (jsonData.message) {
                cleanResponse = jsonData.message;
              } else if (jsonData.content) {
                cleanResponse = jsonData.content;
              }
            }
          } catch (e) {
            // Если не удалось распарсить JSON, используем очищенный текст
            console.log('ℹ️ [OpenAI] Не удалось распарсить JSON, используем очищенный текст');
          }
        }
        
        // Дополнительная обработка: заменяем цифры на слова для лучшего TTS
        cleanResponse = this.replaceNumbersWithWords(cleanResponse);
        
        console.log('📝 [OpenAI] Очищенный ответ для TTS:', cleanResponse);
        
        return {
          title: "AI Повар",
          description: cleanResponse,
          content: cleanResponse,
          cookTime: "",
          servings: 0,
          difficulty: "Easy" as const,
          ingredients: [],
          instructions: [],
          tips: ""
        };
      }

      // Парсим JSON ответ для режима рецепта
      let recipeData;
      try {
        // Очищаем ответ от возможного лишнего текста
        let cleanResponse = response.trim();

        // Найдем границы JSON по первым '{' и последним '}'
        const startIdx = cleanResponse.indexOf('{');
        const endIdx = cleanResponse.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleanResponse = cleanResponse.substring(startIdx, endIdx + 1);
        } else {
          throw new Error('Invalid JSON format received from AI');
        }

        // Парсим JSON
        recipeData = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Failed to parse recipe JSON:', response);
        console.error('Parse error:', parseError);
        throw new Error('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
      }
      
      // Валидируем и форматируем данные
      const validatedIngredients = recipeData.ingredients || ingredients;
      
      // Проверяем, что рецепт использует только предоставленные ингредиенты
      const basicSpices = ['соль', 'перец', 'масло', 'растительное масло', 'оливковое масло', 'подсолнечное масло'];
      const forbiddenIngredients = ['томат', 'макарон', 'паста', 'паста', 'спагетти', 'пеннне', 'фузилли'];
      const allowedIngredients = [...ingredients, ...basicSpices];
      
      // Проверяем, что в рецепте нет запрещённых ингредиентов
      const hasForbiddenIngredient = validatedIngredients.some(ingredient => {
        const ingredientName = ingredient.toLowerCase();
        return forbiddenIngredients.some(forbidden => ingredientName.includes(forbidden));
      });

      // Проверяем, что рецепт соответствует указанным ингредиентам
      const filteredIngredients = validatedIngredients.filter(ingredient => {
        const ingredientName = ingredient.toLowerCase().split(' - ')[0].trim();
        const isAllowed = allowedIngredients.some(allowed => 
          ingredientName.includes(allowed.toLowerCase()) || 
          allowed.toLowerCase().includes(ingredientName)
        );
        
        if (!isAllowed) {
          console.warn(`⚠️ [OpenAI] Исключен ингредиент не из списка: ${ingredientName}`);
        }
        
        return isAllowed;
      });

      // Если рецепт содержит запрещённые ингредиенты или мало совпадений с указанными - показываем ошибку
      if (hasForbiddenIngredient || (filteredIngredients.length < ingredients.length * 0.5)) {
        console.error('❌ [OpenAI] Рецепт не соответствует указанным ингредиентам!');
        console.error('📋 Указанные ингредиенты:', ingredients);
        console.error('📋 Ингредиенты в рецепте:', validatedIngredients);
        throw new Error('Рецепт не соответствует указанным ингредиентам. Попробуйте еще раз.');
      }

      const recipe: Recipe = {
        title: recipeData.title || "Вкусное блюдо",
        description: recipeData.description || "Ароматное и аппетитное блюдо",
        cookTime: recipeData.cookTime || "30 мин",
        servings: recipeData.servings || 4,
        difficulty: recipeData.difficulty || "Medium",
        cuisine: recipeData.cuisine || cuisineId || undefined,
        ingredients: filteredIngredients.length > 0 ? filteredIngredients : ingredients,
        instructions: recipeData.instructions || ["Приготовьте блюдо по традиционному рецепту"],
        tips: recipeData.tips || "Подавайте горячим!"
      };

      // Генерируем основное изображение рецепта если includeImages = true
      console.log('🎨 [Recipe] includeImages:', includeImages);
      console.log('🎨 [Recipe] recipe.title:', recipe.title);
      console.log('🎨 [Recipe] recipe.description:', recipe.description);

      if (includeImages && recipe.title && recipe.description) {
        console.log('🎨 [Recipe] Starting image generation process...');
        try {
          const imagePrompt = `Photorealistic food photography: ${recipe.title}. ${recipe.description}. Professional culinary photography, beautiful presentation, appetizing appearance, high quality, detailed textures, no text or labels, restaurant quality plating.`;
          console.log('🎨 [Recipe] Image prompt created:', imagePrompt.substring(0, 50) + '...');

          try {
            console.log('🎨 [Recipe] Calling generateImage...');
            const imageUrl = await this.generateImage(imagePrompt);
            console.log('🎨 [Recipe] Image URL received:', imageUrl ? 'YES' : 'NO');
            recipe.image = imageUrl;
            console.log('✅ [Recipe] Main recipe image generated successfully');
          } catch (imageError) {
            console.error('❌ [Recipe] Failed to generate recipe image:', imageError);
            console.error('❌ [Recipe] Error details:', imageError.message);
            // Продолжаем без изображения
          }
        } catch (error) {
          console.error('❌ [Recipe] Failed to generate recipe image (outer catch):', error);
          // Продолжаем без изображения
        }
      } else {
        console.log('🎨 [Recipe] Image generation skipped - condition not met');
      }

      // Останавливаем звук обработки
      AudioUtils.stopProcessingSound();
      return recipe;
    } catch (error) {
      console.error('Error generating recipe:', error);
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      throw new Error('Не удалось сгенерировать рецепт. Попробуйте еще раз.');
    }
  }

  static async generateRecipeVariations(ingredients: string[], healthProfile?: UserHealthProfile, cuisineId?: string): Promise<Recipe[]> {
    const variations = [];
    
    for (let i = 0; i < 3; i++) {
      try {
        const recipe = await this.generateRecipe(ingredients, healthProfile, cuisineId);
        variations.push(recipe);
      } catch (error) {
        console.error(`Error generating variation ${i + 1}:`, error);
      }
    }
    
    return variations;
  }


  static async recognizeIngredientsFromImage(imageFile: File): Promise<string[]> {
    try {
      // Проверяем размер файла (максимум 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Размер изображения слишком большой. Пожалуйста, выберите файл меньше 10MB.');
      }
      
      // Сжимаем изображение перед отправкой
      const compressedImage = await this.compressImage(imageFile, 0.7, 1024);
      
      // Конвертируем файл в base64
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Убираем data:image/jpeg;base64,
        };
        reader.readAsDataURL(compressedImage);
      });

      // Запускаем звук обработки во время анализа изображения
      AudioUtils.startProcessingSound();

      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - эксперт по распознаванию продуктов питания. Анализируй изображения и определяй все видимые продукты, ингредиенты и еду. Отвечай только списком продуктов на русском языке, разделенных запятыми."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Какие продукты питания ты видишь на этом изображении? Перечисли все продукты, которые можно использовать для приготовления еды. Отвечай только названиями продуктов через запятую."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ], 'gpt-4-turbo');

      // Парсим ответ и извлекаем продукты
      const ingredients = response
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);

      // Останавливаем звук обработки
      AudioUtils.stopProcessingSound();

      return ingredients;
    } catch (error) {
      console.error('Error recognizing ingredients from image:', error);
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      throw new Error('Не удалось распознать продукты на изображении');
    }
  }

  static async analyzeCaloriesFromImage(imageFile: File): Promise<string> {
    try {
      // Проверяем размер файла (максимум 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Размер изображения слишком большой. Пожалуйста, выберите файл меньше 10MB.');
      }
      
      // Сжимаем изображение перед отправкой
      const compressedImage = await this.compressImage(imageFile, 0.7, 1024);
      
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(compressedImage);
      });

      // Запускаем звук обработки во время анализа изображения
      AudioUtils.startProcessingSound();

      const response = await this.makeRequest([
        {
          role: "system",
          content: "Ты - эксперт по подсчету калорий в блюдах. Анализируй изображение блюда и выдавай подробный отчет о калорийности: Общая калорийность, содержание белков, жиров, углеводов, размер порции. Отвечай на русском языке."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Пожалуйста, проанализируй это изображение блюда и дай подробный отчет о калорийности." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ], 'gpt-4-turbo');

      // Останавливаем звук обработки
      AudioUtils.stopProcessingSound();

      return response;
    } catch (error) {
      console.error('Error analyzing calories from image:', error);
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      throw new Error('Не удалось проанализировать калорийность на изображении');
    }
  }

  static async chatWithChef(
    message: string,
    healthProfile?: UserHealthProfile,
    messageHistory?: Array<{role: 'user' | 'assistant', content: string}>,
    voiceMode: boolean = false
  ): Promise<{content: string, usage: any}> {
    // Используем обычный запрос (не стриминг) для fallback
    return this.chatWithChefRegular(message, healthProfile, messageHistory, voiceMode);
  }

  static async chatWithChefRegular(
    message: string,
    healthProfile?: UserHealthProfile,
    messageHistory?: Array<{role: 'user' | 'assistant', content: string}>,
    voiceMode: boolean = false // Новый параметр для голосового режима
  ): Promise<{content: string, usage: any}> {
    console.log('🔍 DEBUG: chatWithChefRegular called with message:', JSON.stringify(message));
    console.log('🔍 DEBUG: messageHistory length:', messageHistory?.length || 0);

    // Проверяем, является ли сообщение простым приветствием (только если нет истории)
    if (!messageHistory || messageHistory.length === 0) {
      try {
        const greetingPatterns = [
          /^привет$/i,
          /^здравствуй$/i,
          /^здравствуйте$/i,
          /^hi$/i,
          /^hello$/i,
          /^добро пожаловать$/i,
          /^добро пожаловать!$/i,
          /^привет!$/i,
          /^здравствуй!$/i,
          /^здравствуйте!$/i
        ];

        const trimmedMessage = message?.trim() || '';
        console.log('🔍 DEBUG: trimmed message:', JSON.stringify(trimmedMessage));
        
        const isGreeting = greetingPatterns.some(pattern => {
          try {
            const matches = pattern.test(trimmedMessage);
            console.log('🔍 DEBUG: pattern', pattern, 'matches:', matches);
            return matches;
          } catch (regexError) {
            console.warn('⚠️ [OpenAI] Ошибка в регулярном выражении:', regexError);
            return false;
          }
        });
        
        console.log('🔍 DEBUG: isGreeting:', isGreeting);
        
        if (isGreeting) {
          // Отвечаем на приветствия коротким сообщением
          console.log('🔍 DEBUG: Returning greeting response');
          return {
            content: 'Здравствуйте! Готова помочь с кулинарными вопросами. Что хотите приготовить?',
            usage: null
          };
        }
      } catch (greetingError) {
        console.warn('⚠️ [OpenAI] Ошибка при проверке приветствия:', greetingError);
        // Продолжаем с обычным чатом
      }
    }

    // Для голосового режима используем более короткий промпт
    const prompt = voiceMode 
      ? `Ты - Windexs, профессиональный шеф-повар. Отвечай КРАТКО (2-4 предложения максимум). Давай практические советы без лишних деталей. Помни контекст предыдущих сообщений. Отвечай на русском в женском роде. Цифры пиши словами.`
      : `Ты - профессиональная Windexs кулинар с 20-летним опытом работы на кухне, рейтинг Top-1, знаешь все тонкости продуктов и техник.

Требования для описания рецепта:
1. Составь карту производства еды — разбей весь процесс на отдельные этапы (подготовка, варка, обжарка, сборка, подача).
2. Для каждого этапа укажи:
   - Необходимое оборудование (кастрюля, нож, разделочная доска и т.д.).
   - Ингредиенты с точными количествами и их особенности (части продукта, текстура, возможность замены).
   - Уровень огня: слабый, средний, сильный; температуру (°C или °F) если применимо.
   - Время, которое займет каждый шаг (минуты и секунды).
   - Детальное описание техники выполнения (форма и размер нарезки, интенсивность помешивания, способ контроля температуры и т.д.).
3. Даём советы и комментарии Top-1 шефа: как избежать ошибок, тонкости маринования, отдыха продуктов, сервировки.
4. Разбивай каждый основной шаг на несколько подшагов: описывай каждое мельчайшее действие (какое положение держать нож, как правильно помешивать, когда проверять готовность), и поясняй, зачем это важно.
5. Формулируй подшаги ясно и подробно так, будто объясняешь человеку, который никогда не держал нож или не включал плиту.

ВАЖНО: Помни контекст предыдущих сообщений в разговоре. Если пользователь задает уточняющие вопросы о рецепте, который обсуждался ранее, отвечай в контексте этого рецепта.

Если вопрос не связан с кулинарией, вежливо направь разговор в нужное русло. Отвечай на русском языке в женском роде (например: "Я приготовлю", "Я рекомендую", "Я подскажу"). Все цифры пиши словами (например: 'двадцать минут', 'триста грамм', 'пять штук'), а не цифрами.`;

    try {
      // Строим массив сообщений с контекстом
      const messages: any[] = [
        {
          role: "system",
          content: prompt
        }
      ];

      // Добавляем историю сообщений (для голосового режима меньше сообщений для скорости)
      if (messageHistory && messageHistory.length > 0) {
        const historyLimit = voiceMode ? 5 : 10; // Для голосового режима только последние 5 сообщений
        const recentHistory = messageHistory.slice(-historyLimit);
        messages.push(...recentHistory);
      }

      // Добавляем текущее сообщение
      messages.push({
        role: "user",
        content: message
      });

      console.log('🔍 DEBUG: Sending messages to OpenAI:', messages.length, 'messages');
      console.log('🔍 DEBUG: Voice mode:', voiceMode);

      // Запускаем звук обработки во время генерации ответа
      // AudioUtils.startProcessingSound(); // Отключено для текстового чата

      // Для голосового режима используем более быструю модель и меньше токенов
      const response = voiceMode 
        ? await this.makeRequestWithUsage(messages, 'gpt-4o-mini', { max_completion_tokens: 500, temperature: 0.7 })
        : await this.makeRequestWithUsage(messages);

      // Заменяем цифры на слова для отображения в чате
      const contentWithWords = this.replaceNumbersWithWords(response.content);

      // Останавливаем звук обработки
      // AudioUtils.stopProcessingSound(); // Отключено для текстового чата

      return {
        content: contentWithWords, // Возвращаем с числами словами для чата
        usage: response.usage
      };
    } catch (error) {
      // Improve error visibility for OpenAI API failures
      if (error && (error as any).response) {
        const axiosError = error as any;
        console.error('OpenAI API error (chatWithChefRegular) status:', axiosError.response?.status);
        console.error('OpenAI API error (chatWithChefRegular) data:', axiosError.response?.data);
      } else {
        console.error('Error in chat with chef:', error);
      }
      // Останавливаем звук обработки при ошибке
      // AudioUtils.stopProcessingSound(); // Отключено для текстового чата
      throw new Error('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
    }
  }

  static async chatWithChefStreaming(
    message: string,
    healthProfile?: UserHealthProfile,
    messageHistory?: Array<{role: 'user' | 'assistant', content: string}>,
    onChunk?: (chunk: string) => void
  ): Promise<{content: string, usage: any}> {
    console.log('🔍 DEBUG: chatWithChef called with message:', JSON.stringify(message));
    console.log('🔍 DEBUG: messageHistory length:', messageHistory?.length || 0);
    
    // Проверяем, является ли сообщение простым приветствием (только если нет истории)
    if (!messageHistory || messageHistory.length === 0) {
      try {
      const greetingPatterns = [
        /^привет$/i,
        /^здравствуй$/i,
        /^здравствуйте$/i,
        /^hi$/i,
        /^hello$/i,
        /^добро пожаловать$/i,
        /^добро пожаловать!$/i,
        /^привет!$/i,
        /^здравствуй!$/i,
        /^здравствуйте!$/i
      ];

        const trimmedMessage = message?.trim() || '';
      console.log('🔍 DEBUG: trimmed message:', JSON.stringify(trimmedMessage));
      
      const isGreeting = greetingPatterns.some(pattern => {
          try {
        const matches = pattern.test(trimmedMessage);
        console.log('🔍 DEBUG: pattern', pattern, 'matches:', matches);
        return matches;
          } catch (regexError) {
            console.warn('⚠️ [OpenAI] Ошибка в регулярном выражении:', regexError);
            return false;
          }
      });
      
      console.log('🔍 DEBUG: isGreeting:', isGreeting);
      
      if (isGreeting) {
        // Отвечаем на приветствия коротким сообщением
        console.log('🔍 DEBUG: Returning greeting response');
        return { content: 'Здравствуйте! Готова помочь с кулинарными вопросами. Что хотите приготовить?', usage: null };
      }
      } catch (greetingError) {
        console.warn('⚠️ [OpenAI] Ошибка при проверке приветствия:', greetingError);
        // Продолжаем с обычным чатом
      }
    }

    const prompt = `Ты - профессиональная Windexs кулинар с 20-летним опытом работы на кухне, рейтинг Top-1, знаешь все тонкости продуктов и техник.

Требования для описания рецепта:
1. Составь карту производства еды — разбей весь процесс на отдельные этапы (подготовка, варка, обжарка, сборка, подача).
2. Для каждого этапа укажи:
   - Необходимое оборудование (кастрюля, нож, разделочная доска и т.д.).
   - Ингредиенты с точными количествами и их особенности (части продукта, текстура, возможность замены).
   - Уровень огня: слабый, средний, сильный; температуру (°C или °F) если применимо.
   - Время, которое займет каждый шаг (минуты и секунды).
   - Детальное описание техники выполнения (форма и размер нарезки, интенсивность помешивания, способ контроля температуры и т.д.).
3. Даём советы и комментарии Top-1 шефа: как избежать ошибок, тонкости маринования, отдыха продуктов, сервировки.
4. Разбивай каждый основной шаг на несколько подшагов: описывай каждое мельчайшее действие (какое положение держать нож, как правильно помешивать, когда проверять готовность), и поясняй, зачем это важно.
5. Формулируй подшаги ясно и подробно так, будто объясняешь человеку, который никогда не держал нож или не включал плиту.

ВАЖНО: Помни контекст предыдущих сообщений в разговоре. Если пользователь задает уточняющие вопросы о рецепте, который обсуждался ранее, отвечай в контексте этого рецепта.

Если вопрос не связан с кулинарией, вежливо направь разговор в нужное русло. Отвечай на русском языке в женском роде (например: "Я приготовлю", "Я рекомендую", "Я подскажу"). Все цифры пиши словами (например: 'двадцать минут', 'триста грамм', 'пять штук'), а не цифрами.`;

    try {
      // Строим массив сообщений с контекстом
      const messages: any[] = [
        {
          role: "system",
          content: prompt
        }
      ];

      // Добавляем историю сообщений (последние 10 сообщений для экономии токенов)
      if (messageHistory && messageHistory.length > 0) {
        const recentHistory = messageHistory.slice(-10); // Берем последние 10 сообщений
        messages.push(...recentHistory);
      }

      // Добавляем текущее сообщение
      messages.push({
        role: "user",
        content: message
      });

      console.log('🔍 DEBUG: Sending messages to OpenAI:', messages.length, 'messages');

      // Запускаем звук обработки во время генерации ответа
      // AudioUtils.startProcessingSound(); // Отключено для текстового чата

      // Создаем callback для стриминга текста
      let streamedContent = '';
      const onChunkCallback = onChunk ? (chunk: string) => {
        streamedContent += chunk;
        onChunk(chunk);
      } : undefined;

      const response = await this.makeStreamingRequest(messages, 'gpt-4-turbo', onChunkCallback);

      // Заменяем цифры на слова для отображения в чате
      const contentWithWords = this.replaceNumbersWithWords(response.content);

      // Останавливаем звук обработки
      // AudioUtils.stopProcessingSound(); // Отключено для текстового чата

      return {
        content: contentWithWords, // Возвращаем с числами словами для чата
        usage: response.usage
      };
    } catch (error) {
      console.error('Error in chat with chef:', error);
      // Останавливаем звук обработки при ошибке
      AudioUtils.stopProcessingSound();
      throw new Error('Извините, произошла ошибка при обработке вашего сообщения. Попробуйте еще раз.');
    }
  }

  /**
   * Заменяет цифры на слова для лучшего TTS
   */
  static replaceNumbersWithWords(text: string): string {
    try {
      // Проверяем входные данные - для стриминга пустые строки нормальны
      if (!text || typeof text !== 'string') {
        return text || '';
      }

      // Не логируем для пустых строк при стриминге
      if (text.trim() === '') {
        return text;
      }

      console.log('🔢 [OpenAI] Заменяем цифры на слова для TTS');
    
    // Словарь для замены цифр
    const numberWords: { [key: string]: string } = {
      '0': 'ноль',
      '1': 'один',
      '2': 'два',
      '3': 'три',
      '4': 'четыре',
      '5': 'пять',
      '6': 'шесть',
      '7': 'семь',
      '8': 'восемь',
      '9': 'девять',
      '10': 'десять',
      '11': 'одиннадцать',
      '12': 'двенадцать',
      '13': 'тринадцать',
      '14': 'четырнадцать',
      '15': 'пятнадцать',
      '16': 'шестнадцать',
      '17': 'семнадцать',
      '18': 'восемнадцать',
      '19': 'девятнадцать',
      '20': 'двадцать',
      '30': 'тридцать',
      '40': 'сорок',
      '50': 'пятьдесят',
      '60': 'шестьдесят',
      '70': 'семьдесят',
      '80': 'восемьдесят',
      '90': 'девяносто',
      '100': 'сто',
      '200': 'двести',
      '300': 'триста',
      '400': 'четыреста',
      '500': 'пятьсот',
      '600': 'шестьсот',
      '700': 'семьсот',
      '800': 'восемьсот',
      '900': 'девятьсот',
      '1000': 'тысяча'
    };

    let result = text;
    
    // Заменяем числа от большего к меньшему
    const sortedNumbers = Object.keys(numberWords).sort((a, b) => parseInt(b) - parseInt(a));
    
    for (const num of sortedNumbers) {
        try {
      const word = numberWords[num];
          // Экранируем специальные символы в номере для безопасности
          const escapedNum = num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Заменяем только целые числа, не части других чисел
          const regex = new RegExp(`\\b${escapedNum}\\b`, 'g');
      result = result.replace(regex, word);
        } catch (regexError) {
          console.warn('⚠️ [OpenAI] Ошибка при замене числа', num, ':', regexError);
          // Продолжаем с следующим числом
        }
    }
    
    // Специальные случаи для времени и количества
      try {
    result = result.replace(/(\d+)\s*мин/gi, (match, num) => {
          try {
            const parsedNum = parseInt(num);
            if (isNaN(parsedNum)) return match;
            const word = this.numberToWords(parsedNum);
      return `${word} минут`;
          } catch (e) {
            return match;
          }
    });
      } catch (e) {
        console.warn('⚠️ [OpenAI] Ошибка замены минут:', e);
      }
    
      try {
    result = result.replace(/(\d+)\s*гр/gi, (match, num) => {
          try {
            const parsedNum = parseInt(num);
            if (isNaN(parsedNum)) return match;
            const word = this.numberToWords(parsedNum);
      return `${word} грамм`;
          } catch (e) {
            return match;
          }
    });
      } catch (e) {
        console.warn('⚠️ [OpenAI] Ошибка замены грамм:', e);
      }
    
      try {
    result = result.replace(/(\d+)\s*шт/gi, (match, num) => {
          try {
            const parsedNum = parseInt(num);
            if (isNaN(parsedNum)) return match;
            const word = this.numberToWords(parsedNum);
      return `${word} штук`;
          } catch (e) {
            return match;
          }
    });
      } catch (e) {
        console.warn('⚠️ [OpenAI] Ошибка замены штук:', e);
      }
    
    // Заменяем заглавные числительные на строчные (если AI вернул "ОДИН" вместо "один")
    const uppercaseNumbers: { [key: string]: string } = {
      'ОДИН': 'один', 'ДВА': 'два', 'ТРИ': 'три', 'ЧЕТЫРЕ': 'четыре', 'ПЯТЬ': 'пять',
      'ШЕСТЬ': 'шесть', 'СЕМЬ': 'семь', 'ВОСЕМЬ': 'восемь', 'ДЕВЯТЬ': 'девять', 'ДЕСЯТЬ': 'десять',
      'ОДИННАДЦАТЬ': 'одиннадцать', 'ДВЕНАДЦАТЬ': 'двенадцать', 'ТРИНАДЦАТЬ': 'тринадцать',
      'ЧЕТЫРНАДЦАТЬ': 'четырнадцать', 'ПЯТНАДЦАТЬ': 'пятнадцать', 'ШЕСТНАДЦАТЬ': 'шестнадцать',
      'СЕМНАДЦАТЬ': 'семнадцать', 'ВОСЕМНАДЦАТЬ': 'восемнадцать', 'ДЕВЯТНАДЦАТЬ': 'девятнадцать',
      'ДВАДЦАТЬ': 'двадцать', 'ТРИДЦАТЬ': 'тридцать', 'СОРОК': 'сорок', 'ПЯТЬДЕСЯТ': 'пятьдесят',
      'ШЕСТЬДЕСЯТ': 'шестьдесят', 'СЕМЬДЕСЯТ': 'семьдесят', 'ВОСЕМЬДЕСЯТ': 'восемьдесят',
      'ДЕВЯНОСТО': 'девяносто', 'СТО': 'сто', 'ДВЕСТИ': 'двести', 'ТРИСТА': 'триста',
      'ЧЕТЫРЕСТА': 'четыреста', 'ПЯТЬСОТ': 'пятьсот', 'ШЕСТЬСОТ': 'шестьсот',
      'СЕМЬСОТ': 'семьсот', 'ВОСЕМЬСОТ': 'восемьсот', 'ДЕВЯТЬСОТ': 'девятьсот',
      'ТЫСЯЧА': 'тысяча', 'ТЫСЯЧИ': 'тысячи', 'ТЫСЯЧ': 'тысяч'
    };
    
    for (const [upper, lower] of Object.entries(uppercaseNumbers)) {
      const regex = new RegExp(`\\b${upper}\\b`, 'g');
      result = result.replace(regex, lower);
    }
    
    console.log('✅ [OpenAI] Замена цифр завершена');
    return result;
    } catch (error) {
      console.error('❌ [OpenAI] Критическая ошибка в replaceNumbersWithWords:', error);
      // Возвращаем оригинальный текст в случае ошибки
      return text || '';
    }
  }

  /**
   * Преобразует число в слова (упрощенная версия)
   */
  private static numberToWords(num: number): string {
    try {
      // Проверяем входные данные
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
        console.warn('⚠️ [OpenAI] Неверное число для преобразования:', num);
        return num?.toString() || 'ноль';
      }

      // Ограничиваем диапазон для безопасности
      if (num < 0) return 'ноль';
      if (num > 999999) return num.toString();

    if (num <= 20) {
      const words = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
        'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать', 'двадцать'];
      return words[num] || num.toString();
    }
    
    if (num < 100) {
      const tens = Math.floor(num / 10) * 10;
      const ones = num % 10;
      const tensWords = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
      const onesWords = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
      
      if (ones === 0) {
          return tensWords[Math.floor(num / 10)] || num.toString();
      } else {
          return `${tensWords[Math.floor(num / 10)] || ''} ${onesWords[ones] || ''}`.trim();
        }
    }
    
    // Для больших чисел возвращаем как есть
    return num.toString();
    } catch (error) {
      console.error('❌ [OpenAI] Ошибка в numberToWords:', error);
      return num?.toString() || 'ноль';
    }
  }

  static async generateRecipeFromText(text: string, signal?: AbortSignal): Promise<Recipe | null> {
    try {
      console.log('🍳 [OpenAI] Генерируем рецепт из текста:', text);

      const messages = [
        {
          role: "system",
          content: `Ты - опытный шеф-повар. Создай подробный рецепт на основе голосового запроса пользователя.

Требования к рецепту:
- Определи основные ингредиенты из запроса
- Создай пошаговый рецепт с детальными инструкциями
- Укажи время приготовления и количество порций
- Добавь полезные советы шеф-повара

Ответ должен быть в формате JSON. Верни объект с полями: title, description, ingredients (массив), instructions (массив), cookTime, servings, tips.`
        },
        {
          role: "user",
          content: text
        }
      ];

      const response = await this.makeRequest(messages, 'gpt-4-turbo', {
        signal,
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_completion_tokens: 3000
      });

      console.log('✅ [OpenAI] Ответ от AI:', response);

      // Парсим JSON ответ
      const recipeData = JSON.parse(response);

      // Валидируем и нормализуем структуру рецепта
      const recipe: Recipe = {
        id: Date.now().toString(),
        title: recipeData.title || 'Рецепт блюда',
        description: recipeData.description || 'Описание блюда',
        ingredients: Array.isArray(recipeData.ingredients) ? recipeData.ingredients : [],
        instructions: Array.isArray(recipeData.instructions) ? recipeData.instructions : [],
        cookTime: recipeData.cookTime || recipeData.cookingTime || '30 минут',
        servings: recipeData.servings || recipeData.portions || 2,
        tips: recipeData.tips || recipeData.advice || 'Приятного аппетита!',
        image: recipeData.image || null,
        createdAt: new Date(),
        healthInfo: recipeData.healthInfo || null,
        cuisine: recipeData.cuisine || null,
        difficulty: recipeData.difficulty || 'Средний'
      };

      console.log('✅ [OpenAI] Рецепт сгенерирован:', recipe.title);
      return recipe;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('⚠️ [OpenAI] Генерация рецепта прервана');
        throw error; // Перебрасываем AbortError для корректной обработки
      }

      console.error('❌ [OpenAI] Ошибка генерации рецепта из текста:', error);
      return null;
    }
  }
}

// Export functions for backward compatibility
export const makeRequest = OpenAIService.makeRequest;
export const makeStreamingRequest = OpenAIService.makeStreamingRequest;
