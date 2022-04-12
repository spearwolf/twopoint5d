jest.mock('scheduler', () => require('scheduler/unstable_mock'));

import '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {useRef} from 'react';
import {Mesh} from 'three';
import {forwardRefValue, useFrameLoop} from './useFrameLoop';

// TODO test useFrameStateMachine(callbacks, /* without-extra-params */)

const TestMesh = ({extraValue, callbacks}: any) => {
  const meshRef = useRef<Mesh>();

  useFrameLoop(callbacks, {mesh: forwardRefValue(meshRef), extraValue, foo: 'plah!'});

  return (
    <mesh ref={meshRef as any}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={0xffff00} />
    </mesh>
  );
};

const TestScene = ({showMesh, extraValue, callbacks}: any) => (
  <>{showMesh && <TestMesh callbacks={callbacks} extraValue={extraValue} />}</>
);

describe('useFrameStateMachine hook', () => {
  test('hook function exists', () => {
    expect(typeof useFrameLoop).toBe('function');
  });

  test('callbacks are called in the correct sequence', async () => {
    const callbacks = {
      init: jest.fn(),
      update: jest.fn(),
      frame: jest.fn(),
      dispose: jest.fn(),
    };

    const renderer = await ReactThreeTestRenderer.create(<TestScene showMesh callbacks={callbacks} extraValue="abc" />);
    const mesh = renderer.scene.findByType('Mesh').instance;

    expect(mesh).toBeDefined();
    expect(mesh.type).toBe('Mesh');

    expect(callbacks.init).not.toBeCalled();
    expect(callbacks.update).not.toBeCalled();
    expect(callbacks.frame).not.toBeCalled();
    expect(callbacks.dispose).not.toBeCalled();

    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1);
    });

    expect(callbacks.init).toBeCalledTimes(1);
    expect(callbacks.update).not.toBeCalled();
    expect(callbacks.frame).not.toBeCalled();
    expect(callbacks.dispose).not.toBeCalled();

    let args = callbacks.init.mock.calls[0][0];
    expect(args.mesh).toBe(mesh);
    expect(args.state).toBeDefined();
    expect(args.delta).toBe(1);

    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(5, 2);
    });

    expect(callbacks.init).toBeCalledTimes(1);
    expect(callbacks.update).not.toBeCalled();
    expect(callbacks.frame).toBeCalledTimes(5);
    expect(callbacks.dispose).not.toBeCalled();

    args = callbacks.frame.mock.calls.at(-1)[0];
    expect(args.mesh).toBe(mesh);
    expect(args.state).toBeDefined();
    expect(args.delta).toBe(2);

    // await renderer.update(<TestScene showMesh callbacks={callbacks} extraValue="xyz" />);

    // await ReactThreeTestRenderer.act(async () => {
    //   renderer.advanceFrames(1, 1);
    // });

    // expect(callbacks.init).toBeCalledTimes(1);
    // expect(callbacks.update).toBeCalled();
    // expect(callbacks.frame).toBeCalledTimes(6);
    // expect(callbacks.dispose).not.toBeCalled();

    await renderer.update(<TestScene callbacks={callbacks} />);

    expect(callbacks.init).toBeCalledTimes(1);
    // expect(callbacks.update).toBeCalledTimes(1);
    expect(callbacks.frame).toBeCalledTimes(5);
    expect(callbacks.dispose).toBeCalledTimes(1);

    args = callbacks.dispose.mock.calls.at(-1)[0];
    expect(args.mesh).toBe(mesh);
    expect(args.state).toBeUndefined();
    expect(args.delta).toBeUndefined();
  });

  test('lazy callbacks', async () => {
    const callbacks = {
      init: jest.fn(),
      frame: jest.fn(),
      dispose: jest.fn(),
    };

    const lazyCallbacks = jest.fn();
    lazyCallbacks.mockReturnValueOnce(callbacks).mockReturnValue(undefined);

    const renderer = await ReactThreeTestRenderer.create(<TestScene showMesh callbacks={lazyCallbacks} extraValue={42} />);
    const mesh = renderer.scene.findByType('Mesh').instance;

    expect(mesh).toBeDefined();
    expect(mesh.type).toBe('Mesh');

    expect(lazyCallbacks).not.toBeCalled();
    expect(callbacks.init).not.toBeCalled();
    expect(callbacks.frame).not.toBeCalled();
    expect(callbacks.dispose).not.toBeCalled();

    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(1, 1);
    });

    expect(lazyCallbacks).toBeCalledTimes(1);
    expect(callbacks.init).toBeCalledTimes(1);
    expect(callbacks.frame).not.toBeCalled();
    expect(callbacks.dispose).not.toBeCalled();

    let args = lazyCallbacks.mock.calls[0][0];
    expect(args.mesh).toBe(mesh);
    expect(args.state).toBeDefined();
    expect(args.delta).toBe(1);

    args = callbacks.init.mock.calls[0][0];
    expect(args.mesh).toBe(mesh);
    expect(args.state).toBeDefined();
    expect(args.delta).toBe(1);

    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(5, 2);
    });

    expect(lazyCallbacks).toBeCalledTimes(1);
  });
});
