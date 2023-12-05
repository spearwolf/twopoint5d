import {makeUrl} from './makeUrl.js';

export default function demoPreviewImageUrl(url: string): string {
  return makeUrl(url, 'images/demo-preview');
}
