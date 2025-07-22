import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold mb-4">Welcome to Sitter!</h1>
      <p className="mb-8 text-center max-w-xl">
        A smarter way for parents to schedule playdates, carpooling, and exchange childcare hours. Join or create groups, manage your children’s activities, and discover local marketplace offers—all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth"
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}
