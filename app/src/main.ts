import { mountEditor } from './editor/app';
import { registerAllNodes } from './nodes';
import './style.css';

registerAllNodes();
const root = document.querySelector<HTMLDivElement>('#app');
if (root) mountEditor(root);
