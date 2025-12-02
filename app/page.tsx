import Link from 'next/link';

export default function HomePage() {
  return (
          <main className="flex flex-col items-center justify-center min-h-screen bg-white px-6 safe-area-inset">
      <h1 className="text-3xl font-bold mb-4 text-gray-900 text-center">Welcome to Sitter!</h1>
      <p className="mb-8 text-center max-w-xl text-gray-600">
        A smarter way for parents to schedule playdates, carpooling, and exchange childcare hours. Join or create groups, manage your children's activities, and discover local marketplace offers—all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-soft hover:shadow-medium"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-soft hover:shadow-medium"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
