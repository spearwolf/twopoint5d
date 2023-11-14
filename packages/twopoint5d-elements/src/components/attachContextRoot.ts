import {ContextRoot} from '@lit/context';

declare global {
  interface Window {
    LIT_CONTEXT_ROOT_ATTACHED_TO_BODY?: boolean;
  }
}

if (typeof window.LIT_CONTEXT_ROOT_ATTACHED_TO_BODY === 'undefined') {
  window.LIT_CONTEXT_ROOT_ATTACHED_TO_BODY = true;

  const root = new ContextRoot();
  root.attach(document.body);
}
