import { redirect } from 'next/navigation'
// /p leitet auf Utes Plan weiter
export default function PersonRoot() {
  redirect('/p/p1')
}
