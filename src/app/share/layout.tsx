import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'TrackCore · Localização Compartilhada',
  description: 'Link de rastreamento temporário em modo leitura.',
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
