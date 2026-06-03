import { redirect } from 'next/navigation'

/** Wissen lebt im Terminal (Suchen + Erfassen). */
export default function WissenPage() {
  redirect('/terminal?mode=search')
}
