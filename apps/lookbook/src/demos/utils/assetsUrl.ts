import {makeUrl} from './makeUrl.js';

export default function assetsUrl(url: string): string {
  return makeUrl(url, 'assets');
}
