import {useEffect, useState} from 'react';

export default function HelloReact() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      setCount(count + 1);
      console.log('HelloReact');
    }, 1000);
  }, [count]);

  return (
    <div className="flex flex-col justify-center items-center h-screen gap-2">
      <p>Hello &lt;React&gt; !</p>
      <p>You&apos;ve been staring at this for {count} seconds.</p>
    </div>
  );
}
