import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Articles & Editorial Guides | PlayNest',
  description: 'Explore gaming guides, venue showcases, and tournament highlights on PlayNest.',
}

export default async function ArticlesListPage() {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'articles',
    where: {
      status: { equals: 'published' },
    },
    sort: '-publishedAt',
    limit: 12,
  })

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Articles & Gaming Insights
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Editorial guides, venue spotlights, and tournament coverage.
          </p>
        </header>

        {result.docs.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-500">
            No published articles available at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.docs.map((article) => (
              <article key={article.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    <Link href={`/articles/${article.slug}`} className="hover:text-indigo-600 transition">
                      {article.title}
                    </Link>
                  </h2>
                  {article.seo?.description && (
                    <p className="text-sm text-gray-600 line-clamp-3">{article.seo.description}</p>
                  )}
                </div>
                <div className="p-6 pt-0 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 mt-4">
                  <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Draft'}</span>
                  <Link href={`/articles/${article.slug}`} className="font-semibold text-indigo-600 hover:underline">
                    Read Article &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
