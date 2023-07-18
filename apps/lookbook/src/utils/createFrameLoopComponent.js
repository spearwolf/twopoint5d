/**
 * @example
 *   class DemoOrDie {
 *     init(state, delta) { ... }
 *     update(changes) { ... }
 *     frame(state, delta) { ... }
 *     dispose() { ... }
 *   }
 *   ...
 *   useFrameLoop(createFrameLoopComponent(DemoOrDie), {...});
 *
 */
export function createFrameLoopComponent(componentClass) {
  let component;

  return () => ({
    init(props) {
      component = new componentClass();
      const {state, delta, ...componentProps} = props;
      Object.assign(component, componentProps);
      if (component.init) component.init(state, delta);
    },

    update(changes) {
      const propChanges = Object.fromEntries(Object.entries(changes).map(([key, {currentValue}]) => [key, currentValue]));
      Object.assign(component, propChanges);
      if (component.update) component.update(changes);
    },

    frame(props) {
      const {state, delta} = props;
      if (component.frame) component.frame(state, delta);
    },

    dispose(props) {
      Object.assign(component, props);
      if (component.dispose) component.dispose();
      component = null;
    },
  });
}
