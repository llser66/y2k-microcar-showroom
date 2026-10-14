import './style.css';
import * as THREE from 'three';
import { ShowroomApp } from './app/ShowroomApp';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root was not found');
const showroom = new ShowroomApp(root);
showroom.start();
(window as unknown as { __showroom?: unknown; __THREE?: unknown }).__showroom = showroom;
(window as unknown as { __THREE?: unknown }).__THREE = THREE;
addEventListener('pagehide', () => showroom.dispose(), { once: true });
