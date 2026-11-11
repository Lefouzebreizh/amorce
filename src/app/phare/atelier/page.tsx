import type { Metadata } from 'next';
import Atelier from './Atelier';
import './atelier.css';

export const metadata: Metadata = { title: 'Mon atelier — Le Phare', robots: { index: false, follow: false } };
export default function AtelierPage() { return <Atelier />; }
