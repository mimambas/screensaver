import { useEffect, useState } from 'react';
import { Quote as QuoteIcon } from 'lucide-react';

const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'Stay hungry, stay foolish.', author: 'Stewart Brand' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { text: 'Code is read much more often than it is written.', author: 'Guido van Rossum' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
  { text: 'Make it work, make it right, make it fast — in that order.', author: 'Kent Beck' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
];

export function Quotes() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % QUOTES.length);
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const q = QUOTES[idx];

  return (
    <div className="max-w-xl text-center px-6">
      <QuoteIcon className="w-5 h-5 mx-auto opacity-30 mb-3" />
      <div className="text-xl font-light leading-relaxed italic">"{q.text}"</div>
      <div className="text-sm opacity-50 mt-3">— {q.author}</div>
    </div>
  );
}