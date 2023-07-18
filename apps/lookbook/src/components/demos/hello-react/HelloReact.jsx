import {useEffect, useState} from 'react';

export default function HelloReact() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      setCount(count + 1);
      console.log('HelloReact');
    }, 1000);
  }, [count]);

  return <div>hello react! {count}</div>;
}
