import Link from 'next/link'
import { redirect } from 'next/navigation'

export default function DocsIndex() {
  redirect('/docs/quickstart')
}
