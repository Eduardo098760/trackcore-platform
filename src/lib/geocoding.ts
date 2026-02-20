/**
 * Serviço de Geocoding Reverso
 * Converte coordenadas lat/lng em endereços legíveis
 */

interface GeocodeResult {
  address: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Mapeia nomes de estados brasileiros para suas siglas
 */
function getStateBrazilAbbr(stateName: string): string | null {
  const stateMap: Record<string, string> = {
    'Acre': 'AC',
    'Alagoas': 'AL',
    'Amapá': 'AP',
    'Amazonas': 'AM',
    'Bahia': 'BA',
    'Ceará': 'CE',
    'Distrito Federal': 'DF',
    'Espírito Santo': 'ES',
    'Goiás': 'GO',
    'Maranhão': 'MA',
    'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG',
    'Pará': 'PA',
    'Paraíba': 'PB',
    'Paraná': 'PR',
    'Pernambuco': 'PE',
    'Piauí': 'PI',
    'Rio de Janeiro': 'RJ',
    'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO',
    'Roraima': 'RR',
    'Santa Catarina': 'SC',
    'São Paulo': 'SP',
    'Sergipe': 'SE',
    'Tocantins': 'TO',
  };

  return stateMap[stateName] || null;
}

// Cache de endereços para evitar requisições duplicadas
const geocodeCache = new Map<string, GeocodeResult>();

/**
 * Arredonda coordenadas para reduzir requisições (precisão de ~100m)
 */
function roundCoord(coord: number): number {
  return Math.round(coord * 1000) / 1000;
}

/**
 * Gera chave de cache baseada nas coordenadas arredondadas
 */
function getCacheKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Converte coordenadas em endereço usando Nominatim (OpenStreetMap)
 * Gratuito e sem necessidade de API key
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = getCacheKey(lat, lng);
  
  // Verificar cache primeiro
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!.address;
  }

  try {
    // Usar Nominatim (OpenStreetMap) - gratuito
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`,
      {
        headers: {
          'User-Agent': 'TrackCore Platform/1.0' // Nominatim requer User-Agent
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    if (data && data.address) {
      // Construir endereço simplificado
      const parts: string[] = [];
      const addr = data.address;

      // Rua/Rodovia
      if (addr.road) {
        parts.push(addr.road);
      }

      // Bairro
      if (addr.suburb || addr.neighbourhood) {
        parts.push(addr.suburb || addr.neighbourhood);
      }

      // Cidade
      const city = addr.city || addr.town || addr.village || addr.municipality;
      if (city) {
        parts.push(city);
      }

      // Estado (sigla se possível)
      if (addr.state) {
        // Tentar usar sigla do estado brasileiro
        const stateAbbr = getStateBrazilAbbr(addr.state);
        parts.push(stateAbbr || addr.state);
      }

      const simpleAddress = parts.length > 0 
        ? parts.join(', ') 
        : data.display_name;

      const result: GeocodeResult = {
        address: simpleAddress,
        city,
        state: addr.state,
        country: addr.country,
      };

      // Salvar no cache
      geocodeCache.set(cacheKey, result);
      
      return result.address;
    }

    // Se não conseguiu endereço, retornar coordenadas formatadas
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error('Erro no geocoding:', error);
    // Em caso de erro, retornar coordenadas
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

/**
 * Geocoding reverso em lote (múltiplas coordenadas)
 * Processa com delay entre requisições para respeitar rate limits
 */
export async function reverseGeocodeBatch(
  coordinates: { lat: number; lng: number }[],
  delayMs: number = 1000
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const coord of coordinates) {
    const cacheKey = getCacheKey(coord.lat, coord.lng);
    
    // Se já está em cache, usar
    if (geocodeCache.has(cacheKey)) {
      results.set(cacheKey, geocodeCache.get(cacheKey)!.address);
      continue;
    }

    // Buscar endereço
    const address = await reverseGeocode(coord.lat, coord.lng);
    results.set(cacheKey, address);

    // Delay entre requisições para respeitar rate limit (Nominatim: 1 req/seg)
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Limpa cache de geocoding (útil para testes ou após muito tempo)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Retorna estatísticas do cache
 */
export function getGeocodeStats(): { cacheSize: number; cacheKeys: string[] } {
  return {
    cacheSize: geocodeCache.size,
    cacheKeys: Array.from(geocodeCache.keys()).slice(0, 10), // Primeiros 10
  };
}
