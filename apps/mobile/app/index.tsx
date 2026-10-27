import { Foundation } from '../src/components/Foundation';
import { loadStats } from '../src/lib/api';

export default function Index() {
  return <Foundation loadStats={loadStats} />;
}
