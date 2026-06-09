import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog | MAET Terminal',
  description: 'Latest updates, tutorials, and insights from MAET Terminal.',
}

const POSTS = [
  {
    slug: 'paper-trading-why-it-matters',
    title: 'Paper Trading: Why It Matters',
    excerpt: 'Understanding the safety model that makes algorithmic trading accessible without risking real money.',
    date: 'June 2026',
    readTime: '5 min read',
  },
  {
    slug: 'why-i-built-maet',
    title: 'Why I Built MAET Terminal',
    excerpt: 'My journey building a paper-mode research platform for Indian algo traders.',
    date: 'June 2026',
    readTime: '8 min read',
  },
]

export default function BlogIndexPage() {
  return (
    <main className="maet-page-bg min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <Link href="/" className="text-sm text-maet-text-muted hover:text-maet-text">
            ← Back to Home
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-maet-text lg:text-4xl">
            Blog
          </h1>
          <p className="mt-2 text-maet-text-secondary">
            Latest updates, tutorials, and insights from the MAET team.
          </p>
        </header>

        {/* Blog Posts */}
        <section className="space-y-4">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="maet-card group block p-6 transition-all hover:border-maet-cyan"
            >
              <article className="space-y-3">
                <h2 className="font-heading text-xl font-bold text-maet-text group-hover:text-maet-cyan">
                  {post.title}
                </h2>
                <p className="text-sm text-maet-text-secondary">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-xs text-maet-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.date}
                  </span>
                  <span>{post.readTime}</span>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-maet-cyan">
                  Read more <ArrowRight className="h-4 w-4" />
                </div>
              </article>
            </Link>
          ))}
        </section>

        {/* Newsletter Signup placeholder */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Stay Updated</h2>
          <p className="text-sm text-maet-text-secondary">
            Subscribe to get notified about new posts and platform updates.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 rounded-xl border border-maet-glass-border bg-maet-bg-deep px-4 py-2 text-sm text-maet-text placeholder:text-maet-text-muted"
            />
            <button type="button" className="maet-btn maet-btn-primary px-4 text-sm">
              Subscribe
            </button>
          </div>
        </section>

        <footer className="text-center text-xs text-maet-text-muted">
          <Link href="/" className="hover:text-maet-text">
            ← Back to Home
          </Link>
        </footer>
      </div>
    </main>
  )
}