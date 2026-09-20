import { redirect } from 'next/navigation'

/** Legacy login/nav target. Admin home is /dashboard; user admin is /admin/users. */
export default function AdminDashboardRedirect() {
  redirect('/dashboard')
}
