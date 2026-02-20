import { useEffect, useState } from 'react';
import { Position } from '@/types';
import { reverseGeocode } from '@/lib/geocoding';

/**
 * Hook para enriquecer posição com endereço via reverse geocoding
 */
export function usePositionAddress(position: Position | null) {
  const [enrichedPosition, setEnrichedPosition] = useState<Position | null>(position);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    if (!position) {
      setEnrichedPosition(null);
      return;
    }

    // Se já tem endereço, usar
    if (position.address) {
      setEnrichedPosition(position);
      return;
    }

    // Buscar endereço via geocoding
    const fetchAddress = async () => {
      setIsLoadingAddress(true);
      try {
        const address = await reverseGeocode(position.latitude, position.longitude);
        setEnrichedPosition({
          ...position,
          address,
        });
      } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        setEnrichedPosition(position);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    fetchAddress();
  }, [position?.id, position?.latitude, position?.longitude]);

  return { enrichedPosition, isLoadingAddress };
}
