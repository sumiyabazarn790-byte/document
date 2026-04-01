import { WS_URL } from './env';

export { WS_URL };

export const COLORS = [
  '#1a73e8',
  '#e8710a',
  '#188038',
  '#9334e6',
  '#d93025',
  '#0f9d58',
];

export const COLOR_PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
];

export const FONTS = [
  'Arial',
  'Plus Jakarta Sans',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Times New Roman',
  'Georgia',
  'Merriweather',
  'Playfair Display',
  'Newsreader',
  'Source Sans 3',
  'Source Serif 4',
  'Courier New',
  'Fira Code',
  'Inconsolata',
  'Verdana',
  'DM Sans',
];

export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];
export const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 200];

export const ROOM_NAME = import.meta.env.VITE_DOC_ROOM || 'demo-document';

export const tabsKey = `doc:tabs:${ROOM_NAME}`;
export const activeTabKey = `doc:activeTab:${ROOM_NAME}`;
export const getDraftKey = (tabId) => `doc:draft:${ROOM_NAME}:${tabId}`;
export const getHistoryKey = (tabId) => `doc:history:${ROOM_NAME}:${tabId}`;
